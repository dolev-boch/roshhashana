# תמונות מוצרים

שימו כאן קובצי תמונה ועדכנו את השדה `image` של המוצר בקובץ `js/data/products.js`.

## אפשרות א׳ — קובץ מקומי (הכי פשוט)
1. שמרו את התמונה בתיקייה הזו, למשל `honey-cake.jpg`.
2. בקובץ `js/data/products.js` כתבו:
   ```js
   image: 'assets/images/products/honey-cake.jpg',
   ```
3. העלו לגיט. Vercel יפרוס את הקובץ אוטומטית.

## אפשרות ב׳ — Cloudinary (מומלץ לתמונות כבדות)
1. העלו את התמונה ל-Cloudinary והעתיקו את הכתובת המלאה, למשל:
   `https://res.cloudinary.com/demo/image/upload/v123/zuza/honey-cake.jpg`
2. הדביקו אותה בשדה `image`. אופטימיזציה (`f_auto,q_auto`) תתווסף אוטומטית.

לחלופין, הגדירו פעם אחת ב-`js/config.js`:
```js
cloudinaryBase: 'https://res.cloudinary.com/YOUR_CLOUD/image/upload',
```
ואז מספיק לכתוב במוצר `image: 'zuza/honey-cake'`.

## מפרט מומלץ
- יחס גובה-רוחב: 4:3
- רוחב: 1200px, קובץ עד 300KB
- פורמט: JPG או WebP
