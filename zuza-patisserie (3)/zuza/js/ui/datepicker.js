/**
 * datepicker.js
 * ---------------------------------------------------------------------------
 * לוח שנה בעברית, RTL, נגיש למקלדת.
 * הרכיב אינו מכיר את כללי הזמינות — הוא שואל את availability.service,
 * כך שכל שינוי מדיניות מתבצע ב-config.js בלבד.
 * ---------------------------------------------------------------------------
 */

import { el, render } from '../lib/dom.js';
import {
  HEBREW_WEEKDAYS,
  HEBREW_WEEKDAYS_SHORT,
  monthLabel,
  toISODate,
  fromISODate,
  longDate,
} from '../lib/format.js';
import {
  isDateAvailable,
  unavailableReason,
  getSlots,
  firstAvailableDate,
  monthBounds,
} from '../services/availability.service.js';

const chevron = (direction) => {
  const path = direction === 'prev' ? 'M9 4l7 8-7 8' : 'M15 4l-7 8 7 8';
  return el('span', {
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`,
  });
};

/**
 * @param {HTMLElement} mount
 * @param {{ onChange?: (selection: {date: string|null, time: string|null}) => void }} options
 */
export function createDatePicker(mount, { onChange, initial = {} } = {}) {
  const bounds = monthBounds();
  const fallback = firstAvailableDate();

  // בחירה קיימת נשמרת כשחוזרים לשלב הזה
  let selectedDate = initial.date ?? null;
  let selectedTime = initial.time ?? null;

  const anchor = selectedDate ? fromISODate(selectedDate) : fallback;
  let viewMonth = anchor ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : new Date(bounds.min);

  /* ------------------------------------------------------------ שלד -- */

  const monthTitle = el('h4', { class: 'calendar__month', 'aria-live': 'polite' });

  const prevBtn = el(
    'button',
    {
      class: 'calendar__nav',
      type: 'button',
      'aria-label': 'החודש הקודם',
      on: { click: () => shiftMonth(-1) },
    },
    [chevron('prev')],
  );

  const nextBtn = el(
    'button',
    {
      class: 'calendar__nav',
      type: 'button',
      'aria-label': 'החודש הבא',
      on: { click: () => shiftMonth(1) },
    },
    [chevron('next')],
  );

  const grid = el('div', {
    class: 'calendar__grid',
    role: 'grid',
    'aria-label': 'בחירת תאריך איסוף',
  });

  const weekdaysRow = el(
    'div',
    { class: 'calendar__weekdays', 'aria-hidden': 'true' },
    HEBREW_WEEKDAYS_SHORT.map((day) => el('span', { class: 'calendar__weekday', text: day })),
  );

  const calendar = el('div', { class: 'calendar' }, [
    el('div', { class: 'calendar__head' }, [prevBtn, monthTitle, nextBtn]),
    weekdaysRow,
    grid,
    el('p', {
      class: 'calendar__legend',
      text: 'ימי שבת סגורים. ניתן לבחור רק בתאריכים הזמינים.',
    }),
  ]);

  const slotsTitle = el('h4', { class: 'slots-block__title' });
  const slotsGrid = el('div', { class: 'slots' });
  const slotsBlock = el('div', { class: 'slots-block', hidden: true }, [slotsTitle, slotsGrid]);

  render(mount, [calendar, slotsBlock]);

  /* --------------------------------------------------------- לוגיקה -- */

  function emit() {
    onChange?.({ date: selectedDate, time: selectedTime });
  }

  function shiftMonth(delta) {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1);
    if (next < bounds.min || next > bounds.max) return;
    viewMonth = next;
    paintMonth();
  }

  function focusDate(iso) {
    const node = grid.querySelector(`[data-date="${iso}"]`);
    if (node) {
      node.focus();
      return true;
    }
    return false;
  }

  /** ניווט במקלדת. ב-RTL חץ ימינה מתקדם אחורה בזמן. */
  function handleKeydown(event, iso) {
    const map = {
      ArrowRight: -1,
      ArrowLeft: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (!(event.key in map)) return;
    event.preventDefault();

    const target = fromISODate(iso);
    target.setDate(target.getDate() + map[event.key]);

    const targetIso = toISODate(target);
    if (focusDate(targetIso)) return;

    // חצייה לחודש אחר
    const targetMonth = new Date(target.getFullYear(), target.getMonth(), 1);
    if (targetMonth >= bounds.min && targetMonth <= bounds.max) {
      viewMonth = targetMonth;
      paintMonth();
      focusDate(targetIso);
    }
  }

  function dayCell(date) {
    const iso = toISODate(date);
    const available = isDateAvailable(date);
    const isSelected = iso === selectedDate;

    const cell = el('button', {
      class: 'calendar__day',
      type: 'button',
      role: 'gridcell',
      dataset: { date: iso, state: available ? 'available' : 'disabled' },
      'aria-pressed': String(isSelected),
      'aria-label': available
        ? longDate(date)
        : `${longDate(date)} — ${unavailableReason(date)}`,
      tabindex: available ? '0' : '-1',
      text: String(date.getDate()),
    });

    if (!available) {
      cell.disabled = true;
      return cell;
    }

    cell.addEventListener('click', () => selectDate(iso));
    cell.addEventListener('keydown', (event) => handleKeydown(event, iso));
    return cell;
  }

  function paintMonth() {
    monthTitle.textContent = monthLabel(viewMonth);

    prevBtn.disabled = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1) < bounds.min;
    nextBtn.disabled = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1) > bounds.max;

    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(el('span', { class: 'calendar__day', dataset: { state: 'empty' }, 'aria-hidden': 'true' }));
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(dayCell(new Date(year, month, day)));
    }

    render(grid, cells);
  }

  function paintSlots() {
    if (!selectedDate) {
      slotsBlock.hidden = true;
      return;
    }

    const slots = getSlots(selectedDate);
    const date = fromISODate(selectedDate);

    slotsTitle.textContent = `שעת איסוף · יום ${HEBREW_WEEKDAYS[date.getDay()]}`;
    slotsBlock.hidden = false;

    render(
      slotsGrid,
      slots.map((time) => {
        const button = el('button', {
          class: 'slot',
          type: 'button',
          dataset: { time },
          'aria-pressed': String(time === selectedTime),
          'aria-label': `איסוף בשעה ${time}`,
          text: time,
        });
        button.addEventListener('click', () => selectTime(time));
        return button;
      }),
    );
  }

  function selectDate(iso) {
    selectedDate = iso;
    selectedTime = null;
    paintMonth();
    paintSlots();
    emit();

    // גלילה עדינה אל בחירת השעה בנייד
    window.requestAnimationFrame(() => {
      slotsBlock.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function selectTime(time) {
    selectedTime = time;
    paintSlots();
    emit();
  }

  paintMonth();
  paintSlots();

  /* --------------------------------------------------------- ממשק -- */

  return {
    getSelection: () => ({ date: selectedDate, time: selectedTime }),
    isComplete: () => Boolean(selectedDate && selectedTime),
    reset() {
      selectedDate = null;
      selectedTime = null;
      const first = firstAvailableDate();
      viewMonth = first ? new Date(first.getFullYear(), first.getMonth(), 1) : new Date(bounds.min);
      paintMonth();
      paintSlots();
      emit();
    },
  };
}
