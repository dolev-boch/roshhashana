/**
 * gallery.js
 * ---------------------------------------------------------------------------
 * רצועות תמונה רחבות המשולבות לאורך העמוד.
 *
 * לכל רצועה נבנה <picture> עם שלושה חיתוכים שונים, ולא רק שלושה גדלים:
 * צילום רחב 21:9 הופך בטלפון לפס דק וחסר משמעות, ולכן במסך צר מוגש
 * חיתוך 4:3 של אותו צילום. Cloudinary מבצע את החיתוך בצד השרת
 * (g_auto מזהה את נושא התמונה), כך שהמכשיר מוריד בדיוק את מה שיוצג.
 * ---------------------------------------------------------------------------
 */

import { el } from '../lib/dom.js';
import { CONFIG } from '../config.js';

const BASE = 'f_auto,q_auto,c_fill,g_auto';

/** נקודות השבירה — חייבות להתאים ל-CSS של .atmos */
const VARIANTS = [
  { media: '(min-width: 62em)', ratio: 'ar_21:9', widths: [1200, 1800, 2400] },
  { media: '(min-width: 34em)', ratio: 'ar_16:9', widths: [800, 1200, 1600] },
];

const FALLBACK = { ratio: 'ar_4:3', widths: [480, 800, 1200] };

/** הזרקת טרנספורמציה לכתובת Cloudinary, לפני מקטע הגרסה */
function transform(url, params) {
  return url.replace('/upload/', `/upload/${params}/`);
}

function srcset(url, ratio, widths) {
  return widths.map((w) => `${transform(url, `${BASE},${ratio},w_${w}`)} ${w}w`).join(', ');
}

/**
 * יצירת רצועת תמונה.
 * @param {{ url: string, alt: string }} image
 * @param {{ eager?: boolean }} options - eager לרצועה הראשונה שנראית מיד
 */
export function createBand(image, { eager = false } = {}) {
  if (!image?.url) return null;

  const sources = VARIANTS.map((variant) =>
    el('source', {
      media: variant.media,
      sizes: '100vw',
      srcset: srcset(image.url, variant.ratio, variant.widths),
    }),
  );

  const img = el('img', {
    class: 'atmos__img',
    src: transform(image.url, `${BASE},${FALLBACK.ratio},w_800`),
    srcset: srcset(image.url, FALLBACK.ratio, FALLBACK.widths),
    sizes: '100vw',
    alt: image.alt || '',
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    // היחס של גרסת הטלפון — מונע קפיצת פריסה לפני הטעינה
    width: 800,
    height: 600,
  });

  return el('div', { class: 'atmos' }, [el('picture', { class: 'atmos__frame' }, [...sources, img])]);
}

/** תמונת אווירה לפי מיקומה ברשימה */
export function galleryImage(index) {
  return CONFIG.images.gallery?.[index] ?? null;
}

/** מילוי כל אלמנט עם data-band במסמך */
export function initGalleryBands() {
  document.querySelectorAll('[data-band]').forEach((slot) => {
    const index = Number(slot.dataset.band);
    const band = createBand(galleryImage(index), { eager: index === 0 });
    if (band) slot.replaceChildren(band);
    else slot.remove();
  });
}
