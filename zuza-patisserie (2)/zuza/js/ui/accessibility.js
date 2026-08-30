/**
 * accessibility.js
 * ---------------------------------------------------------------------------
 * תפריט נגישות, בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות
 * (התאמות נגישות לשירות) ולתקן הישראלי ת"י 5568.
 *
 * הבהרה חשובה: תפריט נגישות אינו מחליף אתר נגיש. הנגישות עצמה בנויה
 * בתוך האתר — מבנה סמנטי, ניווט מקלדת מלא, ניגודיות תקנית, תוויות ARIA
 * וטקסט חלופי. התפריט הזה מוסיף שכבת התאמה אישית מעליה.
 *
 * העדפות המשתמש נשמרות בדפדפן ומוחלות מיד בטעינה הבאה.
 * ---------------------------------------------------------------------------
 */

import { el, qs, qsa } from '../lib/dom.js';
import { storage, trapFocus } from '../lib/ui-kit.js';

const STORAGE_KEY = 'zuza:a11y:v1';

/** גדלי טקסט יחסיים. 1 הוא ברירת המחדל. */
const FONT_STEPS = [1, 1.15, 1.3, 1.45];

/**
 * ההתאמות. כל אחת היא מחלקה על אלמנט <html>, כך שה-CSS שולט בכול
 * והוספת התאמה חדשה אינה דורשת שינוי בלוגיקה.
 */
const TOGGLES = [
  { id: 'contrast', label: 'ניגודיות גבוהה', desc: 'רקע כהה וטקסט בהיר' },
  { id: 'light-contrast', label: 'ניגודיות בהירה', desc: 'רקע לבן וטקסט שחור' },
  { id: 'monochrome', label: 'גווני אפור', desc: 'ביטול צבעוניות' },
  { id: 'links', label: 'הדגשת קישורים', desc: 'קו תחתון והדגשה' },
  { id: 'readable', label: 'גופן קריא', desc: 'גופן פשוט ומרווח' },
  { id: 'spacing', label: 'ריווח מוגדל', desc: 'מרווח בין שורות ואותיות' },
  { id: 'big-cursor', label: 'סמן גדול', desc: 'סמן עכבר מוגדל' },
  { id: 'no-motion', label: 'עצירת אנימציות', desc: 'ביטול תנועה באתר' },
  { id: 'focus', label: 'הדגשת מיקוד', desc: 'מסגרת בולטת בניווט מקלדת' },
];

/** התאמות ניגודיות אינן יכולות לפעול יחד */
const EXCLUSIVE = ['contrast', 'light-contrast'];

const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="7.4" r="1.3" fill="currentColor" stroke="none"/>
  <path d="M7.4 10.2c3 .9 6.2.9 9.2 0M12 10.8v3.1m0 0l-2 4.2m2-4.2l2 4.2"/>
