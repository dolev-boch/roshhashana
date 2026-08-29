/**
 * availability.service.js
 * ---------------------------------------------------------------------------
 * כל הלוגיקה של "מתי אפשר לאסוף" נמצאת כאן בלבד.
 * הלוח והשעות רק מציגים את מה שהשירות הזה מחזיר — שינוי מדיניות
 * (ימים סגורים, זמן הכנה, שעות) מתבצע ב-config.js ומתפשט אוטומטית.
 * ---------------------------------------------------------------------------
 */

import { CONFIG } from '../config.js';
import { toISODate, fromISODate } from '../lib/format.js';

const { pickup } = CONFIG;

/** תחילת היום הנוכחי לפי שעון המכשיר */
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** התאריך המוקדם ביותר שאפשר לאסוף בו, בהתחשב בזמן ההכנה */
export function earliestPickupDate() {
  const ready = new Date(Date.now() + pickup.leadTimeHours * 60 * 60 * 1000);
  const readyDay = new Date(ready.getFullYear(), ready.getMonth(), ready.getDate());
  const windowStart = fromISODate(pickup.startDate);
  return readyDay > windowStart ? readyDay : windowStart;
}

export function lastPickupDate() {
  return fromISODate(pickup.endDate);
}

/** האם התאריך פתוח לאיסוף */
export function isDateAvailable(date) {
  const day = date instanceof Date ? date : fromISODate(date);
  const iso = toISODate(day);

  if (pickup.closedWeekdays.includes(day.getDay())) return false;
  if (pickup.closedDates.includes(iso)) return false;
  if (day < earliestPickupDate()) return false;
  if (day > lastPickupDate()) return false;
  if (getSlots(iso).length === 0) return false;

  return true;
}

/** סיבת החסימה — משמשת ל-aria-label נגיש בלוח */
export function unavailableReason(date) {
  const day = date instanceof Date ? date : fromISODate(date);
  if (pickup.closedWeekdays.includes(day.getDay())) return 'סגור';
  if (pickup.closedDates.includes(toISODate(day))) return 'סגור';
  if (day < earliestPickupDate()) return 'לא זמין להזמנה';
  if (day > lastPickupDate()) return 'מחוץ לתקופת האיסוף';
  return 'לא זמין';
}

/** שעות האיסוף לתאריך נתון */
export function getSlots(iso) {
  const date = fromISODate(iso);
  if (pickup.slotsByDate[iso]) return [...pickup.slotsByDate[iso]];
  const byWeekday = pickup.slots[date.getDay()];
  return [...(byWeekday ?? pickup.slots.default ?? [])];
}

/** התאריך הזמין הראשון — לפתיחת הלוח במקום הנכון */
export function firstAvailableDate() {
  const cursor = new Date(earliestPickupDate());
  const end = lastPickupDate();

  while (cursor <= end) {
    if (isDateAvailable(cursor)) return new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/** טווח החודשים שהלוח רשאי להציג */
export function monthBounds() {
  const from = earliestPickupDate();
  const to = lastPickupDate();
  return {
    min: new Date(from.getFullYear(), from.getMonth(), 1),
    max: new Date(to.getFullYear(), to.getMonth(), 1),
  };
}

/** האם חלון ההזמנות עדיין פתוח */
export function isOrderingOpen() {
  const deadline = fromISODate(CONFIG.campaign.ordersCloseOn);
  return startOfToday() <= deadline && firstAvailableDate() !== null;
}
