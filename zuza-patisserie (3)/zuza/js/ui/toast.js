/**
 * toast.js — הודעות קצרות ולא חוסמות.
 * מוכרז ל-screen readers דרך aria-live על המכולה.
 */

import { el, qs } from '../lib/dom.js';

let stack = null;

function ensureStack() {
  if (stack) return stack;
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
 * @param {{ type?: 'info'|'error', duration?: number }} options
 */
export function toast(message, { type = 'info', duration = 3200 } = {}) {
  const container = ensureStack();

  const node = el('div', { class: `toast toast--${type}` }, [
    el('span', { class: 'toast__dot', 'aria-hidden': 'true' }),
    el('span', { text: message }),
  ]);

  container.append(node);

  const dismiss = () => {
    node.classList.add('is-leaving');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    window.setTimeout(() => node.remove(), 600); // גיבוי אם האנימציה מבוטלת
  };

  window.setTimeout(dismiss, duration);
  return dismiss;
}
