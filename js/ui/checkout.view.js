/**
 * checkout.view.js
 * ---------------------------------------------------------------------------
 * תהליך ההזמנה בשלושה שלבים: פרטים → מועד איסוף → אישור.
 * כל שלב הוא פאנל עצמאי; הוספה או הסרה של שלב נעשית דרך מערך STEPS.
 * ---------------------------------------------------------------------------
 */

import { el, qs, qsa, render } from '../lib/dom.js';
import { money, longDate, phoneDisplay } from '../lib/format.js';
import { scrollLock, trapFocus, sleep } from '../lib/ui-kit.js';
import { validate, validateField } from '../services/validation.service.js';
import { buildOrder, submitOrder, openWhatsApp } from '../services/order.service.js';
import { createDatePicker } from './datepicker.js';
import { createBrandLoader } from './preloader.js';
import * as cart from '../state/cart.store.js';
import { toast } from './toast.js';

const STEPS = [
  { id: 'details', label: 'פרטים' },
  { id: 'pickup', label: 'מועד איסוף' },
  { id: 'review', label: 'אישור' },
];

const checkIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;

export function initCheckout({ onComplete } = {}) {
  const modal = qs('#checkout-modal');
  if (!modal) return { open: () => {} };

  const panel = qs('.modal__panel', modal);
  const stepsBar = qs('#checkout-steps', modal);
  const body = qs('#checkout-body', modal);
  const foot = qs('#checkout-foot', modal);
  const titleNode = qs('#checkout-title', modal);

  let stepIndex = 0;
  let datePicker = null;
  let releaseFocus = null;
  let submitting = false;
  let lastOrder = null;

  const state = {
    customer: {
      fullName: '',
      phone: '',
      email: '',
      notes: '',
      /*
       * חוק התקשורת (תיקון 40) מחייב הסכמה מפורשת ומראש לפני משלוח דבר פרסומת.
       * ברירת המחדל היא לא מסומן — הסכמה חייבת להיות פעולה אקטיבית של הלקוח.
       * ללא סימון, המערכת לא תשלח מייל אישור ללקוח.
       */
      emailConsent: false,
    },
    pickup: { date: null, time: null },
  };

  /* ------------------------------------------------------- שלב: פרטים -- */

  function field({ name, label, type = 'text', placeholder, hint, autocomplete, ltr, optional, textarea }) {
    const control = textarea
      ? el('textarea', {
          class: 'field__control',
          id: `f-${name}`,
          name,
          rows: 3,
          placeholder: placeholder ?? '',
        })
      : el('input', {
          class: `field__control${ltr ? ' field__control--ltr' : ''}`,
          id: `f-${name}`,
          name,
          type,
          placeholder: placeholder ?? '',
          autocomplete: autocomplete ?? 'on',
          inputmode: type === 'tel' ? 'tel' : type === 'email' ? 'email' : 'text',
          enterkeyhint: 'next',
        });

    control.value = state.customer[name] ?? '';
    control.setAttribute('aria-describedby', `err-${name}`);
    if (!optional) control.setAttribute('aria-required', 'true');

    const wrapper = el('div', { class: 'field', dataset: { field: name } }, [
      el('label', { class: 'field__label', for: `f-${name}` }, [
        label,
        optional ? null : el('span', { class: 'req', 'aria-hidden': 'true', text: '*' }),
      ]),
      control,
      hint ? el('p', { class: 'field__hint', text: hint }) : null,
      el('p', { class: 'field__error', id: `err-${name}`, role: 'alert' }),
    ]);

    control.addEventListener('input', () => {
      state.customer[name] = control.value;
      if (wrapper.classList.contains('has-error')) clearFieldError(wrapper);
    });

    control.addEventListener('blur', () => {
      const message = validateField(name, control.value);
      if (message) setFieldError(wrapper, message);
    });

    return wrapper;
  }

  function setFieldError(wrapper, message) {
    wrapper.classList.add('has-error');
    qs('.field__error', wrapper).textContent = message;
    qs('.field__control', wrapper).setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(wrapper) {
    wrapper.classList.remove('has-error');
    qs('.field__error', wrapper).textContent = '';
    qs('.field__control', wrapper).removeAttribute('aria-invalid');
  }

  /** תיבת הסכמה למשלוח אישור ההזמנה במייל */
  function consentField() {
    const input = el('input', {
      class: 'checkbox__input',
      id: 'f-emailConsent',
      name: 'emailConsent',
      type: 'checkbox',
    });
    input.checked = Boolean(state.customer.emailConsent);
    input.addEventListener('change', () => {
      state.customer.emailConsent = input.checked;
    });

    return el('label', { class: 'checkbox', for: 'f-emailConsent' }, [
      input,
      el('span', { class: 'checkbox__box', 'aria-hidden': 'true' }),
      el('span', { class: 'checkbox__text' }, [
        el('span', { class: 'checkbox__title', text: 'שלחו לי אישור הזמנה במייל' }),
        el('span', {
          class: 'checkbox__hint',
          text: 'סיכום ההזמנה ומועד האיסוף יישלחו לכתובת שמילאתם. ללא סימון לא יישלח מייל.',
        }),
      ]),
    ]);
  }

  function renderDetails() {
    return el('div', { class: 'form-grid' }, [
      field({
        name: 'fullName',
        label: 'שם מלא',
        autocomplete: 'name',
        placeholder: 'שם פרטי ומשפחה',
      }),
      el('div', { class: 'form-grid form-grid--2' }, [
        field({
          name: 'phone',
          label: 'טלפון נייד',
          type: 'tel',
          autocomplete: 'tel',
          placeholder: '0521234567',
          ltr: true,
          hint: 'נעדכן בהודעה כשההזמנה מוכנה',
        }),
        field({
          name: 'email',
          label: 'כתובת מייל',
          type: 'email',
          autocomplete: 'email',
          placeholder: 'name@example.com',
          ltr: true,
        }),
      ]),
      field({
        name: 'notes',
        label: 'הערות להזמנה',
        optional: true,
        textarea: true,
        placeholder: 'אלרגיות, בקשות מיוחדות או כיתוב על העוגה',
      }),
      consentField(),
    ]);
  }

  function validateDetails() {
    const { valid, errors, values } = validate(state.customer, ['fullName', 'phone', 'email', 'notes']);

    qsa('[data-field]', body).forEach((wrapper) => {
      const name = wrapper.dataset.field;
      if (errors[name]) setFieldError(wrapper, errors[name]);
      else clearFieldError(wrapper);
    });

    if (valid) {
      Object.assign(state.customer, values);
    } else {
      const firstInvalid = qs('.field.has-error .field__control', body);
      firstInvalid?.focus();
      firstInvalid?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    return valid;
  }

  /* -------------------------------------------------- שלב: מועד איסוף -- */

  function renderPickup() {
    const mount = el('div');
    const describe = (selection) =>
      selection.date
        ? selection.time
          ? `נבחר: ${longDate(selection.date)} בשעה ${selection.time}`
          : `נבחר: ${longDate(selection.date)}. נותר לבחור שעה.`
        : 'בחרו תאריך ולאחר מכן שעת איסוף.';

    const summary = el('p', {
      class: 'field__hint',
      id: 'pickup-summary',
      role: 'status',
      text: describe(state.pickup),
    });

    const wrapper = el('div', { class: 'form-grid' }, [mount, summary]);

    // הרכבת הלוח נדחית עד שהאלמנט בעץ ה-DOM
    window.requestAnimationFrame(() => {
      datePicker = createDatePicker(mount, {
        initial: state.pickup,
        onChange: (selection) => {
          state.pickup = selection;
          summary.textContent = describe(selection);
          updateFooter();
        },
      });
    });

    return wrapper;
  }

  /* ------------------------------------------------------- שלב: אישור -- */

  function renderReview() {
    const snapshot = cart.getState();

    const itemsList = el(
      'dl',
      { class: 'review__list' },
      snapshot.items.flatMap((item) => [
        el('div', { class: 'review__item' }, [
          el('dt', { text: `${item.product.name} × ${item.qty}` }),
          el('dd', { class: 'num', text: money(item.lineTotal) }),
        ]),
      ]),
    );

    return el('div', { class: 'review' }, [
      el('div', { class: 'review__block' }, [
        el('p', { class: 'review__label', text: 'פרטי הלקוח' }),
        el('dl', { class: 'review__list' }, [
          el('div', { class: 'review__item' }, [
            el('dt', { text: 'שם' }),
            el('dd', { text: state.customer.fullName }),
          ]),
          el('div', { class: 'review__item' }, [
            el('dt', { text: 'טלפון' }),
            el('dd', { class: 'num', text: phoneDisplay(state.customer.phone) }),
          ]),
          el('div', { class: 'review__item' }, [
            el('dt', { text: 'מייל' }),
            el('dd', { class: 'ltr', text: state.customer.email }),
          ]),
          el('div', { class: 'review__item' }, [
            el('dt', { text: 'אישור במייל' }),
            el('dd', { text: state.customer.emailConsent ? 'כן' : 'לא נדרש' }),
          ]),
        ]),
      ]),

      el('div', { class: 'review__block' }, [
        el('p', { class: 'review__label', text: 'מועד איסוף' }),
        el('dl', { class: 'review__list' }, [
          el('div', { class: 'review__item' }, [
            el('dt', { text: 'תאריך' }),
            el('dd', { text: longDate(state.pickup.date) }),
          ]),
          el('div', { class: 'review__item' }, [
            el('dt', { text: 'שעה' }),
            el('dd', { class: 'num', text: state.pickup.time }),
          ]),
        ]),
      ]),

      el('div', { class: 'review__block' }, [
        el('p', { class: 'review__label', text: 'ההזמנה' }),
        itemsList,
        el('div', { class: 'summary summary--tight' }, [
          el('div', { class: 'summary__row summary__row--total' }, [
            el('span', { text: 'סה"כ' }),
            el('span', { class: 'summary__value num', text: money(snapshot.total) }),
          ]),
        ]),
      ]),

      state.customer.notes
        ? el('div', { class: 'review__block' }, [
            el('p', { class: 'review__label', text: 'הערות' }),
            el('p', { class: 'review__list', text: state.customer.notes }),
          ])
        : null,

      el('p', {
        class: 'field__hint',
        text: 'התשלום מתבצע במעמד האיסוף. נאשר את ההזמנה בהודעה חוזרת.',
      }),
    ]);
  }

  /* --------------------------------------------------------- הצלחה -- */

  /** נוסח ההסבר במסך ההצלחה, לפי ערוץ השליחה ומצב ההסכמה */
  function successNote(result) {
    if (!result?.ok) return 'לסיום, נא לשלוח לנו את סיכום ההזמנה בוואטסאפ.';
    if (state.customer.emailConsent) return 'אישור עם פרטי ההזמנה נשלח לכתובת המייל שמילאתם.';
    return 'ההזמנה נרשמה אצלנו. נשמח לראותכם בקונדיטוריה.';
  }

  function renderSuccess(order, result) {
    stepsBar.hidden = true;
    titleNode.textContent = 'ההזמנה נקלטה';

    const actions = el('div', { class: 'success__actions' }, [
      result?.url || result?.fallback?.url
        ? el('button', {
            class: 'btn btn--gold btn--lg',
            type: 'button',
            on: { click: () => openWhatsApp(result.url || result.fallback.url) },
            text: 'שליחת אישור בוואטסאפ',
          })
        : null,
      el('button', {
        class: 'btn btn--outline',
        type: 'button',
        on: { click: close },
        text: 'סגירה',
      }),
    ]);

    render(body, [
      el('div', { class: 'success' }, [
        el('span', { class: 'success__mark', 'aria-hidden': 'true', html: checkIcon }),
        el('h3', { class: 'success__title', text: `תודה, ${state.customer.fullName.split(' ')[0]}` }),
        el('p', {
          class: 'success__text',
          text: `ההזמנה התקבלה. האיסוף נקבע ל${longDate(order.pickup.date)} בשעה ${order.pickup.time}.`,
        }),
        el('p', { class: 'success__ref' }, [
          'מספר הזמנה: ',
          el('strong', { class: 'num', text: order.reference }),
        ]),
        el('p', {
          class: 'field__hint',
          text: successNote(result),
        }),
        actions,
      ]),
    ]);

    render(foot, []);
  }

  /* ----------------------------------------------------------- שליחה -- */

  async function handleSubmit(button) {
    if (submitting) return;
    submitting = true;
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');

    const snapshot = cart.getState();
    const order = buildOrder(snapshot, state.customer, state.pickup);
    lastOrder = order;

    // מחוון טעינה מותגי בזמן השליחה
    const loader = createBrandLoader({ inline: true });
    render(body, el('div', { class: 'success' }, [loader.node, el('p', { class: 'field__hint', text: 'שולחים את ההזמנה' })]));
    loader.start();

    const [result] = await Promise.all([submitOrder(order), sleep(700)]);
    loader.stop();

    if (!result.ok) {
      toast('השליחה נכשלה — אפשר להשלים בוואטסאפ', { type: 'error' });
    }

    cart.clear();
    renderSuccess(order, result);
    submitting = false;
    onComplete?.(order);
  }

  /* ------------------------------------------------------- ניווט שלבים -- */

  function paintSteps() {
    render(
      stepsBar,
      STEPS.map((step, index) =>
        el(
          'div',
          {
            class: `step${index === stepIndex ? ' is-active' : ''}${index < stepIndex ? ' is-done' : ''}`,
            'aria-current': index === stepIndex ? 'step' : null,
          },
          [
            el('span', { class: 'step__num', text: String(index + 1) }),
            el('span', { class: 'step__label', text: step.label }),
            el('span', { class: 'step__line', 'aria-hidden': 'true' }),
          ],
        ),
      ),
    );
  }

  function updateFooter() {
    const isLast = stepIndex === STEPS.length - 1;

    const back = el('button', {
      class: 'btn btn--ghost',
      type: 'button',
      text: stepIndex === 0 ? 'חזרה לתפריט' : 'הקודם',
      on: {
        click: () => {
          if (stepIndex === 0) close();
          else goTo(stepIndex - 1);
        },
      },
    });

    const next = el('button', {
      class: 'btn btn--gold btn--lg',
      type: 'button',
      text: isLast ? 'שליחת ההזמנה' : 'המשך',
      on: {
        click: (event) => {
          if (isLast) handleSubmit(event.currentTarget);
          else if (stepIndex === 0 && validateDetails()) goTo(1);
          else if (stepIndex === 1) {
            if (state.pickup.date && state.pickup.time) goTo(2);
            else toast('נא לבחור תאריך ושעת איסוף', { type: 'error' });
          }
        },
      },
    });

    const pickupReady = datePicker ? datePicker.isComplete() : Boolean(state.pickup.date && state.pickup.time);

    if (stepIndex === 1 && !pickupReady) {
      next.setAttribute('aria-disabled', 'true');
      next.disabled = true;
    }

    render(foot, [back, next]);
  }

  function goTo(index) {
    stepIndex = index;
    const step = STEPS[index];

    titleNode.textContent = `${step.label} · שלב ${index + 1} מתוך ${STEPS.length}`;
    stepsBar.hidden = false;
    paintSteps();

    if (step.id === 'details') render(body, renderDetails());
    if (step.id === 'pickup') render(body, renderPickup());
    if (step.id === 'review') render(body, renderReview());

    updateFooter();
    body.scrollTop = 0;
  }

  /* ------------------------------------------------------ פתיחה/סגירה -- */

  function open() {
    if (cart.getState().isEmpty) {
      toast('ההזמנה ריקה — נא להוסיף פריטים מהתפריט', { type: 'error' });
      return;
    }

    stepIndex = 0;
    datePicker = null;
    state.pickup = { date: null, time: null };
    // ההסכמה נדרשת מחדש בכל הזמנה — היא אינה נשמרת בין הזמנות
    state.customer.emailConsent = false;

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    scrollLock.lock();
    goTo(0);
    releaseFocus = trapFocus(panel, { initialFocus: qs('#f-fullName', body) });
  }

  function close() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    scrollLock.unlock();
    releaseFocus?.();
    releaseFocus = null;
  }

  qsa('[data-close-checkout]', modal).forEach((node) => node.addEventListener('click', close));

  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open') && !submitting) close();
  });

  // שליחת טופס במקלדת (Enter) לא תרענן את העמוד
  body.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
      event.preventDefault();
      qs('.btn--gold', foot)?.click();
    }
  });

  return { open, close, getLastOrder: () => lastOrder };
}
