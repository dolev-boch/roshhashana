/**
 * Code.gs — צד השרת של אתר ההזמנות של זוזה פטיסרי.
 * =============================================================================
 * מקבל הזמנה מהאתר, כותב אותה לשלושה גיליונות ושולח שני מיילים.
 *
 * הקוד מריץ הכול בתוך Lock, כדי ששתי הזמנות שנשלחות באותה שנייה
 * לא ידרסו זו את זו בגיליון.
 *
 * הוראות התקנה מלאות: README.md שבתיקייה הזו.
 * =============================================================================
 */

/* ------------------------------------------------------------- הגדרות -- */

const CONFIG = {
  /** מזהה הגיליון — החלק שבין /d/ לבין /edit בכתובת */
  SPREADSHEET_ID: '1x4YwfFiLBF0781T68flFWqvckdQ2wBr--dbekqlwclg',

  /** כתובת שאליה נשלחת התראה על כל הזמנה חדשה */
  OWNER_EMAIL: 'edenpatis@gmail.com',

  /**
   * כתובת השולח של כל המיילים.
   * חייבת להיות החשבון שמריץ את הסקריפט, או כתובת מאומתת אצלו
   * תחת Gmail → Settings → Accounts → "Send mail as".
   * אם היא אינה מאומתת, Gmail יתעלם ממנה וישלח מכתובת החשבון.
   */
  SENDER_EMAIL: 'dolev.boch@gmail.com',
  SENDER_NAME: 'זוזה פטיסרי',

  /**
   * כתובת הלוגו במייל. חייבת להיות כתובת ציבורית מלאה — לקוח דואר
   * אינו יכול לטעון נתיב יחסי. אם תשנו דומיין, עדכנו כאן ובשורה שאחריה.
   */
  LOGO_URL: 'https://roshhashana.vercel.app/assets/images/logo.png',

  /** כתובת האתר, לקישור במיילים */
  SITE_URL: 'https://roshhashana.vercel.app',

  CAMPAIGN: 'ראש השנה 2026',
  CURRENCY: '₪',

  /** שמות הגיליונות. שינוי כאן ייצור גיליון חדש בשם החדש. */
  SHEETS: {
    ORDERS: 'הזמנות',
    PRODUCTION: 'סיכום ייצור',
    REVENUE: 'סיכום הכנסות',
  },
};

/* ------------------------------------------------------- נקודות כניסה -- */

/**
 * מקבל הזמנה מהאתר.
 * האתר שולח text/plain כדי להימנע מבקשת preflight של CORS,
 * ולכן הגוף מפוענח כאן ידנית.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const order = JSON.parse(e.postData.contents);
    validateOrder(order);

    const sheets = ensureSheets();

    appendOrderRows(sheets.orders, order);
    rebuildProductionSummary(sheets);
    rebuildRevenueSummary(sheets);

    const orderCount = countOrders(sheets.orders);

    // כשל במייל לא אמור לבטל הזמנה שכבר נכתבה לגיליון
    safely(function () {
      if (order.customer && order.customer.emailConsent) sendCustomerEmail(order);
    }, 'customer email');

    safely(function () {
      sendOwnerEmail(order, orderCount);
    }, 'owner email');

    return json({ ok: true, reference: order.reference, orderCount: orderCount });
  } catch (error) {
    console.error('doPost failed: ' + error.stack);
    return json({ ok: false, error: String(error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

/** בדיקת תקינות בסיסית — למניעת שורות ריקות או זבל בגיליון */
function validateOrder(order) {
  if (!order || typeof order !== 'object') throw new Error('Empty payload');
  if (!order.reference) throw new Error('Missing reference');
  if (!order.customer || !order.customer.fullName) throw new Error('Missing customer');
  if (!Array.isArray(order.items) || order.items.length === 0) throw new Error('Empty order');
  if (!order.pickup || !order.pickup.date) throw new Error('Missing pickup date');
}

