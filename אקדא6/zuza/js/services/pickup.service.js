/**
 * pickup.service.js
 * ---------------------------------------------------------------------------
 * כל הלוגיקה של האיסוף: הסניפים, מועד האיסוף, וחלון ההזמנות.
 *
 * מודל האיסוף הוא סניף ומועד קבוע — ולא בחירת תאריך מלוח שנה.
 * כל שינוי בסניפים או במועד מתבצע ב-config.js בלבד.
 * ---------------------------------------------------------------------------
 */

import { CONFIG } from '../config.js';
import { fromISODate, longDate, toISODate } from '../lib/format.js';

const { pickup, campaign } = CONFIG;

/** רשימת הסניפים */
export function getBranches() {
  return pickup.branches.map((branch) => ({ ...branch }));
}

/** סניף לפי מזהה, או null */
export function findBranch(id) {
  return pickup.branches.find((branch) => branch.id === id) ?? null;
}

/** מועד האיסוף בפורמט ISO */
export function pickupDate() {
  return pickup.date;
}

/** מועד האיסוף כטקסט מלא בעברית */
export function pickupDateLong() {
  return longDate(pickup.date);
}

/** מועד האיסוף בפורמט קצר להצגה */
export function pickupDateDisplay() {
  return pickup.dateDisplay;
}

/** תיאור מלא של סניף, לשימוש במיילים ובסיכומים */
export function describeBranch(branch) {
  // סניף חסר מחזיר מחרוזת ריקה, ולא טקסט עם undefined שיגיע למייל ולגיליון
  if (!branch || !branch.name) return '';
  return [branch.name, branch.address, branch.hours].filter(Boolean).join(' · ');
}

/**
 * האם עדיין נקלטות הזמנות.
 * נסגר בסוף היום שהוגדר ב-campaign.ordersCloseOn.
 */
export function isOrderingOpen() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return toISODate(today) <= campaign.ordersCloseOn;
}

/** תאריך סגירת ההזמנות כטקסט */
export function ordersCloseLong() {
  return longDate(fromISODate(campaign.ordersCloseOn));
}
