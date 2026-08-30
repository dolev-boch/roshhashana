/**
 * toast.js — הודעות קצרות ולא חוסמות.
 *
 * ההודעה יכולה לכלול כפתור פעולה. כך הוספה לסל אינה פותחת את המגירה
 * ומסתירה את התפריט: הלקוח מקבל אישור, וממשיך לבחור — או עובר לסל
 * ביוזמתו, בלחיצה אחת.
 *
 * מוכרז ל-screen readers דרך aria-live על המכולה.
 */

import { el, qs } from '../lib/dom.js';

let stack = null;

/** הודעה עם פעולה נשארת ארוכה יותר, כדי שיהיה זמן ללחוץ */
const DURATION = { plain: 3200, withAction: 6000 };

function ensureStack() {
  if (stack && document.body.contains(stack)) return stack;

  stack = qs('#toast-stack');
  if (!stack) {
    stack = el('div', {
      id: 'toast-stack',
      class: 'toast-stack',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'false',
    });
    document.body.append(stack);
  }
  return stack;
}

/**
 * @param {string} message
 * @param {{
 *   type?: 'info'|'error',
 *   duration?: number,
 *   action?: { label: string, onClick: () => void }
 * }} options
 */
export function toast(message, { type = 'info', duration, action } = {}) {
  const container = ensureStack();

  // הודעה קודמת מוחלפת ולא נערמת — אחרת מסך קטן מתמלא בהודעות
  container.replaceChildren();

  const node = el('div', { class: `toast toast--${type}${action ? ' toast--action' : ''}` }, [
    el('span', { class: 'toast__dot', 'aria-hidden': 'true' }),
    el('span', { class: 'toast__text', text: message }),
  ]);

  const dismiss = () => {
    if (!node.isConnected) return;
    node.classList.add('is-leaving');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    window.setTimeout(() => node.remove(), 600); // גיבוי אם האנימציה מבוטלת
  };

  if (action) {
    node.append(
      el('button', {
        class: 'toast__action',
        type: 'button',
        text: action.label,
        on: {
          click: () => {
            dismiss();
            action.onClick();
          },
        },
      }),
    );
  }

  container.append(node);
  window.setTimeout(dismiss, duration ?? (action ? DURATION.withAction : DURATION.plain));

  return dismiss;
}
