/**
 * cart.store.js
 * ---------------------------------------------------------------------------
 * מצב העגלה. מקור אמת יחיד, נשמר בדפדפן ומשדר אירוע 'change' בכל עדכון.
 * רכיבי התצוגה נרשמים לאירוע ומציירים את עצמם מחדש — אין להם מצב משלהם.
 * ---------------------------------------------------------------------------
 */

import { CONFIG } from '../config.js';
import { PRODUCTS } from '../data/products.js';
import { storage, createEmitter } from '../lib/ui-kit.js';

const { storageKey, maxQtyPerItem } = CONFIG.ui;

const emitter = createEmitter();

/** @type {Map<string, number>} מזהה מוצר -> כמות */
let lines = new Map();

const productIndex = new Map(PRODUCTS.map((product) => [product.id, product]));

/* ---------------------------------------------------------------- פנימי -- */

function persist() {
  storage.set(storageKey, Array.from(lines.entries()));
}

function notify(meta = {}) {
  persist();
  emitter.emit('change', { ...getState(), ...meta });
}

function clampQty(qty) {
  return Math.max(0, Math.min(maxQtyPerItem, Math.floor(Number(qty) || 0)));
}

/* ------------------------------------------------------------- ציבורי -- */

/** טעינת מצב שמור. מסנן מוצרים שכבר לא קיימים בקטלוג. */
export function hydrate() {
  const saved = storage.get(storageKey, []);
  if (!Array.isArray(saved)) return;

  lines = new Map(
    saved
      .filter(([id, qty]) => productIndex.has(id) && clampQty(qty) > 0)
      .filter(([id]) => productIndex.get(id).available !== false)
      .map(([id, qty]) => [id, clampQty(qty)]),
  );

  notify({ reason: 'hydrate' });
}

export function getProduct(id) {
  return productIndex.get(id) ?? null;
}

/** מצב מלא ומחושב — כולל שורות מועשרות וסכומים */
export function getState() {
  const items = Array.from(lines.entries()).map(([id, qty]) => {
    const product = productIndex.get(id);
    return {
      id,
      qty,
      product,
      lineTotal: product.price * qty,
    };
  });

  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    items,
    totalItems,
    subtotal,
    total: subtotal,
    isEmpty: items.length === 0,
  };
}

export function getQty(id) {
  return lines.get(id) ?? 0;
}

export function add(id, qty = 1) {
  const product = productIndex.get(id);
  if (!product || product.available === false) return false;

  const next = clampQty(getQty(id) + qty);
  if (next === 0) return false;

  lines.set(id, next);
  notify({ reason: 'add', id, qty: next });
  return true;
}

export function setQty(id, qty) {
  if (!productIndex.has(id)) return;

  const next = clampQty(qty);
  if (next === 0) {
    remove(id);
    return;
  }

  lines.set(id, next);
  notify({ reason: 'update', id, qty: next });
}

export function remove(id) {
  if (!lines.delete(id)) return;
  notify({ reason: 'remove', id });
}

export function clear() {
  if (lines.size === 0) return;
  lines.clear();
  notify({ reason: 'clear' });
}

/** הרשמה לשינויים. מחזירה פונקציית ביטול. */
export const subscribe = (handler) => emitter.on('change', handler);
