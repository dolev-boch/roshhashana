/**
 * app.js — נקודת הכניסה. מחברת בין המודולים ומטפלת בהתנהגויות גלובליות.
 */

import { CONFIG } from './config.js';
import { qs, qsa, on, el } from './lib/dom.js';
import { debounce } from './lib/ui-kit.js';

import { initPreloader } from './ui/preloader.js';
import { initMenu } from './ui/menu.view.js';
import { initCart } from './ui/cart.view.js';
import { initCheckout } from './ui/checkout.view.js';
import { initAccessibility } from './ui/accessibility.js';
import * as cart from './state/cart.store.js';
import { isOrderingOpen, ordersCloseLong, getBranches } from './services/pickup.service.js';

/* -------------------------------------------------- תוכן דינמי בעמוד -- */

function fillStaticContent() {
  const { business, campaign, pickup } = CONFIG;

  const bindings = {
    'business-name': business.nameHe,
    'campaign-title': campaign.title,
    'campaign-year': campaign.year,
    'campaign-subtitle': campaign.subtitle,
    'pickup-intro': pickup.intro,
    'pickup-date': pickup.dateDisplay,
    'orders-deadline': ordersCloseLong(),
    'current-year': String(new Date().getFullYear()),
  };

  for (const [key, value] of Object.entries(bindings)) {
    qsa(`[data-bind="${key}"]`).forEach((node) => {
      node.textContent = value;
    });
  }

  // רשימת הסניפים נבנית מההגדרות, כדי שהוספת סניף לא תדרוש עריכת HTML
  qsa('[data-branches]').forEach((container) => {
    container.replaceChildren(
      ...getBranches().map((branch) =>
        el('li', { class: 'branch-note' }, [
          el('span', { class: 'branch-note__name', text: branch.name }),
          branch.address ? el('span', { class: 'branch-note__address', text: branch.address }) : null,
          el('span', { class: 'branch-note__hours num', text: branch.hours }),
        ]),
      ),
    );
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

/* -------------------------------------------- הדגשת יעד קישור עוגן -- */

/**
 * קישור עוגן מגלגל את העמוד, אך לא תמיד ברור לאן. בטלפון היעד נוחת
 * באמצע הפוטר, ופרטי הקשר נראים כמו עוד טקסט.
 *
 * לכן, אחרי המעבר, פרטי הטלפון והוואטסאפ מודגשים לזמן קצר.
 * ההדגשה נמשכת גם כשהמשתמש מגיע לעמוד עם #contact בכתובת.
 */
function initAnchorHighlight() {
  const HIGHLIGHT_MS = 2600;
  let timer = null;

  function flash() {
    const targets = qsa('[data-highlight]');
    if (targets.length === 0) return;

    window.clearTimeout(timer);
    targets.forEach((node) => node.classList.remove('is-flash'));

    // הפעלה מחדש של האנימציה מחייבת reflow בין הסרה להוספה
    void targets[0].offsetWidth;

    targets.forEach((node) => node.classList.add('is-flash'));
    timer = window.setTimeout(
      () => targets.forEach((node) => node.classList.remove('is-flash')),
      HIGHLIGHT_MS,
    );
  }

  on(document, 'click', (event) => {
    const link = event.target.closest('a[href="#contact"]');
    if (!link) return;
    // הגלילה מטופלת על ידי הדפדפן; ההדגשה מופעלת אחריה
    window.setTimeout(flash, 320);
  });

  if (window.location.hash === '#contact') window.setTimeout(flash, 600);
  on(window, 'hashchange', () => {
    if (window.location.hash === '#contact') flash();
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
  initAnchorHighlight();

  // מופעל מוקדם, כדי שהעדפות נגישות שמורות יוחלו לפני ציור התוכן
  initAccessibility();

  cart.hydrate();

  const checkout = initCheckout();
  const cartUI = initCart({ onCheckout: () => checkout.open() });

  // המגירה אינה נפתחת מעצמה — האישור מגיע כהודעה עם כפתור מעבר לסל
  initMenu({ onOpenCart: () => cartUI.open() });

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