/** בדיקת בריאות — פתיחת כתובת ה-Web App בדפדפן */
function doGet() {
  return json({ ok: true, service: 'Zuza Patisserie orders', time: new Date().toISOString() });
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function safely(fn, label) {
  try {
    fn();
  } catch (error) {
    console.error(label + ' failed: ' + error.stack);
  }
}

/* --------------------------------------------------------- גיליונות -- */

/** יוצר את שלושת הגיליונות בפעם הראשונה, ומחזיר אותם */
function ensureSheets() {
  const book = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  const orders = ensureSheet(book, CONFIG.SHEETS.ORDERS, [
    'מספר הזמנה',
    'תאריך קליטה',
    'שם מלא',
    'טלפון',
    'מייל',
    'הסכמה למייל',
    'תאריך איסוף',
    'יום',
    'שעת איסוף',
    'מוצר',
    'מחיר יחידה',
    'כמות',
    'סה"כ שורה',
    'סה"כ הזמנה',
    'הערות',
  ]);

  const production = ensureSheet(book, CONFIG.SHEETS.PRODUCTION, [
    'תאריך איסוף',
    'יום',
    'מוצר',
    'כמות להכנה',
    'מספר הזמנות',
    'שווי',
  ]);

  const revenue = ensureSheet(book, CONFIG.SHEETS.REVENUE, ['מדד', 'ערך']);

  return { book: book, orders: orders, production: production, revenue: revenue };
}

function ensureSheet(book, name, headers) {
  let sheet = book.getSheetByName(name);

  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.setRightToLeft(true);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    const head = sheet.getRange(1, 1, 1, headers.length);
    head.setFontWeight('bold');
    head.setBackground('#1B2520');
    head.setFontColor('#F6EFE7');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }

  return sheet;
}

/**
 * גיליון 1 — טבלת ההזמנות.
 * שורה לכל פריט, כדי שאפשר יהיה לסנן ולסכם לפי מוצר.
 * סכום ההזמנה מופיע בשורה הראשונה של ההזמנה בלבד, כדי לא לנפח סכומים.
 */
