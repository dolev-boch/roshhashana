/**
 * menu.view.js
 * ---------------------------------------------------------------------------
 * ציור התפריט מתוך data/products.js, במבנה של תפריט מודפס:
 * עמודה אחת, שם המנה מצד אחד והמחיר מצד שני, קו נקודות ביניהם,
 * ומפריד מנוקד בין המנות.
 *
 * אזור הפעולה של כל פריט מתחלף בהתאם למצב העגלה: כפתור "הוספה"
 * כשהכמות אפס, ובורר כמות כשהפריט כבר בהזמנה. הרכיב אינו מחזיק מצב —
 * הוא נרשם לשינויים בחנות ומצייר מחדש רק את השורות שהשתנו.
 * ---------------------------------------------------------------------------
 */

import { el, render, qs } from '../lib/dom.js';
import { money } from '../lib/format.js';
import { CATEGORIES, PRODUCTS } from '../data/products.js';
import { imageFor, srcSetFor, attachImageFallback } from '../services/media.service.js';
import * as cart from '../state/cart.store.js';
import { toast } from './toast.js';
import { CONFIG } from '../config.js';

/** מפת מזהה מוצר -> אלמנט אזור הפעולה, לעדכון ממוקד */
const actionSlots = new Map();

/* --------------------------------------------------------------- חלקים -- */

function ruleNode() {
  return el('span', { class: 'rule', 'aria-hidden': 'true' }, [el('span', { class: 'rule__mark' })]);
}

function media(product) {
  /*
   * שתי בקרות אופציונליות לכל מוצר, לשליטה בתמונות שאינן ריבועיות:
   *   fit: 'contain'  — התמונה כולה נכנסת לתיבה, בלי שום חיתוך.
   *   focus: 'top'    — נקודת העניין בתמונה, כשהחיתוך מקצץ את החלק הלא נכון.
   * ללא הגדרה: מילוי התיבה ממורכז, שזה הנכון לתמונה ריבועית.
   */
  const contain = product.fit === 'contain';

  const img = el('img', {
    class: `menu-item__img${contain ? ' menu-item__img--contain' : ''}`,
    src: imageFor(product, 800),
    alt: product.alt || product.name,
    loading: 'lazy',
    decoding: 'async',
    // היחס נשמר גם לפני שהתמונה נטענת, כדי שהפריסה לא תקפוץ
    // תואם ליחס תיבת התמונה (4:5), כדי שהפריסה לא תקפוץ לפני הטעינה
    width: 800,
    height: 1000,
    /*
     * בנייד התמונה תופסת את רוחב העמודה כולה, בדסקטופ עמודה של 268px.
     * sizes מאפשר לדפדפן לבחור את הקובץ הנכון עוד לפני חישוב הפריסה.
     */
    /*
     * רוחב התמונה מוגבל ל---media-max (250px) בכל המסכים,
     * ולכן זהו הרוחב שהדפדפן צריך להביא. במסך צר במיוחד נלקח רוחב המסך.
     */
    sizes: '(max-width: 20em) 88vw, 250px',
  });

  if (product.focus) img.style.objectPosition = product.focus;

  const srcset = srcSetFor(product);
  if (srcset) img.setAttribute('srcset', srcset);

  attachImageFallback(img);
  return el('div', { class: 'menu-item__media' }, [img]);
}

function head(product) {
  return el('div', { class: 'menu-item__head' }, [
    el('h3', { class: 'menu-item__name' }, [
      el('span', { text: product.name }),
      product.badge
        ? el('span', { class: 'badge menu-item__badge', text: product.badge })
        : null,
      product.note ? el('span', { class: 'menu-item__note', text: product.note }) : null,
    ]),
    el('span', { class: 'menu-item__leader', 'aria-hidden': 'true' }),
    el('span', { class: 'menu-item__price' }, [
      el('span', { text: String(product.price) }),
      el('span', { class: 'currency', text: CONFIG.ui.currency }),
    ]),
  ]);
}

