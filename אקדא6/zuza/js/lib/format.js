/**
 * format.js — עיצוב תצוגה של מספרים, מחירים ותאריכים בעברית.
 */

import { CONFIG } from '../config.js';

const { locale, currency } = CONFIG.ui;

export const HEBREW_WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const HEBREW_WEEKDAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
export const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

/**
 * מחיר מעוצב, עם סימן המטבע משמאל למספר: "₪108".
 * המחרוזת מיועדת להיות בתוך אלמנט עם direction: ltr (המחלקה .num),
 * ואז הסדר הוויזואלי הוא סימן ואחריו מספר.
 */
export function money(amount) {
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
  return `${currency}${value}`;
}

/** מספר בלבד, ללא סימן מטבע */
export function number(value) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/**
 * המרת Date למפתח ISO מקומי (YYYY-MM-DD).
 * שימוש ב-toISOString היה מזיז את התאריך בגלל UTC — לכן חישוב ידני.
 */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** יצירת Date מקומי מתוך מחרוזת ISO, ללא הסטת אזור זמן */
export function fromISODate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** תאריך מלא בעברית: "יום שלישי, 8 בספטמבר 2026" */
export function longDate(date) {
  const value = date instanceof Date ? date : fromISODate(date);
  return `יום ${HEBREW_WEEKDAYS[value.getDay()]}, ${value.getDate()} ב${HEBREW_MONTHS[value.getMonth()]} ${value.getFullYear()}`;
}

/** תאריך קצר: "8 בספטמבר" */
export function shortDate(date) {
  const value = date instanceof Date ? date : fromISODate(date);
  return `${value.getDate()} ב${HEBREW_MONTHS[value.getMonth()]}`;
}

/** כותרת חודש בלוח השנה: "ספטמבר 2026" */
export function monthLabel(date) {
  return `${HEBREW_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** ניקוי מספר טלפון לספרות בלבד */
export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** עיצוב טלפון ישראלי לתצוגה: 0523063700 -> 052-3063700 */
export function phoneDisplay(value) {
  const digits = digitsOnly(value);
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return value;
}

/** מספר הזמנה קריא: ZZ-4821 */
export function orderReference(prefix = 'ZZ') {
  const stamp = Date.now().toString().slice(-4);
  const random = Math.floor(Math.random() * 90 + 10);
  return `${prefix}-${stamp}${random}`;
}
