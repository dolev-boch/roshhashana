/**
 * dom.js — עזרי DOM מינימליים.
 * מטרה: קוד תצוגה קריא בלי תלות בספריות חיצוניות.
 */

export const qs = (selector, scope = document) => scope.querySelector(selector);

export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/**
 * יצירת אלמנט עם מאפיינים וילדים.
 * @param {string} tag
 * @param {Object} [attrs] - מאפיינים. `class`, `text`, `html`, `dataset`, `on` נתמכים.
 * @param {Array<Node|string>} [children]
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') {
      node.className = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key === 'on') {
      for (const [evt, handler] of Object.entries(value)) node.addEventListener(evt, handler);
    } else if (key in node && typeof value !== 'object' && !key.startsWith('aria-')) {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

/** האזנה עם החזרת פונקציית ניתוק — מונע דליפות מאזינים */
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/** האזנה מואצלת — יעיל לרשימות דינמיות */
export function delegate(root, type, selector, handler) {
  return on(root, type, (event) => {
    const match = event.target.closest(selector);
    if (match && root.contains(match)) handler(event, match);
  });
}

/** בריחה מתווי HTML — כל טקסט ממקור נתונים עובר דרך כאן */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

/** שכפול תבנית <template> והחזרת האלמנט הראשון */
export function fromTemplate(id) {
  const tpl = document.getElementById(id);
  if (!tpl) throw new Error(`Template not found: ${id}`);
  return tpl.content.firstElementChild.cloneNode(true);
}

/** החלפת תוכן אלמנט בבת אחת (מפחית reflow) */
export function render(container, nodes) {
  const fragment = document.createDocumentFragment();
  fragment.append(...[].concat(nodes).filter(Boolean));
  container.replaceChildren(fragment);
}