/** בורר כמות המוצג כשהפריט כבר בהזמנה */
function stepper(product, qty) {
  return el('div', { class: 'stepper stepper--sm' }, [
    el('button', {
      class: 'stepper__btn',
      type: 'button',
      dataset: { action: 'dec', id: product.id },
      'aria-label': `הפחתת כמות של ${product.name}`,
      text: '−',
    }),
    el('span', {
      class: 'stepper__value',
      'aria-live': 'polite',
      'aria-label': `כמות של ${product.name}`,
      text: String(qty),
    }),
    el('button', {
      class: 'stepper__btn',
      type: 'button',
      dataset: { action: 'inc', id: product.id },
      'aria-label': `הגדלת כמות של ${product.name}`,
      text: '+',
    }),
  ]);
}

/** תוכן אזור הפעולה לפי מצב העגלה */
function actionContent(product) {
  if (product.available === false) {
    return [el('span', { class: 'badge badge--muted', text: 'אזל מהמלאי' })];
  }

  const qty = cart.getQty(product.id);

  if (qty > 0) {
    return [
      stepper(product, qty),
      el('span', {
        class: 'cart-line__unit',
        text: `סה"כ ${money(product.price * qty)}`,
      }),
    ];
  }

  return [
    el('button', {
      class: 'add-btn',
      type: 'button',
      dataset: { action: 'add', id: product.id },
      'aria-label': `הוספת ${product.name} להזמנה`,
    }, [el('span', { class: 'add-btn__plus', 'aria-hidden': 'true', text: '+' }), 'הוספה להזמנה']),
  ];
}

function menuItem(product) {
  const foot = el('div', { class: 'menu-item__foot' }, actionContent(product));
  actionSlots.set(product.id, foot);

  return el(
    'article',
    {
      class: `menu-item${product.available === false ? ' is-out' : ''}`,
      dataset: { product: product.id },
    },
    [
      media(product),
      el('div', { class: 'menu-item__body' }, [
        head(product),
        product.desc ? el('p', { class: 'menu-item__desc', text: product.desc }) : null,
        foot,
      ]),
    ],
  );
}

function categorySection(category) {
  const items = PRODUCTS.filter((product) => product.category === category.id);
  if (items.length === 0) return null;

  return el('section', { class: 'menu-category', 'aria-labelledby': `cat-${category.id}` }, [
    el('header', { class: 'section-head' }, [
      ruleNode(),
      el('h2', { class: 'section-head__title', id: `cat-${category.id}`, text: category.title }),
      category.caption ? el('p', { class: 'section-head__caption', text: category.caption }) : null,
    ]),
    el('div', { class: 'menu-grid' }, items.map(menuItem)),
  ]);
}

/* ---------------------------------------------------------------- ציבורי -- */

export function initMenu({ onAdd } = {}) {
  const root = qs('#menu-root');
  if (!root) return;

  actionSlots.clear();
  render(root, CATEGORIES.map(categorySection).filter(Boolean));

  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const product = cart.getProduct(trigger.dataset.id);
    if (!product) return;

    const qty = cart.getQty(product.id);

    switch (trigger.dataset.action) {
      case 'add':
        cart.add(product.id, 1);
        toast(`${product.name} נוסף להזמנה`);
        onAdd?.(product);
        break;
      case 'inc':
        if (qty >= CONFIG.ui.maxQtyPerItem) {
          toast('הגעתם לכמות המרבית לפריט זה', { type: 'error' });
          return;
        }
        cart.setQty(product.id, qty + 1);
        break;
      case 'dec':
        cart.setQty(product.id, qty - 1);
        break;
      default:
        break;
    }
  });

  // עדכון ממוקד: רק אזור הפעולה מצויר מחדש, לא כל התפריט
  cart.subscribe(() => {
    for (const [id, slot] of actionSlots) {
      const product = cart.getProduct(id);
      if (product) render(slot, actionContent(product));
    }
  });
}