function appendOrderRows(sheet, order) {
  const created = new Date();
  const rows = order.items.map(function (item, index) {
    return [
      order.reference,
      created,
      order.customer.fullName,
      "'" + order.customer.phone, // גרש מונע מ-Sheets להפוך 052... ל-52
      order.customer.email,
      order.customer.emailConsent ? 'כן' : 'לא',
      order.pickup.date,
      order.pickup.weekday || weekdayOf(order.pickup.date),
      order.pickup.time,
      item.name,
      item.unitPrice,
      item.qty,
      item.lineTotal,
      index === 0 ? order.total : '',
      index === 0 ? order.customer.notes || '' : '',
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * גיליון 2 — סיכום ייצור.
 * כמה מכל מוצר צריך להיות מוכן, לכל תאריך ויום.
 * נבנה מחדש במלואו בכל הזמנה, כך שהוא תמיד עקבי עם טבלת ההזמנות
 * גם אם נמחקה שורה ידנית.
 */
function rebuildProductionSummary(sheets) {
  const data = readOrders(sheets.orders);
  const buckets = {};

  data.forEach(function (row) {
    const key = row.pickupDate + '|' + row.product;
    if (!buckets[key]) {
      buckets[key] = {
        date: row.pickupDate,
        weekday: row.weekday,
        product: row.product,
        qty: 0,
        value: 0,
        references: {},
      };
    }
    buckets[key].qty += row.qty;
    buckets[key].value += row.lineTotal;
    buckets[key].references[row.reference] = true;
  });

  const rows = Object.keys(buckets)
    .map(function (key) {
      return buckets[key];
    })
    .sort(function (a, b) {
      if (a.date === b.date) return a.product.localeCompare(b.product, 'he');
      return a.date < b.date ? -1 : 1;
    })
    .map(function (b) {
      return [b.date, b.weekday, b.product, b.qty, Object.keys(b.references).length, b.value];
    });

  writeBody(sheets.production, rows, 6);
}

/**
 * גיליון 3 — סיכום הכנסות מהזמנות האתר.
 */
function rebuildRevenueSummary(sheets) {
  const data = readOrders(sheets.orders);

  const references = {};
  let items = 0;
  let revenue = 0;
  const byDate = {};
  const byProduct = {};

  data.forEach(function (row) {
    references[row.reference] = true;
    items += row.qty;
    revenue += row.lineTotal;
    byDate[row.pickupDate] = (byDate[row.pickupDate] || 0) + row.lineTotal;
    byProduct[row.product] = (byProduct[row.product] || 0) + row.lineTotal;
  });

  const orderCount = Object.keys(references).length;

  const rows = [
    ['סה"כ הזמנות', orderCount],
    ['סה"כ פריטים', items],
    ['סה"כ הכנסות', revenue],
    ['הזמנה ממוצעת', orderCount ? Math.round((revenue / orderCount) * 100) / 100 : 0],
    ['', ''],
    ['הכנסות לפי תאריך איסוף', ''],
  ];

  Object.keys(byDate)
    .sort()
    .forEach(function (date) {
      rows.push([date, byDate[date]]);
    });

  rows.push(['', '']);
  rows.push(['הכנסות לפי מוצר', '']);

  Object.keys(byProduct)
    .sort(function (a, b) {
      return byProduct[b] - byProduct[a];
    })
    .forEach(function (product) {
      rows.push([product, byProduct[product]]);
    });

  writeBody(sheets.revenue, rows, 2);
}

/** קריאת טבלת ההזמנות למבנה נוח */
function readOrders(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet
    .getRange(2, 1, lastRow - 1, 15)
    .getValues()
    .filter(function (row) {
      return row[0]; // שורות בלי מספר הזמנה מתעלמים מהן
    })
    .map(function (row) {
      return {
        reference: row[0],
        pickupDate: formatDate(row[6]),
        weekday: row[7],
        product: row[9],
        qty: Number(row[11]) || 0,
        lineTotal: Number(row[12]) || 0,
      };
    });
}

/** מחליף את גוף הגיליון תוך שמירה על שורת הכותרת */
function writeBody(sheet, rows, columns) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, columns).clearContent();
  if (rows.length === 0) return;
  sheet.getRange(2, 1, rows.length, columns).setValues(rows);
}

function countOrders(sheet) {
  const references = {};
  readOrders(sheet).forEach(function (row) {
    references[row.reference] = true;
  });
  return Object.keys(references).length;
}

function formatDate(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Jerusalem', 'yyyy-MM-dd');
  return String(value);
}

function weekdayOf(iso) {
  const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const parts = String(iso).split('-');
  return names[new Date(parts[0], parts[1] - 1, parts[2]).getDay()];
}

/* ------------------------------------------------------------- מיילים -- */

function money(amount) {
  return Number(amount).toLocaleString('he-IL') + ' ' + CONFIG.CURRENCY;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** טבלת הפריטים, משותפת לשני המיילים */
function itemsTable(order) {
  const rows = order.items
    .map(function (item) {
      return (
        '<tr>' +
        '<td style="padding:10px 0;border-bottom:1px dotted #cdc0aa;">' +
        escapeHtml(item.name) +
        ' <span style="color:#6d7367;">× ' +
        item.qty +
        '</span></td>' +
        '<td style="padding:10px 0;border-bottom:1px dotted #cdc0aa;text-align:left;white-space:nowrap;">' +
        money(item.lineTotal) +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px;">' +
    rows +
    '<tr><td style="padding:14px 0 0;font-weight:700;">סה"כ</td>' +
    '<td style="padding:14px 0 0;text-align:left;font-weight:700;">' +
    money(order.total) +
    '</td></tr></table>'
  );
}

/**
 * מעטפת עיצובית אחידה: לוגו על רקע ירוק, ותוכן על נייר שמנת.
 * מבוססת טבלאות ו-inline CSS — זה מה שלקוחות דואר יודעים להציג.
 */
function emailShell(title, bodyHtml) {
  return (
    '<div dir="rtl" style="margin:0;padding:24px 12px;background:#f1ece4;' +
    'font-family:Arial,Helvetica,sans-serif;color:#1f2620;">' +
    '<table role="presentation" align="center" width="100%" style="max-width:560px;' +
    'border-collapse:collapse;background:#fbf7f1;border:1px solid #e4dccf;">' +
    '<tr><td style="background:#1b2520;padding:26px;text-align:center;">' +
    '<img src="' +
    CONFIG.LOGO_URL +
    '" alt="זוזה פטיסרי" width="150" style="display:block;margin:0 auto;border:0;">' +
    '</td></tr>' +
    '<tr><td style="padding:28px 26px;">' +
    '<h1 style="margin:0 0 18px;font-size:20px;font-weight:normal;color:#1b2520;">' +
    escapeHtml(title) +
    '</h1>' +
    bodyHtml +
    '</td></tr>' +
    '<tr><td style="padding:16px 26px;background:#f6efe7;border-top:1px solid #e4dccf;' +
    'text-align:center;font-size:12px;color:#6d7367;">זוזה פטיסרי · 04-8422355</td></tr>' +
    '</table></div>'
  );
}

/** מייל ללקוח — רק מה שצריך: מה הזמין, מתי לאסוף, כמה לשלם */
function sendCustomerEmail(order) {
  const firstName = String(order.customer.fullName).split(' ')[0];

  const body =
    '<p style="margin:0 0 18px;font-size:15px;line-height:1.7;">' +
    escapeHtml(firstName) +
    ', ההזמנה שלכם ל' +
    escapeHtml(CONFIG.CAMPAIGN) +
    ' התקבלה.</p>' +
    '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px;' +
    'background:#f6efe7;border:1px solid #e4dccf;margin:0 0 22px;">' +
    '<tr><td style="padding:14px 16px;">' +
    '<div style="color:#6d7367;font-size:13px;">מועד איסוף</div>' +
    '<div style="font-size:16px;padding-top:4px;">' +
    escapeHtml(order.pickup.dateLong || order.pickup.date) +
    ' בשעה ' +
    escapeHtml(order.pickup.time) +
    '</div></td></tr></table>' +
    itemsTable(order) +
    '<p style="margin:22px 0 0;font-size:13px;color:#6d7367;line-height:1.7;">' +
    'מספר הזמנה ' +
    escapeHtml(order.reference) +
    ' · התשלום במעמד האיסוף.<br>' +
    'לשינוי או ביטול נא ליצור קשר בטלפון 04-8422355.</p>';

  sendMail(
    order.customer.email,
    'אישור הזמנה · ' + CONFIG.CAMPAIGN,
    emailShell('תודה על ההזמנה', body),
  );
}

/** מייל לבעלי העסק — כולל קישור לגיליון ומספר ההזמנות עד כה */
function sendOwnerEmail(order, orderCount) {
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + CONFIG.SPREADSHEET_ID + '/edit';

  const body =
    '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px;' +
    'background:#f6efe7;border:1px solid #e4dccf;margin:0 0 22px;">' +
    '<tr><td style="padding:14px 16px;line-height:1.9;">' +
    '<strong>' +
    escapeHtml(order.customer.fullName) +
    '</strong><br>' +
    'טלפון: ' +
    escapeHtml(order.customer.phone) +
    '<br>מייל: ' +
    escapeHtml(order.customer.email) +
    '<br>איסוף: ' +
    escapeHtml(order.pickup.dateLong || order.pickup.date) +
    ' בשעה ' +
    escapeHtml(order.pickup.time) +
    '<br>מספר הזמנה: ' +
    escapeHtml(order.reference) +
    '</td></tr></table>' +
    itemsTable(order) +
    (order.customer.notes
      ? '<p style="margin:20px 0 0;padding:12px 14px;background:#fff;border-right:3px solid #b89958;' +
        'font-size:14px;line-height:1.7;"><strong>הערות הלקוח:</strong><br>' +
        escapeHtml(order.customer.notes) +
        '</p>'
      : '') +
    '<p style="margin:24px 0 0;font-size:15px;">' +
    'סה"כ הזמנות שהתקבלו עד כה: <strong>' +
    orderCount +
    '</strong></p>' +
    '<p style="margin:18px 0 0;">' +
    '<a href="' +
    sheetUrl +
    '" style="display:inline-block;padding:12px 22px;background:#b89958;color:#fff;' +
    'text-decoration:none;font-size:14px;">פתיחת גיליון ההזמנות</a></p>';

  sendMail(
    CONFIG.OWNER_EMAIL,
    order.customer.fullName + ' הזמין לראש השנה 2026',
    emailShell('הזמנה חדשה מהאתר', body),
  );
}

/**
 * שליחה בפועל.
 * GmailApp נדרש (ולא MailApp) כדי שאפשר יהיה לקבוע כתובת שולח חלופית.
 * אם SENDER_EMAIL אינו alias מאומת בחשבון, Gmail ישלח מכתובת החשבון —
 * בלי לזרוק שגיאה. יש לוודא זאת פעם אחת בהגדרות Gmail.
 */
function sendMail(to, subject, htmlBody) {
  const options = {
    htmlBody: htmlBody,
    name: CONFIG.SENDER_NAME,
  };

  const aliases = GmailApp.getAliases();
  if (aliases.indexOf(CONFIG.SENDER_EMAIL) !== -1) {
    options.from = CONFIG.SENDER_EMAIL;
  }

  GmailApp.sendEmail(to, subject, stripHtml(htmlBody), options);
}

/** גרסת טקסט פשוט — נדרשת ללקוחות דואר שאינם מציגים HTML */
function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(tr|p|div|h1)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/* --------------------------------------------------------------- בדיקה -- */

/**
 * הרצה ידנית מתוך העורך כדי לוודא שהכול עובד:
 * בוחרים את הפונקציה הזו ולוחצים Run. נוצרת הזמנת בדיקה בגיליון
 * ונשלחים שני המיילים.
 */
function runTestOrder() {
  const order = {
    reference: 'ZZ-TEST01',
    createdAt: new Date().toISOString(),
    campaign: CONFIG.CAMPAIGN,
    customer: {
      fullName: 'בדיקה בדיקה',
      phone: '0521234567',
      email: CONFIG.OWNER_EMAIL,
      notes: 'הזמנת בדיקה — אפשר למחוק את השורות מהגיליון',
      emailConsent: true,
    },
    pickup: {
      date: '2026-09-08',
      time: '10:00',
      weekday: 'שלישי',
      dateLong: 'יום שלישי, 8 בספטמבר 2026',
    },
    items: [
      { id: 'honey-almond-cake', name: 'עוגת דבש ושקדים', unitPrice: 54, qty: 2, lineTotal: 108 },
    ],
    itemCount: 2,
    total: 108,
    currency: CONFIG.CURRENCY,
  };

  const result = doPost({ postData: { contents: JSON.stringify(order) } });
  console.log(result.getContent());
}
