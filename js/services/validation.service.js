/**
 * validation.service.js
 * ---------------------------------------------------------------------------
 * כללי ולידציה מוצהרים. הוספת שדה = הוספת רשומה ל-RULES, ללא שינוי בקוד הטופס.
 * ---------------------------------------------------------------------------
 */

import { digitsOnly } from '../lib/format.js';

/** נייד ישראלי: 05X ואחריו 7 ספרות. מקבל גם קידומת בינלאומית. */
const MOBILE_RE = /^(?:972|0)?5\d{8}$/;

/** בדיקת אימייל מעשית — לא מנסה לכסות את כל RFC 5322 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export const RULES = {
  fullName: {
    label: 'שם מלא',
    validate(value) {
      const trimmed = String(value).trim();
      if (!trimmed) return 'נא למלא שם מלא';
      if (trimmed.length < 2) return 'השם קצר מדי';
      if (!/[\u0590-\u05FFa-zA-Z]/.test(trimmed)) return 'נא להזין שם תקין';
      return null;
    },
    normalize: (value) => String(value).trim().replace(/\s+/g, ' '),
  },

  phone: {
    label: 'טלפון נייד',
    validate(value) {
      const digits = digitsOnly(value);
      if (!digits) return 'נא למלא מספר טלפון נייד';
      if (!MOBILE_RE.test(digits)) return 'מספר הנייד אינו תקין (לדוגמה 0521234567)';
      return null;
    },
    normalize(value) {
      const digits = digitsOnly(value);
      return digits.startsWith('972') ? `0${digits.slice(3)}` : digits;
    },
  },

  email: {
    label: 'כתובת מייל',
    validate(value) {
      const trimmed = String(value).trim();
      if (!trimmed) return 'נא למלא כתובת מייל';
      if (!EMAIL_RE.test(trimmed)) return 'כתובת המייל אינה תקינה';
      return null;
    },
    normalize: (value) => String(value).trim().toLowerCase(),
  },

  notes: {
    label: 'הערות',
    optional: true,
    validate(value) {
      if (String(value).length > 400) return 'ההערה ארוכה מדי';
      return null;
    },
    normalize: (value) => String(value).trim(),
  },
};

/**
 * אימות אובייקט שלם.
 * @returns {{ valid: boolean, errors: Object<string,string>, values: Object }}
 */
export function validate(data, fields = Object.keys(RULES)) {
  const errors = {};
  const values = {};

  for (const field of fields) {
    const rule = RULES[field];
    if (!rule) continue;

    const raw = data[field] ?? '';
    const message = rule.validate(raw);
    if (message) errors[field] = message;
    values[field] = rule.normalize ? rule.normalize(raw) : raw;
  }

  return { valid: Object.keys(errors).length === 0, errors, values };
}

/** אימות שדה בודד — לשימוש באירוע blur */
export function validateField(field, value) {
  const rule = RULES[field];
  if (!rule) return null;
  return rule.validate(value ?? '');
}
