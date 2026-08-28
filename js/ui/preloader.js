/**
 * preloader.js
 * ---------------------------------------------------------------------------
 * מחוון הטעינה של המותג.
 *
 * ההתנהגות: אות אחת נראית בכל רגע, והאותיות רצות ברצף קבוע —
 * Z ואז U ואז Z ואז A — וחוזר חלילה. המילה המלאה לעולם אינה מוצגת יחד,
 * והרצף זהה בכל רענון.
 *
 * הרצף מונע ב-CSS (`@keyframes letter-run` עם השהיות מדורגות), כי אנימציית
 * CSS רצה על ה-GPU ואינה נעצרת כשהדפדפן עסוק בפענוח משאבים — בדיוק הרגע
 * שבו מסך הטעינה מוצג.
 *
 * מנגנון גיבוי: המודול מאזין ל-animationstart. אם האנימציה לא התחילה תוך
 * חלון קצר — למשל כשאנימציות חסומות בהגדרות הדפדפן, במצב חיסכון בסוללה,
 * או בדפדפן שנפל על תחביר כלשהו — הוא עובר להנעה ב-JavaScript.
 * כך הרצף רץ בכל מצב, ולא נתקע על האות הראשונה.
 * ---------------------------------------------------------------------------
 */

import { el, qs } from '../lib/dom.js';
import { CONFIG } from '../config.js';

const LETTERS = ['Z', 'U', 'Z', 'A'];

/** חייב להתאים ל---animation-delay שב-components.css */
const STEP_MS = 550;

/** כמה זמן להמתין לאירוע animationstart לפני מעבר לגיבוי */
const ANIMATION_PROBE_MS = 400;

/**
 * יצירת מחוון טעינה עצמאי.
 * @param {{ caption?: string, inline?: boolean, forceFallback?: boolean }} options
 */
export function createBrandLoader({ caption = '', inline = false, forceFallback = false } = {}) {
  const letterNodes = LETTERS.map((char) =>
    el('span', { class: 'brand-loader__letter', 'aria-hidden': 'true', text: char }),
  );

  const dotNodes = LETTERS.map(() => el('span', { class: 'brand-loader__dot' }));

  const root = el('div', { class: `brand-loader${inline ? ' brand-loader--inline' : ''}` }, [
    el('div', { class: 'brand-loader__letters' }, letterNodes),
    el('div', { class: 'brand-loader__dots', 'aria-hidden': 'true' }, dotNodes),
    caption ? el('p', { class: 'brand-loader__caption', text: caption }) : null,
  ]);

  let timer = null;
  let probe = null;
  let cssAnimating = false;
  let index = 0;

  /** הנעה ידנית — משמשת רק אם אנימציית ה-CSS לא רצה */
  function step() {
    letterNodes.forEach((node, i) => node.classList.toggle('is-active', i === index));
    dotNodes.forEach((node, i) => node.classList.toggle('is-active', i === index));
    index = (index + 1) % LETTERS.length;
  }

  function startFallback() {
    if (timer) return;
    root.classList.add('is-js');
    index = 0;
    step();
    timer = window.setInterval(step, STEP_MS);
  }

  function start() {
    if (forceFallback) {
      startFallback();
      return;
    }

    // אם האנימציה נורית, אין צורך בגיבוי
    letterNodes[0].addEventListener(
      'animationstart',
      () => {
        cssAnimating = true;
        window.clearTimeout(probe);
      },
      { once: true },
    );

    probe = window.setTimeout(() => {
      if (!cssAnimating) startFallback();
    }, ANIMATION_PROBE_MS);
  }

  function stop() {
    window.clearInterval(timer);
    window.clearTimeout(probe);
    timer = null;
    probe = null;
  }

  return {
    node: root,
    start,
    stop,
    /** משך מחזור מלא במילישניות */
    get cycleMs() {
      return LETTERS.length * STEP_MS;
    },
    /** לבדיקות: האם המחוון עבר למצב גיבוי */
    get isFallback() {
      return Boolean(timer);
    },
  };
}

/**
 * מסך הפתיחה.
 * מוסתר רק לאחר שהעמוד נטען וגם לאחר משך מינימלי, כדי שרצף האותיות
 * ייראה במלואו לפחות פעם אחת גם על חיבורים מהירים.
 */
export function initPreloader() {
  const root = qs('#preloader');
  if (!root) return { hide: () => {} };

  const loader = createBrandLoader({ caption: CONFIG.business.nameHe });
  root.append(loader.node);
  loader.start();

  const startedAt = performance.now();
  let hidden = false;

  function hide() {
    if (hidden) return;
    hidden = true;

    const elapsed = performance.now() - startedAt;
    const wait = Math.max(0, CONFIG.ui.minPreloaderMs - elapsed);

    window.setTimeout(() => {
      root.classList.add('is-done');
      root.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => {
        loader.stop();
        root.remove();
      }, 600);
    }, wait);
  }

  // רשת ביטחון: המסך לא יישאר תקוע גם אם משאב כלשהו נכשל
  window.setTimeout(hide, 6000);

  return { hide };
}
