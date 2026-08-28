/**
 * products.js
 * ---------------------------------------------------------------------------
 * קטלוג המוצרים. זהו קובץ התוכן היחיד שצריך לערוך כדי לעדכן את התפריט.
 *
 * שדות מוצר:
 *   id        (חובה)  מזהה ייחודי וקבוע. אין לשנות אחרי פרסום - העגלה נשענת עליו.
 *   name      (חובה)  שם המוצר.
 *   desc      (רשות)  תיאור קצר.
 *   price     (חובה)  מחיר בשקלים, מספר בלבד.
 *   note      (רשות)  הערה קטנה שתוצג ליד השם (קוטר, משקל וכו').
 *   image     (רשות)  אחת מהאפשרויות:
 *                       1. נתיב מקומי:  'assets/images/products/honey-cake.jpg'
 *                       2. כתובת מלאה:  'https://res.cloudinary.com/.../cake.jpg'
 *                       3. Cloudinary public id: 'zuza/honey-cake'
 *                          (יורכב אוטומטית לפי CONFIG.images.cloudinaryBase)
 *                     אם השדה ריק או שהתמונה נכשלת - תוצג תמונת ברירת מחדל.
 *   alt       (רשות)  טקסט חלופי לתמונה. אם חסר, נעשה שימוש בשם המוצר.
 *   available (רשות)  false יסמן "אזל". ברירת מחדל: true.
 *   badge     (רשות)  תווית קטנה, למשל 'מומלץ'.
 * ---------------------------------------------------------------------------
 */

export const CATEGORIES = [
  {
    id: 'loaf-cakes',
    title: 'בחושות לחג',
    caption: 'עוגות בחושות עשירות, נארזות באריזת מתנה',
  },
  {
    id: 'rosh-hashana-specials',
    title: 'מיוחדים לראש השנה',
    caption: 'מנות חג שנאפות במהדורה מוגבלת',
  },
  {
    id: 'centerpiece',
    title: 'עוגות חגיגיות למרכז השולחן',
    caption: 'עוגות מרשימות המיועדות להגשה לאורחים',
  },
];

export const PRODUCTS = [
  /* ------------------------------------------------------- בחושות לחג -- */
  {
    id: 'honey-almond-cake',
    category: 'loaf-cakes',
    name: 'עוגת דבש ושקדים',
    desc: 'קלאסיקה חגיגית במרקם עשיר ועדין.',
    price: 54,
    image: '',
  },
  {
    id: 'date-walnut-cake',
    category: 'loaf-cakes',
    name: 'עוגת תמרים ואגוזי מלך',
    desc: 'בחושה עמוקה, חמה ועשירה בטעמים.',
    price: 48,
    image: '',
  },
  {
    id: 'maple-nut-cake',
    category: 'loaf-cakes',
    name: 'עוגת מייפל ופיצוחים',
    desc: 'מתיקות מעודנת עם קראנץ׳ מפנק.',
    price: 52,
    image: '',
  },
  {
    id: 'apple-spice-cake',
    category: 'loaf-cakes',
    name: 'עוגת תפוחים ותבלינים חמים',
    desc: 'עוגה חגיגית עם ניחוחות סתיו מושלמים לראש השנה.',
    note: 'קוטר 20',
    price: 92,
    image: '',
    badge: 'מומלץ',
  },

  /* ------------------------------------------- מיוחדים לראש השנה -- */
  {
    id: 'vanilla-crumble-choux',
    category: 'rosh-hashana-specials',
    name: 'מארז פחזניות קראמבל וניל',
    desc: 'מארז חגיגי ומרשים, מושלם לאירוח.',
    price: 108,
    image: '',
  },
  {
    id: 'poppy-pressburger',
    category: 'rosh-hashana-specials',
    name: 'פרסבורגר פרג',
    desc: 'קלאסיקה עשירה ומפנקת עם פרג טרי.',
    price: 86,
    image: '',
  },
  {
    id: 'coffee-hazelnut-roll',
    category: 'rosh-hashana-specials',
    name: 'רולדת קפה, אגוזי לוז ושנטי וניל',
    desc: 'שילוב מעודן ומדויק של קפה, אגוזי לוז ושנטי וניל.',
    price: 98,
    image: '',
  },

  /* ------------------------------- עוגות חגיגיות למרכז השולחן -- */
  {
    id: 'almond-pear-tart',
    category: 'centerpiece',
    name: 'טארט שקדים ואגסים בקרמל',
    desc: 'אלגנטי ועדין עם שילוב טעמים קלאסי.',
    price: 112,
    image: '',
  },
  {
    id: 'classic-tiramisu',
    category: 'centerpiece',
    name: 'טירמיסו קלאסי',
    desc: 'מוגש בכלי הגשה חגיגי.',
    price: 220,
    image: '',
  },
  {
    id: 'ny-cheesecake',
    category: 'centerpiece',
    name: 'עוגת גבינה אפויה בסגנון ניו יורק',
    desc: 'מוגשת עם פירות טריים ושנטי וניל.',
    price: 188,
    image: '',
    badge: 'מומלץ',
  },
];
