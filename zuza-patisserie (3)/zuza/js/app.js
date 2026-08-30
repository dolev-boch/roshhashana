/**
 * app.js — נקודת הכניסה. מחברת בין המודולים ומטפלת בהתנהגויות גלובליות.
 */

import { CONFIG } from './config.js';
import { qs, qsa, on } from './lib/dom.js';
import { debounce } from './lib/ui-kit.js';
import { longDate, shortDate } from './lib/format.js';
import { initPreloader } from './ui/preloader.js';
import { initMenu } from './ui/menu.view.js';
import { initCart } from './ui/cart.view.js';
import { initCheckout } from './ui/checkout.view.js';
import { initAccessibility } from './ui/accessibility.js';
import * as cart from './state/cart.store.js';
import {
  isOrderingOpen,
  firstAvailableDate,
  lastPickupDate,
} from './services/availability.service.js';

/* -------------------------------------------------- תוכן דינמי בעמוד -- */

function fillStaticContent() {
  const { business, campaign, pickup } = CONFIG;

  const bindings = {
    'business-name': business.nameHe,
    'campaign-title': campaign.title,
    'campaign-year': campaign.year,
    'campaign-subtitle': campaign.subtitle,
    'business-hours': business.hoursNote,
    'pickup-note': pickup.note,
    'current-year': String(new Date().getFullYear()),
  };

  for (const [key, value] of Object.entries(bindings)) {
    qsa(`[data-bind="${key}"]`).forEach((node) => {
      node.textContent = value;
    });
  }

  // חלון האיסוף מחושב מההגדרות ולא נכתב ידנית
  const first = firstAvailableDate();
  const last = lastPickupDate();
  qsa('[data-bind="pickup-window"]').forEach((node) => {
    node.textContent = first ? `${shortDate(first)} – ${shortDate(last)}` : 'ההזמנות נסגרו';
  });

  qsa('[data-bind="orders-deadline"]').forEach((node) => {
    node.textContent = longDate(campaign.ordersCloseOn);
  });

  // קישורי יצירת קשר
  qsa('[data-link="phone"]').forEach((node) => {
    node.href = `tel:${business.phone.replace(/\D/g, '')}`;
    const value = qs('[data-bind="phone-display"]', node);
    if (value) value.textContent = business.phone;
  });

  qsa('[data-link="whatsapp"]').forEach((node) => {
    node.href = `https://wa.me/${business.whatsapp}`;
    const value = qs('[data-bind="whatsapp-display"]', node);
    if (value) value.textContent = business.whatsappDisplay;
  });

  document.title = `${campaign.title} ${campaign.year} · ${business.nameHe}`;
}

/* ------------------------------------------------------------- לוגו -- */

/** אם קובץ הלוגו חסר או נכשל — מוצגת חלופת טקסט מותגית במקום תמונה שבורה */
function guardLogos() {
  qsa('.brand').forEach((brand) => {
    const img = qs('.brand__img', brand);
    if (!img) return;

    const fail = () => brand.classList.add('is-fallback');
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener('error', fail, { once: true });
  });
}

/* ------------------------------------------------------ כותרת דביקה -- */

function initHeaderState() {
  const header = qs('.site-header');
  if (!header) return;

  const update = () => header.classList.toggle('is-stuck', window.scrollY > 8);
  update();
  on(window, 'scroll', update, { passive: true });
}

/* -------------------------------------------------- חלון הזמנות סגור -- */

function applyOrderingWindow() {
  if (isOrderingOpen()) return;

  document.body.classList.add('orders-closed');
  qsa('[data-action="add"], [data-open-cart], #mobile-bar').forEach((node) => {
    node.setAttribute('aria-disabled', 'true');
    node.disabled = true;
  });

  const notice = qs('#closed-notice');
  if (notice) notice.hidden = false;
}

/* ---------------------------------------------------------------- אתחול -- */

function boot() {
  const preloader = initPreloader();

  fillStaticContent();
  guardLogos();
  initHeaderState();

  // מופעל מוקדם, כדי שהעדפות נגישות שמורות יוחלו לפני ציור התוכן
  initAccessibility();

  cart.hydrate();

  const checkout = initCheckout();
  const cartUI = initCart({ onCheckout: () => checkout.open() });

  initMenu({
    onAdd: () => {
      // בדסקטופ נפתחת המגירה מיד; בנייד הסרגל התחתון מספק את המשוב
      if (window.matchMedia('(min-width: 48em)').matches) cartUI.open();
    },
  });

  qsa('[data-open-checkout]').forEach((node) =>
    node.addEventListener('click', () => checkout.open()),
  );

  applyOrderingWindow();

  // הסתרת מסך הטעינה רק לאחר שהעמוד והנכסים מוכנים
  if (document.readyState === 'complete') preloader.hide();
  else on(window, 'load', () => preloader.hide(), { once: true });

  // תיקון גובה חלון ב-iOS ישן שאינו תומך ב-dvh
  const setViewportUnit = debounce(() => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  }, 120);
  setViewportUnit();
  on(window, 'resize', setViewportUnit, { passive: true });
  on(window, 'orientationchange', setViewportUnit);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
