/**
 * checkout.view.js
 * ---------------------------------------------------------------------------
 * תהליך ההזמנה בשלושה שלבים: פרטים → מועד איסוף → אישור.
 * כל שלב הוא פאנל עצמאי; הוספה או הסרה של שלב נעשית דרך מערך STEPS.
 * ---------------------------------------------------------------------------
 */

import { el, qs, qsa, render } from '../lib/dom.js';
import { money, phoneDisplay } from '../lib/format.js';
import { scrollLock, trapFocus, sleep } from '../lib/ui-kit.js';
import { validate, validateField } from '../services/validation.service.js';
import { buildOrder, submitOrder } from '../services/order.service.js';
import { getBranches, findBranch, pickupDateLong } from '../services/pickup.service.js';
import { createBrandLoader } from './preloader.js';
import * as cart from '../state/cart.store.js';
import { toast } from './toast.js';
import { CONFIG } from '../config.js';

const STEPS = [
  { id: 'details', label: 'פרטים' },
  { id: 'pickup', label: 'סניף איסוף' },
  { id: 'review', label: 'אישור' },
];

/**
 * סינון תווים בזמן הקלדה.
 * העיקרון: תו שאינו חוקי פשוט אינו נרשם — עדיף למנוע מראש
 * מאשר להקליד, לשלוח, ולקבל הודעת שגיאה.
 */
