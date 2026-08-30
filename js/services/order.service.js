/**
 * order.service.js
 * ---------------------------------------------------------------------------
 * בניית ההזמנה ושליחתה. השליחה בנויה כמתאמים (adapters) —
 * הוספת ערוץ חדש (מייל, CRM, Google Sheets) = הוספת מתאם, בלי לגעת בממשק.
 * ---------------------------------------------------------------------------
 */

import { CONFIG } from '../config.js';
import { money, orderReference, phoneDisplay } from '../lib/format.js';
import { pickupDate, pickupDateLong, describeBranch } from './pickup.service.js';

/**
 * בניית אובייקט ההזמנה המלא.
 * @param {{ items: Array, total: number }} cart
 * @param {{ fullName: string, phone: string, email: string, notes?: string }} customer
 * @param {{ date: string, time: string }} pickup
 */
export function buildOrder(cart, customer, pickup) {
  const branch = pickup.branch ?? {};

  return {
    reference: orderReference(CONFIG.submission.orderPrefix),
    createdAt: new Date().toISOString(),
    business: CONFIG.business.nameHe,
    campaign: `${CONFIG.campaign.title} ${CONFIG.campaign.year}`,
    customer: {
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes || '',
    },
    pickup: {
      date: pickupDate(),
      dateLong: pickupDateLong(),
      branchId: branch.id ?? '',
      branchName: branch.name ?? '',
      branchHours: branch.hours ?? '',
      branchAddress: branch.address ?? '',
      /* תיאור מוכן, כדי שהגיליון והמייל לא יצטרכו להרכיב אותו */
      branchFull: describeBranch(branch),
    },
    items: cart.items.map(({ product, qty, lineTotal }) => ({
      id: product.id,
      name: product.name,
      unitPrice: product.price,
      qty,
      lineTotal,
    })),
    itemCount: cart.totalItems,
    total: cart.total,
    currency: CONFIG.ui.currency,
  };
}

/** סיכום ההזמנה כטקסט קריא — משמש בוואטסאפ ובגיבוי */
export function orderToText(order) {
  const lines = [
    `הזמנה חדשה · ${order.campaign}`,
    `מספר הזמנה: ${order.reference}`,
    '',
    'פרטי הלקוח',
    `שם: ${order.customer.fullName}`,
    `טלפון: ${phoneDisplay(order.customer.phone)}`,
    `מייל: ${order.customer.email}`,
    '',
    'איסוף',
    `${order.pickup.dateLong}`,
    order.pickup.branchFull,
    '',
    'פריטים',
    ...order.items.map((item) => `· ${item.name} × ${item.qty} — ${money(item.lineTotal)}`),
    '',
    `סה"כ לתשלום: ${money(order.total)}`,
  ];

  if (order.customer.notes) {
    lines.push('', 'הערות', order.customer.notes);
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------- מתאמים -- */

const adapters = {
  /**
   * שולח את ההזמנה ל-Google Apps Script, שכותב לגיליון ושולח את המיילים.
   *
   * שתי החלטות שחשוב להבין:
   * 1. סוג התוכן הוא text/plain ולא application/json. זו בקשה "פשוטה" מבחינת
   *    CORS, ולכן הדפדפן אינו שולח preflight — ש-Apps Script אינו יודע לענות לו.
   *    הצד השני מפענח את הגוף כ-JSON בכל מקרה.
   * 2. במצב no-cors לא ניתן לקרוא את התשובה, ולכן אין אישור מהשרת.
   *    לכן מסך ההצלחה תמיד מציע גם שליחה בוואטסאפ כגיבוי.
   */
  async sheets(order) {
    const { endpoint, useNoCors } = CONFIG.submission;
    if (!endpoint) throw new Error('submission.endpoint is not configured');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: useNoCors ? 'no-cors' : 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(order),
        signal: controller.signal,
        redirect: 'follow',
      });

      // ב-no-cors התשובה אטומה (status 0) — עצם ההגעה לכאן מספיקה
      if (!useNoCors && !response.ok) throw new Error(`Apps Script responded ${response.status}`);

      return { ok: true, channel: 'sheets', confirmed: !useNoCors };
    } finally {
      window.clearTimeout(timeout);
    }
  },

  /** שולח את ההזמנה כ-JSON ל-endpoint חיצוני */
  async webhook(order) {
    const { webhookUrl } = CONFIG.submission;
    if (!webhookUrl) throw new Error('webhookUrl is not configured');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(order),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Webhook responded ${response.status}`);
      return { ok: true, channel: 'webhook' };
    } finally {
      window.clearTimeout(timeout);
    }
  },
};

/**
 * שליחת ההזמנה לפי המצב שהוגדר.
 * מחזירה תמיד אובייקט תוצאה — אין זריקות שלא נתפסות אל הממשק.
 */
export async function submitOrder(order) {
  const { mode } = CONFIG.submission;

  /*
   * ללא endpoint אין לאן לשלוח את ההזמנה. במקום להציג ללקוח מסך הצלחה
   * שאינו נכון, מוחזרת שגיאה מפורשת — ומסך הסיום מפנה אותו להתקשר.
   * זהו מצב תצורה, לא מצב תפעולי: ברגע שמוגדר endpoint הוא אינו קורה.
   */
  if ((mode === 'sheets' || mode === 'both') && !CONFIG.submission.endpoint) {
    console.error('[order] submission.endpoint is not configured');
    return { ok: false, error: 'ההזמנה לא נשלחה — האתר אינו מחובר למערכת ההזמנות' };
  }

  try {
    if (mode === 'sheets') {
      const result = await adapters.sheets(order);
      // ההזמנה נשלחה. אין צורך בפעולה נוספת מהלקוח.
      return {
        ok: true,
        channels: ['sheets'],
        confirmed: result.confirmed,
        requiresManualSend: false,
      };
    }

    if (mode === 'webhook') {
      await adapters.webhook(order);
      return { ok: true, channels: ['webhook'], requiresManualSend: false };
    }

    await adapters.sheets(order);
    return { ok: true, channels: ['sheets'], requiresManualSend: false };
  } catch (error) {
    console.error('[order] submission failed', error);
    // גיבוי: גם אם השרת נכשל, הלקוח עדיין יכול לשלוח בוואטסאפ
    return { ok: false, error: 'לא הצלחנו לשלוח את ההזמנה' };
  }
}


