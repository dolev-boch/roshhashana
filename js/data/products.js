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
 *   fit       (רשות)  'contain' יציג את התמונה במלואה בלי שום חיתוך.
 *                     שימושי לתמונה שאינה ריבועית שאסור לקצץ בה.
 *                     ברירת המחדל ממלאת את התיבה, וזה הנכון לתמונה ריבועית.
 *   focus     (רשות)  נקודת העניין בתמונה כשיש חיתוך: 'top', 'bottom',
 *                     'center' או ערך CSS מלא כמו '50% 30%'.
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
    image: 'assets/images/products/honey-almond-cake.jpg',
  },
  {
    id: 'date-walnut-cake',
    category: 'loaf-cakes',
    name: 'עוגת תמרים ואגוזי מלך',
    desc: 'בחושה עמוקה, חמה ועשירה בטעמים.',
    price: 48,
    image: 'assets/images/products/date-walnut-cake.jpg',
  },
  {
    id: 'maple-nut-cake',
    category: 'loaf-cakes',
    name: 'עוגת מייפל ופיצוחים',
    desc: 'מתיקות מעודנת עם קראנץ׳ מפנק.',
    price: 52,
    image: 'assets/images/products/maple-nut-cake.jpg',
  },
  {
    id: 'apple-spice-cake',
    category: 'loaf-cakes',
    name: 'עוגת תפוחים ותבלינים חמים',
    desc: 'עוגה חגיגית עם ניחוחות סתיו מושלמים לראש השנה.',
    note: 'קוטר 20',
    price: 92,
    image: 'assets/images/products/apple-spice-cake.jpg',
    badge: 'מומלץ',
  },

  /* ------------------------------------------- מיוחדים לראש השנה -- */
  {
    id: 'vanilla-crumble-choux',
    category: 'rosh-hashana-specials',
    name: 'מארז פחזניות קראמבל וניל',
    desc: 'מארז חגיגי ומרשים, מושלם לאירוח.',
    note: '12 יחידות',
    price: 108,
    image: 'assets/images/products/vanilla-crumble-choux.jpg',
  },
  {
    id: 'poppy-pressburger',
    category: 'rosh-hashana-specials',
    name: 'פרסבורגר פרג',
    desc: 'קלאסיקה עשירה ומפנקת עם פרג טרי.',
    price: 86,
    image: 'assets/images/products/poppy-pressburger.jpg',
  },
  {
    id: 'coffee-hazelnut-roll',
    category: 'rosh-hashana-specials',
    name: 'רולדת קפה, אגוזי לוז ושנטי וניל',
    desc: 'שילוב מעודן ומדויק של קפה, אגוזי לוז ושנטי וניל.',
    price: 98,
    image: 'assets/images/products/coffee-hazelnut-roll.jpg',
    badge: 'מומלץ',
  },

  /* ------------------------------- עוגות חגיגיות למרכז השולחן -- */
  {
    id: 'almond-pear-tart',
    category: 'centerpiece',
    name: 'טארט שקדים ואגסים בקרמל',
    desc: 'אלגנטי ועדין עם שילוב טעמים קלאסי.',
    price: 112,
    image: 'assets/images/products/almond-pear-tart.jpg',
    badge: 'מומלץ',
  },
  {
    id: 'classic-tiramisu',
    category: 'centerpiece',
    name: 'טירמיסו קלאסי',
    desc: 'מוגש בכלי הגשה חגיגי.',
    price: 220,
    image: 'assets/images/products/classic-tiramisu.jpg',
  },
  {
    id: 'ny-cheesecake',
    category: 'centerpiece',
    name: 'עוגת גבינה אפויה בסגנון ניו יורק',
    desc: 'מוגשת עם פירות טריים ושנטי וניל.',
    price: 188,
    image: 'assets/images/products/ny-cheesecake.jpg',
  },
];