const FILTERS = {
  /* ספרות בלבד, ועוד + מוביל אחד — כדי שהשלמה אוטומטית של 972+ תתקבל */
  phone(value) {
    const plus = value.trimStart().startsWith('+') ? '+' : '';
    return (plus + value.replace(/\D/g, '')).slice(0, plus ? 16 : 15);
  },
  /* תווים חוקיים בכתובת מייל בלבד: בלי רווחים ובלי אותיות שאינן לטיניות */
  email(value) {
    return value.replace(/[^A-Za-z0-9.!#$%&'*+/=?^_`{|}~@-]/g, '');
  },
};

/* סמל Waze — SVG מוטבע, כדי שלא תידרש בקשת רשת נוספת */
const wazeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>`;

const alertIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 8v5m0 3.5v.01"/><circle cx="12" cy="12" r="9"/></svg>`;

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
  let releaseFocus = null;
  let submitting = false;
  let lastOrder = null;

  const state = {
    customer: { fullName: '', phone: '', email: '', notes: '' },
    pickup: { branchId: null },
  };

  /* ------------------------------------------------------- שלב: פרטים -- */

  function field({
    name,
    label,
    type = 'text',
    placeholder,
    hint,
    autocomplete,
    ltr,
    optional,
    textarea,
  }) {
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
      const filter = FILTERS[name];

      if (filter) {
        const clean = filter(control.value);
        if (clean !== control.value) {
          /*
           * שמירת מיקום הסמן: בלעדיה הסמן קופץ לסוף השדה בכל תו שנחסם,
           * וזה הופך עריכה באמצע המספר לבלתי אפשרית.
           */
          const caret = control.selectionStart ?? clean.length;
          const removed = control.value.length - clean.length;
          control.value = clean;
          const next = Math.max(0, caret - removed);
          try {
            control.setSelectionRange(next, next);
          } catch {
            /* סוגי קלט מסוימים אינם תומכים במיקום סמן */
          }
        }
      }

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
          hint: 'אישור ההזמנה יישלח לכתובת זו',
        }),
      ]),
      field({
        name: 'notes',
        label: 'הערות להזמנה',
        optional: true,
        textarea: true,
        placeholder: 'אם יש הערות נוספות ניתן לרשום כאן',
      }),
    ]);
  }

  function validateDetails() {
    const { valid, errors, values } = validate(state.customer, [
      'fullName',
      'phone',
      'email',
      'notes',
    ]);

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

  /* -------------------------------------------------- שלב: סניף איסוף -- */

  function branchOption(branch) {
    const input = el('input', {
      class: 'branch__input',
      type: 'radio',
      name: 'branch',
      id: `branch-${branch.id}`,
      value: branch.id,
    });
    input.checked = state.pickup.branchId === branch.id;

    input.addEventListener('change', () => {
      state.pickup.branchId = branch.id;
      qsa('.branch', body).forEach((node) =>
        node.classList.toggle('is-selected', node.dataset.branch === branch.id)
      );
      updateFooter();
    });

    return el(
      'label',
      {
        class: `branch${state.pickup.branchId === branch.id ? ' is-selected' : ''}`,
        for: `branch-${branch.id}`,
        dataset: { branch: branch.id },
      },
      [
        input,
        el('span', { class: 'branch__mark', 'aria-hidden': 'true' }),
        el('span', { class: 'branch__text' }, [
          el('span', { class: 'branch__name', text: branch.name }),
          branch.address ? el('span', { class: 'branch__address', text: branch.address }) : null,
          el('span', { class: 'branch__hours num', text: branch.hours }),
        ]),
      ]
    );
  }

  function renderPickup() {
    return el('div', { class: 'form-grid' }, [
      el('div', { class: 'pickup-date' }, [
        el('span', { class: 'pickup-date__label', text: 'מועד האיסוף' }),
        el('span', { class: 'pickup-date__value', text: pickupDateLong() }),
      ]),
      el('fieldset', { class: 'branches' }, [
        el('legend', { class: 'field__label', text: 'בחרו סניף לאיסוף' }),
        ...getBranches().map(branchOption),
      ]),
    ]);
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
      ])
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
        ]),
      ]),

      el('div', { class: 'review__block' }, [
        el('p', { class: 'review__label', text: 'איסוף' }),
        el('dl', { class: 'review__list' }, [
          el('div', { class: 'review__item' }, [
            el('dt', { text: 'תאריך' }),
            el('dd', { text: pickupDateLong() }),
          ]),
          el('div', { class: 'review__item' }, [
            el('dt', { text: 'סניף' }),
            el('dd', { text: findBranch(state.pickup.branchId)?.name ?? '' }),
          ]),
          el('div', { class: 'review__item' }, [
            el('dt', { text: 'שעות' }),
            el('dd', { class: 'num', text: findBranch(state.pickup.branchId)?.hours ?? '' }),
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

  /** נוסח ההסבר במסך ההצלחה, לפי ערוץ השליחה */
  function successNote(result) {
    if (!result?.ok) return 'ההזמנה לא נקלטה. נא ליצור איתנו קשר טלפוני כדי להשלים אותה.';
    return 'אישור עם פרטי ההזמנה נשלח לכתובת המייל שמילאתם.';
  }

  function renderSuccess(order, result) {
    stepsBar.hidden = true;
    titleNode.textContent = result?.ok ? 'ההזמנה נקלטה' : 'ההזמנה לא נקלטה';

    // שני הסניפים מוצגים תמיד, כדי שהמידע יהיה נגיש גם אחרי סגירת החלון
    const branchList = el('div', { class: 'branch-links' }, [
      el('p', { class: 'branch-links__title', text: 'ניווט לסניפים' }),
      ...getBranches().map((branch) =>
        el(
          'a',
          {
            class: `branch-link${branch.id === order.pickup.branchId ? ' is-chosen' : ''}`,
            href: branch.waze,
            target: '_blank',
            rel: 'noopener noreferrer',
            'aria-label': `ניווט ב-Waze אל ${branch.name}`,
          },
          [
            el('span', { class: 'branch-link__icon', 'aria-hidden': 'true', html: wazeIcon }),
            el('span', { class: 'branch-link__text' }, [
              el('span', { class: 'branch-link__name', text: branch.name }),
              el('span', { class: 'branch-link__meta' }, [
                branch.address ? `${branch.address} · ` : '',
                el('span', { class: 'num', text: branch.hours }),
              ]),
            ]),
            branch.id === order.pickup.branchId
              ? el('span', { class: 'branch-link__tag', text: 'הסניף שבחרתם' })
              : null,
          ]
        )
      ),
    ]);

    /*
     * כשההזמנה לא נשלחה, האפשרות היחידה שנשארת ללקוח היא להתקשר.
     * כפתור התקשרות עדיף על הודעת שגיאה בלבד, ופועל בלחיצה אחת בנייד.
     */
    const actions = el('div', { class: 'success__actions' }, [
      result?.ok
        ? null
        : el('a', {
            class: 'btn btn--gold btn--lg',
            href: `tel:${CONFIG.business.phone.replace(/\D/g, '')}`,
            text: `להתקשרות · ${CONFIG.business.phone}`,
          }),
      el('button', {
        class: 'btn btn--outline',
        type: 'button',
        on: { click: close },
        text: 'סגירה',
      }),
    ]);

    render(body, [
      el('div', { class: 'success' }, [
        el('span', {
          class: `success__mark${result?.ok ? '' : ' success__mark--error'}`,
          'aria-hidden': 'true',
          html: result?.ok ? checkIcon : alertIcon,
        }),
        el('h3', {
          class: 'success__title',
          text: result?.ok ? `תודה, ${state.customer.fullName.split(' ')[0]}` : 'משהו השתבש',
        }),
        el('p', {
          class: 'success__text',
          text: result?.ok
            ? `ההזמנה התקבלה. האיסוף ב${order.pickup.dateLong}, ${order.pickup.branchName}.`
            : 'ההזמנה שלכם לא נשלחה. הפרטים נשמרו במסך, ואפשר להשלים אותה בטלפון.',
        }),
        el('p', { class: 'success__ref' }, [
          'מספר הזמנה: ',
          el('strong', { class: 'num', text: order.reference }),
        ]),
        el('p', {
          class: 'field__hint',
          text: successNote(result),
        }),
        result?.ok ? branchList : null,
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
    const order = buildOrder(snapshot, state.customer, {
      branch: findBranch(state.pickup.branchId),
    });
    lastOrder = order;

    // מחוון טעינה מותגי בזמן השליחה
    const loader = createBrandLoader({ inline: true });
    render(
      body,
      el('div', { class: 'success' }, [
        loader.node,
        el('p', { class: 'field__hint', text: 'שולחים את ההזמנה' }),
      ])
    );
    loader.start();

    const [result] = await Promise.all([submitOrder(order), sleep(700)]);
    loader.stop();

    if (!result.ok) {
      toast('ההזמנה לא נשלחה — נא ליצור קשר טלפוני', { type: 'error' });
    }

    cart.clear();
    renderSuccess(order, result);
    submitting = false;
    onComplete?.(order);
  }

  /* ------------------------------------------------------- ניווט שלבים -- */

  function paintSteps() {
    stepsBar.setAttribute('role', 'list');
    stepsBar.setAttribute(
      'aria-label',
      `התקדמות בהזמנה, שלב ${stepIndex + 1} מתוך ${STEPS.length}`
    );

    render(
      stepsBar,
      STEPS.map((step, index) =>
        el(
          'div',
          {
            class: `step${index === stepIndex ? ' is-active' : ''}${index < stepIndex ? ' is-done' : ''}`,
            role: 'listitem',
            'aria-current': index === stepIndex ? 'step' : null,
          },
          [
            el('span', {
              class: 'step__num',
              'aria-hidden': 'true',
              text: index < stepIndex ? '' : String(index + 1),
            }),
            el('span', { class: 'step__label', text: step.label }),
            el('span', { class: 'step__line', 'aria-hidden': 'true' }),
            el('span', {
              class: 'visually-hidden',
              text:
                index < stepIndex
                  ? ' — הושלם'
                  : index === stepIndex
                    ? ' — השלב הנוכחי'
                    : ' — טרם הושלם',
            }),
          ]
        )
      )
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
            if (state.pickup.branchId) goTo(2);
            else toast('נא לבחור סניף לאיסוף', { type: 'error' });
          }
        },
      },
    });

    if (stepIndex === 1 && !state.pickup.branchId) {
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
    state.pickup = { branchId: null };

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
