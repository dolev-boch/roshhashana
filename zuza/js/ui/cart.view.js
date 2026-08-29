/**
 * cart.view.js
 * ---------------------------------------------------------------------------
 * מגירת ההזמנה: שורות, כמויות וסיכום. מסתנכרנת אוטומטית עם מונה העגלה
 * בכותרת ועם הסרגל התחתון בנייד.
 * ---------------------------------------------------------------------------
 */

import { el, qs, qsa, render } from '../lib/dom.js';
import { money } from '../lib/format.js';
import { resolveImage, attachImageFallback } from '../services/media.service.js';
import { scrollLock, trapFocus } from '../lib/ui-kit.js';
import * as cart from '../state/cart.store.js';
import { toast } from './toast.js';

let releaseFocus = null;

/* ------------------------------------------------------------- רכיבים -- */

function stepper(item) {
  const dec = el('button', {
    class: 'stepper__btn',
    type: 'button',
    dataset: { action: 'dec', id: item.id },
    'aria-label': `הפחתת כמות של ${item.product.name}`,
    text: '−',
  });

  const value = el('span', {
    class: 'stepper__value num',
    'aria-live': 'polite',
    text: String(item.qty),
  });

  const inc = el('button', {
    class: 'stepper__btn',
    type: 'button',
    dataset: { action: 'inc', id: item.id },
    'aria-label': `הגדלת כמות של ${item.product.name}`,
    text: '+',
  });

  return el('div', { class: 'stepper stepper--sm' }, [dec, value, inc]);
}

function cartLine(item) {
  const thumb = el('img', {
    class: 'cart-line__thumb',
    src: resolveImage(item.product.image, 200),
    alt: '',
    loading: 'lazy',
    decoding: 'async',
    width: 64,
    height: 64,
  });
  attachImageFallback(thumb);

  return el('li', { class: 'cart-line', dataset: { line: item.id } }, [
    thumb,
    el('div', { class: 'cart-line__main' }, [
      el('p', { class: 'cart-line__name', text: item.product.name }),
      el('p', { class: 'cart-line__unit', text: `${money(item.product.price)} ליחידה` }),
      el('div', { class: 'cart-line__controls' }, [
        stepper(item),
        el('span', { class: 'cart-line__total num', text: money(item.lineTotal) }),
      ]),
      el('button', {
        class: 'cart-line__remove',
        type: 'button',
        dataset: { action: 'remove', id: item.id },
        text: 'הסרה',
      }),
    ]),
  ]);
}

function emptyState() {
  return el('div', { class: 'empty-state' }, [
    el('span', { class: 'empty-state__mark', 'aria-hidden': 'true', text: 'Z' }),
    el('p', { class: 'empty-state__title', text: 'ההזמנה ריקה' }),
    el('p', {
      class: 'empty-state__text',
      text: 'בחרו מהתפריט את העוגות שילוו את שולחן החג.',
    }),
    el('button', {
      class: 'btn btn--outline',
      type: 'button',
      dataset: { action: 'close-cart' },
      text: 'למעבר לתפריט',
    }),
  ]);
}

/* --------------------------------------------------------------- תצוגה -- */

export function initCart({ onCheckout } = {}) {
  const drawer = qs('#cart-drawer');
  const overlay = qs('#overlay');
  const body = qs('#cart-body');
  const foot = qs('#cart-foot');
  const openers = qsa('[data-open-cart]');
  const closers = qsa('[data-close-cart]');
  const mobileBar = qs('#mobile-bar');

  if (!drawer || !body || !foot) return { open: () => {}, close: () => {} };

  /* ------------------------------------------------------------ פתיחה -- */

  function open() {
    if (drawer.classList.contains('is-open')) return;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');
    scrollLock.lock();
    releaseFocus = trapFocus(drawer, { initialFocus: qs('[data-close-cart]', drawer) });
  }

  function close() {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('is-open');
    scrollLock.unlock();
    releaseFocus?.();
    releaseFocus = null;
  }

  openers.forEach((node) => node.addEventListener('click', open));
  closers.forEach((node) => node.addEventListener('click', close));
  overlay.addEventListener('click', close);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) close();
  });

  /* ------------------------------------------------------------- ציור -- */

  function paint(state) {
    if (state.isEmpty) {
      render(body, emptyState());
      render(foot, []);
    } else {
      render(body, el('ul', { class: 'cart-lines' }, state.items.map(cartLine)));
      render(foot, [
        el('div', { class: 'summary' }, [
          el('div', { class: 'summary__row' }, [
            el('span', { text: `פריטים (${state.totalItems})` }),
            el('span', { class: 'summary__value num', text: money(state.subtotal) }),
          ]),
          el('div', { class: 'summary__row summary__row--total' }, [
            el('span', { text: 'סה"כ' }),
            el('span', { class: 'summary__value num', text: money(state.total) }),
          ]),
        ]),
        el('button', {
          class: 'btn btn--gold btn--block btn--lg',
          type: 'button',
          dataset: { action: 'checkout' },
          text: 'מעבר לפרטי ההזמנה',
        }),
      ]);
    }

    syncTriggers(state);
  }

  /** עדכון מונים חיצוניים — כותרת וסרגל נייד */
  function syncTriggers(state) {
    qsa('[data-cart-count]').forEach((node) => {
      node.textContent = state.totalItems > 0 ? String(state.totalItems) : '';
      node.dataset.count = String(state.totalItems);
    });

    qsa('[data-cart-total]').forEach((node) => {
      node.textContent = money(state.total);
    });

    qsa('[data-cart-items-label]').forEach((node) => {
      node.textContent = state.totalItems === 1 ? 'פריט אחד' : `${state.totalItems} פריטים`;
    });

    if (mobileBar) {
      mobileBar.classList.toggle('is-visible', !state.isEmpty);
      document.body.classList.toggle('has-mobile-bar', !state.isEmpty);
      mobileBar.setAttribute('aria-hidden', state.isEmpty ? 'true' : 'false');
    }
  }

  /* ------------------------------------------------------------ פעולות -- */

  drawer.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const { action, id } = trigger.dataset;

    switch (action) {
      case 'inc':
        cart.setQty(id, cart.getQty(id) + 1);
        break;
      case 'dec':
        cart.setQty(id, cart.getQty(id) - 1);
        break;
      case 'remove': {
        const product = cart.getProduct(id);
        cart.remove(id);
        if (product) toast(`${product.name} הוסר מההזמנה`);
        break;
      }
      case 'close-cart':
        close();
        break;
      case 'checkout':
        close();
        onCheckout?.();
        break;
      default:
        break;
    }
  });

  cart.subscribe(paint);
  paint(cart.getState());

  return { open, close };
}
