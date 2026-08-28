/**
 * ui-kit.js — עזרים חוצי-רכיבים: אחסון בטוח, אירועים, מלכודת פוקוס ונעילת גלילה.
 * מרוכזים בקובץ אחד כי הם קטנים ותמיד נצרכים יחד.
 */

/* -------------------------------------------------------------- אחסון -- */

/**
 * עטיפה בטוחה ל-localStorage.
 * ב-Safari במצב פרטי הקריאה זורקת שגיאה — נופלים חזרה לזיכרון בלבד.
 */
const memoryStore = new Map();

let storageAvailable = (() => {
  try {
    const key = '__zuza_probe__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
})();

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = storageAvailable ? window.localStorage.getItem(key) : memoryStore.get(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    const raw = JSON.stringify(value);
    try {
      if (storageAvailable) window.localStorage.setItem(key, raw);
      else memoryStore.set(key, raw);
    } catch {
      storageAvailable = false;
      memoryStore.set(key, raw);
    }
  },
  remove(key) {
    try {
      if (storageAvailable) window.localStorage.removeItem(key);
      memoryStore.delete(key);
    } catch {
      memoryStore.delete(key);
    }
  },
};

/* ------------------------------------------------------------ אירועים -- */

/** Pub/Sub מינימלי — מאפשר לרכיבי תצוגה להגיב לשינויי מצב בלי צימוד. */
export function createEmitter() {
  const listeners = new Map();

  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => listeners.get(event)?.delete(handler);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[emitter] handler failed for "${event}"`, error);
        }
      });
    },
  };
}

/* --------------------------------------------------------- נעילת גלילה -- */

/**
 * נעילת גלילת הרקע בזמן מודאל.
 * הטכניקה של position:fixed נדרשת כי ב-iOS Safari overflow:hidden לבדו לא מספיק.
 * תומכת בקינון (מגירה שפותחת מודאל) באמצעות מונה.
 */
let lockCount = 0;
let savedScrollY = 0;

export const scrollLock = {
  lock() {
    if (lockCount === 0) {
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.top = `-${savedScrollY}px`;
      document.body.classList.add('is-locked');
    }
    lockCount += 1;
  },
  unlock() {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.classList.remove('is-locked');
      document.body.style.top = '';
      window.scrollTo({ top: savedScrollY, behavior: 'instant' in window ? 'instant' : 'auto' });
    }
  },
};

/* -------------------------------------------------------- מלכודת פוקוס -- */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * כליאת פוקוס בתוך אלמנט — דרישת נגישות לכל דיאלוג.
 * מחזירה פונקציית שחרור שגם מחזירה את הפוקוס לאלמנט המקורי.
 */
export function trapFocus(container, { initialFocus } = {}) {
  const previouslyFocused = document.activeElement;

  const getItems = () =>
    Array.from(container.querySelectorAll(FOCUSABLE)).filter(
      (node) => node.offsetParent !== null || node === document.activeElement,
    );

  const onKeydown = (event) => {
    if (event.key !== 'Tab') return;
    const items = getItems();
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKeydown);

  // עיכוב קצר מאפשר לאנימציית הפתיחה להתחיל לפני העברת הפוקוס
  window.setTimeout(() => {
    const target = initialFocus || getItems()[0] || container;
    target?.focus?.({ preventScroll: true });
  }, 60);

  return () => {
    container.removeEventListener('keydown', onKeydown);
    previouslyFocused?.focus?.({ preventScroll: true });
  };
}

/* --------------------------------------------------------------- שונות -- */

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** דחיית קריאה — שימושי לאירועי scroll/resize */
export function debounce(fn, wait = 150) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}