</svg>`;

const closeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

export function initAccessibility() {
  const root = document.documentElement;

  /** @type {{ font: number, toggles: string[] }} */
  let state = normalize(storage.get(STORAGE_KEY, null));

  /* ------------------------------------------------------------ החלה -- */

  function apply() {
    // גודל טקסט — משפיע על כל האתר כי כל המידות ביחידות rem
    const scale = FONT_STEPS[state.font] ?? 1;
    root.style.fontSize = scale === 1 ? '' : `${scale * 100}%`;

    for (const toggle of TOGGLES) {
      root.classList.toggle(`a11y-${toggle.id}`, state.toggles.includes(toggle.id));
    }

    storage.set(STORAGE_KEY, state);
    syncControls();
  }

  function normalize(saved) {
    const value = saved && typeof saved === 'object' ? saved : {};
    return {
      font: Number.isInteger(value.font) && value.font >= 0 && value.font < FONT_STEPS.length ? value.font : 0,
      toggles: Array.isArray(value.toggles)
        ? value.toggles.filter((id) => TOGGLES.some((t) => t.id === id))
        : [],
    };
  }

  function setToggle(id, on) {
    const set = new Set(state.toggles);

    if (on) {
      set.add(id);
      // כיבוי ההתאמה הנוגדת
      if (EXCLUSIVE.includes(id)) EXCLUSIVE.filter((x) => x !== id).forEach((x) => set.delete(x));
    } else {
      set.delete(id);
    }

    state.toggles = [...set];
    apply();
  }

  function setFont(step) {
    state.font = Math.max(0, Math.min(FONT_STEPS.length - 1, step));
    apply();
  }

  function reset() {
    state = { font: 0, toggles: [] };
    apply();
  }

  /* --------------------------------------------------------- ממשק -- */

  const fontValue = el('span', { class: 'a11y-font__value', 'aria-live': 'polite' });

  const fontRow = el('div', { class: 'a11y-font' }, [
    el('button', {
      class: 'a11y-font__btn',
      type: 'button',
      'aria-label': 'הקטנת גודל הטקסט',
      text: 'א−',
      on: { click: () => setFont(state.font - 1) },
    }),
    fontValue,
    el('button', {
      class: 'a11y-font__btn',
      type: 'button',
      'aria-label': 'הגדלת גודל הטקסט',
      text: 'א+',
      on: { click: () => setFont(state.font + 1) },
    }),
  ]);

  const toggleButtons = new Map();

  const toggleList = el(
    'ul',
    { class: 'a11y-list' },
    TOGGLES.map((toggle) => {
      const button = el(
        'button',
        {
          class: 'a11y-option',
          type: 'button',
          role: 'switch',
          'aria-checked': 'false',
          on: { click: () => setToggle(toggle.id, !state.toggles.includes(toggle.id)) },
        },
        [
          el('span', { class: 'a11y-option__text' }, [
            el('span', { class: 'a11y-option__label', text: toggle.label }),
            el('span', { class: 'a11y-option__desc', text: toggle.desc }),
          ]),
          el('span', { class: 'a11y-option__switch', 'aria-hidden': 'true' }),
        ],
      );

      toggleButtons.set(toggle.id, button);
      return el('li', {}, [button]);
    }),
  );

  const panel = el(
    'div',
    {
      class: 'a11y-panel',
      id: 'a11y-panel',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': 'a11y-title',
      hidden: true,
    },
    [
      el('div', { class: 'a11y-panel__head' }, [
        el('h2', { class: 'a11y-panel__title', id: 'a11y-title', text: 'תפריט נגישות' }),
        el('button', {
          class: 'icon-btn',
          type: 'button',
          'aria-label': 'סגירת תפריט הנגישות',
          html: closeIcon,
          on: { click: () => close() },
        }),
      ]),

      el('div', { class: 'a11y-panel__body scroll-y' }, [
        el('p', { class: 'a11y-section-label', text: 'גודל טקסט' }),
        fontRow,
        el('p', { class: 'a11y-section-label', text: 'התאמות תצוגה' }),
        toggleList,
      ]),

      el('div', { class: 'a11y-panel__foot' }, [
        el('button', {
          class: 'btn btn--outline btn--block',
          type: 'button',
          text: 'איפוס ההגדרות',
          on: { click: reset },
        }),
        el('a', {
          class: 'a11y-statement-link',
          href: 'accessibility.html',
          text: 'הצהרת נגישות',
        }),
      ]),
    ],
  );

  const trigger = el('button', {
    class: 'a11y-trigger',
    type: 'button',
    'aria-label': 'פתיחת תפריט נגישות',
    'aria-expanded': 'false',
    'aria-controls': 'a11y-panel',
    html: icon,
    on: { click: () => (panel.hidden ? open() : close()) },
  });

  const wrapper = el('div', { class: 'a11y-widget' }, [trigger, panel]);
  document.body.append(wrapper);

  /* ------------------------------------------------------ פתיחה/סגירה -- */

  let releaseFocus = null;

  function open() {
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    // אין נעילת גלילה: התפריט אינו חוסם את האתר ואפשר לראות את ההשפעה בזמן אמת
    releaseFocus = trapFocus(panel);
  }

  function close() {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    releaseFocus?.();
    releaseFocus = null;
    trigger.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) close();
  });

  document.addEventListener('click', (event) => {
    if (!panel.hidden && !wrapper.contains(event.target)) close();
  });

  /* ------------------------------------------------------ סנכרון תצוגה -- */

  function syncControls() {
    const scale = FONT_STEPS[state.font] ?? 1;
    fontValue.textContent = `${Math.round(scale * 100)}%`;

    qs('.a11y-font__btn:first-child', fontRow).disabled = state.font === 0;
    qs('.a11y-font__btn:last-child', fontRow).disabled = state.font === FONT_STEPS.length - 1;

    for (const [id, button] of toggleButtons) {
      const on = state.toggles.includes(id);
      button.setAttribute('aria-checked', String(on));
      button.classList.toggle('is-on', on);
    }
  }

  apply();

  return { open, close, reset };
}
