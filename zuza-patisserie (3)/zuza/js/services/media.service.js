/**
 * media.service.js
 * ---------------------------------------------------------------------------
 * פתרון מקור התמונה של מוצר. תומך בשלוש דרכי עדכון:
 *   1. קובץ מקומי בתיקיית assets/images/products (עולה יחד עם האתר ל-Vercel)
 *   2. כתובת מלאה (Cloudinary או כל CDN אחר)
 *   3. public id של Cloudinary — נבנה לכתובת מלאה לפי ההגדרות
 *
 * לכתובות Cloudinary נבנה גם srcset בכמה רוחבים, כדי שמכשיר נייד יוריד
 * קובץ קטן ומסך גדול יקבל קובץ חד. אם אין תמונה או שהטעינה נכשלת —
 * מוצגת תמונת ברירת מחדל מותגית.
 * ---------------------------------------------------------------------------
 */

import { CONFIG } from '../config.js';

const {
  cloudinaryBase,
  cloudinaryTransform,
  placeholder,
  productsDir,
  autoByProductId,
  defaultExtension,
} = CONFIG.images;

/* ערך ברירת מחדל — כדי שהסרת ההגדרה לא תפיל את בניית ה-srcset */
const srcsetWidths = CONFIG.images.srcsetWidths ?? [400, 800, 1200];

const isAbsolute = (value) => /^https?:\/\//i.test(value);
const isLocalPath = (value) =>
  value.startsWith('/') || value.startsWith('assets/') || value.startsWith('./');

const isCloudinaryUrl = (value) => value.includes('res.cloudinary.com');

/** החלפת רוחב היעד בתוך מחרוזת הטרנספורמציה */
function transformFor(width) {
  if (!width) return cloudinaryTransform;
  return cloudinaryTransform
    .split(',')
    .filter((part) => !part.startsWith('w_') && !part.startsWith('h_'))
    .concat(`w_${width}`)
    .join(',');
}

/**
 * @param {string} source ערך השדה `image` של המוצר
 * @param {number} [width] רוחב מבוקש. רלוונטי ל-Cloudinary בלבד.
 * @returns {string} כתובת תמונה לשימוש
 */
export function resolveImage(source, width) {
  const value = String(source ?? '').trim();
  if (!value) return placeholder;

  if (isAbsolute(value)) {
    if (!isCloudinaryUrl(value)) return value;

    // הזרקה או החלפה של הטרנספורמציה בכתובת Cloudinary קיימת
    return value.replace(/\/upload\/(?:[^/]*_[^/]*\/)?/, `/upload/${transformFor(width)}/`);
  }

  if (isLocalPath(value)) return encodePath(value);

  if (cloudinaryBase) {
    const base = cloudinaryBase.replace(/\/+$/, '');
    return `${base}/${transformFor(width)}/${value.replace(/^\/+/, '')}`;
  }

  return placeholder;
}

/**
 * בניית srcset. מוחזר null כשלא ניתן לייצר גרסאות ברוחבים שונים
 * (קובץ מקומי או CDN שאינו Cloudinary) — ואז הדפדפן משתמש ב-src בלבד.
 * @returns {string|null}
 */
export function buildSrcSet(source) {
  const value = String(source ?? '').trim();
  if (!value) return null;

  const canResize = isCloudinaryUrl(value) || (!isAbsolute(value) && !isLocalPath(value) && cloudinaryBase);
  if (!canResize) return null;

  return srcsetWidths.map((width) => `${resolveImage(value, width)} ${width}w`).join(', ');
}

/**
 * קידוד תווים שאינם ASCII בנתיב.
 * שם קובץ בעברית חייב להיות מקודד בכתובת (%D7%A2...), אחרת חלק
 * מהדפדפנים והשרתים לא ימצאו אותו. מדלגים על נתיב שכבר מקודד.
 */
function encodePath(value) {
  if (value.includes('%')) return value;
  return value.split('/').map(encodeURIComponent).join('/');
}

/**
 * התמונה של מוצר, לפי סדר עדיפות:
 *   1. השדה `image` של המוצר, אם מולא.
 *   2. זיהוי לפי שם הקובץ: <productsDir>/<id>.<ext> — כשההגדרה פעילה.
 *   3. תמונת ברירת המחדל.
 *
 * זו הפונקציה שרכיבי התצוגה משתמשים בה. הכלל היחיד שצריך לזכור:
 * שם הקובץ חייב להיות זהה למזהה המוצר.
 */
export function imageFor(product, width) {
  const explicit = String(product?.image ?? '').trim();
  if (explicit) return resolveImage(explicit, width);

  if (autoByProductId && product?.id) {
    return `${productsDir}/${product.id}.${defaultExtension}`;
  }

  return placeholder;
}

/** srcset למוצר, לפי אותו סדר עדיפות */
export function srcSetFor(product) {
  const explicit = String(product?.image ?? '').trim();
  return explicit ? buildSrcSet(explicit) : null;
}

/** חיבור נפילה חיננית לתמונת ברירת מחדל */
export function attachImageFallback(img) {
  img.addEventListener(
    'error',
    () => {
      if (img.dataset.fallbackApplied === 'true') return;
      img.dataset.fallbackApplied = 'true';
      img.removeAttribute('srcset');
      img.src = placeholder;
      img.classList.add('is-placeholder');
    },
    { once: true },
  );

  // תמונה שאין לה מקור אמיתי מסומנת מיד, כדי שתוצג בהתאמה ולא בחיתוך
  if (img.getAttribute('src') === placeholder) img.classList.add('is-placeholder');
}

export const PLACEHOLDER_IMAGE = placeholder;
