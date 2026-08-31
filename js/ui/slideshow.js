/**
 * slideshow.js
 * ---------------------------------------------------------------------------
 * רצועת תמונות אווירה אחת בראש העמוד, שמתחלפת מעצמה.
 *
 * כל תמונה נבנית בשלושה חיתוכים ולא רק בשלושה גדלים: 16:9 בטלפון
 * ו-21:9 במסכים רחבים. צילום רחב מאוד בטלפון היה הופך לפס דק
 * שאי אפשר לזהות בו דבר. החיתוך נעשה בצד Cloudinary עם g_auto,
 * שמזהה את נושא התמונה וחותך סביבו.
 *
 * ההחלפה נעצרת כשהלשונית מוסתרת, כשהעכבר מעל הרצועה, וכשהפוקוס בתוכה —
 * טיימר שרץ ברקע סתם שורף סוללה, והחלפה תוך כדי אינטראקציה מבלבלת.
 * ---------------------------------------------------------------------------
 */

import { el, qsa } from '../lib/dom.js';
import { CONFIG } from '../config.js';


const BASE = 'f_auto,q_auto,c_fill,g_auto';

/** נקודות השבירה — חייבות להתאים ל-CSS של .slideshow */
/*
 * חיתוכים מתונים יותר. 21:9 חתך כל כך הרבה מהצילום שהיה קשה להבין מה רואים;
 * 16:9 במסך רחב עדיין נקרא כרצועה רחבה, אך משאיר את התוכן מזוהה.
 * בטלפון 4:3 — הפורמט שבו צולמו התמונות — כך שכמעט דבר לא נחתך.
 */
const WIDE = { media: '(min-width: 34em)', ratio: 'ar_16:9', widths: [900, 1400, 2000] };
const NARROW = { ratio: 'ar_4:3', widths: [600, 900, 1200] };

/** משך הצגה של תמונה */
const INTERVAL_MS = 5200;

const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="5" width="3.4" height="14" rx="1"/><rect x="13.6" y="5" width="3.4" height="14" rx="1"/></svg>';

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5l11 6.5-11 6.5z"/></svg>';

const transform = (url, params) => url.replace('/upload/', `/upload/${params}/`);

const srcset = (url, ratio, widths) =>
  widths.map((w) => `${transform(url, `${BASE},${ratio},w_${w}`)} ${w}w`).join(', ');

function slide(image, index) {
  const picture = el('picture', {}, [
    el('source', {
      media: WIDE.media,
      sizes: '100vw',
      srcset: srcset(image.url, WIDE.ratio, WIDE.widths),
    }),
    el('img', {
      class: 'slideshow__img',
      src: transform(image.url, `${BASE},${NARROW.ratio},w_900`),
      srcset: srcset(image.url, NARROW.ratio, NARROW.widths),
      sizes: '100vw',
      alt: image.alt || '',
      // רק הראשונה נטענת מיד; השאר נטענות ברקע ואינן חוסמות את הציור
      loading: index === 0 ? 'eager' : 'lazy',
      decoding: 'async',
      width: 1200,
      height: 900,
    }),
  ]);

  return el(
    'div',
    {
      class: `slideshow__slide${index === 0 ? ' is-active' : ''}`,
      dataset: { slide: String(index) },
      'aria-hidden': index === 0 ? 'false' : 'true',
    },
    [picture],
  );
}

export function initSlideshow() {
  const mount = document.querySelector('[data-slideshow]');
  if (!mount) return;

  const images = (CONFIG.images.gallery ?? []).filter((image) => image?.url);
  if (images.length === 0) {
    mount.remove();
    return;
  }

  const slides = images.map(slide);

  const dots = images.map((image, index) =>
    el('button', {
      class: `slideshow__dot${index === 0 ? ' is-active' : ''}`,
      type: 'button',
      'aria-label': `תמונה ${index + 1} מתוך ${images.length}`,
      'aria-current': index === 0 ? 'true' : 'false',
      on: {
        click: () => {
          show(index);
          restart();
        },
      },
    }),
  );

  const frame = el('div', { class: 'slideshow__frame' }, slides);

  /*
   * תוכן שמתחלף מעצמו חייב להיות ניתן לעצירה (WCAG 2.2.2).
   * הכפתור גם פותר מצב שבו ההחלפה מפריעה לקריאה.
   */
  const pauseBtn = el('button', {
    class: 'slideshow__pause',
    type: 'button',
    'aria-label': 'השהיית החלפת התמונות',
    'aria-pressed': 'false',
    html: PAUSE_ICON,
    on: {
      click: () => {
        paused = !paused;
        pauseBtn.setAttribute('aria-pressed', String(paused));
        pauseBtn.setAttribute('aria-label', paused ? 'המשך החלפת התמונות' : 'השהיית החלפת התמונות');
        pauseBtn.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
        if (paused) stop();
        else start();
      },
    },
  });

  const root = el(
    'div',
    {
      class: 'slideshow',
      role: 'group',
      'aria-roledescription': 'גלריית תמונות',
      'aria-label': 'תמונות מהקונדיטוריה',
    },
    [
      frame,
      images.length > 1
        ? el('div', { class: 'slideshow__controls' }, [
            el('div', { class: 'slideshow__dots' }, dots),
            pauseBtn,
          ])
        : null,
    ],
  );

  mount.replaceChildren(root);

  /* ------------------------------------------------------------ מצב -- */

  let current = 0;
  let timer = null;
  /* השהיה יזומה של המשתמש — גוברת על כל חידוש אוטומטי */
  let paused = false;

  function show(next) {
    current = (next + slides.length) % slides.length;

    slides.forEach((node, index) => {
      const active = index === current;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    dots.forEach((dot, index) => {
      const active = index === current;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });
  }

  function stop() {
    window.clearInterval(timer);
    timer = null;
  }

  function start() {
    /*
     * בהפחתת תנועה ההחלפה נמשכת, אך ללא הצללה — ההחלפה מיידית (ראו CSS).
     * ביטול ההחלפה לגמרי היה משאיר תמונה אחת קפואה, וזה לא מה שהמשתמש מצפה לו.
     * מי שרוצה לעצור לחלוטין יכול ללחוץ על כפתור ההשהיה.
     */
    if (timer || slides.length < 2 || paused) return;
    timer = window.setInterval(() => show(current + 1), INTERVAL_MS);
  }

  function restart() {
    stop();
    start();
  }

  /*
   * עצירה זמנית בזמן ריפוד/פוקוס. אינה משנה את מצב ההשהיה היזומה:
   * start בודק את paused ולכן לא יחדש החלפה שהמשתמש עצר בכוונה.
   */
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', start);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  start();

  return { show, stop, start, get index() { return current; } };
}
