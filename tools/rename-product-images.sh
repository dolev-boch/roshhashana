#!/usr/bin/env bash
#
# שינוי שם לקובצי התמונה בעברית לשמות שתואמים למזהי המוצרים.
# הרצה מתוך שורש הפרויקט (ב-Git Bash, macOS או Linux):
#
#     bash tools/rename-product-images.sh
#
# הסקריפט אינו מוחק דבר: הוא משנה שם בלבד, ומדלג על קובץ שכבר קיים ביעד.

set -euo pipefail

DIR="assets/images/products"

# "שם הקובץ המקורי|מזהה המוצר"
MAP=(
  "עוגת דבש ושקדים|honey-almond-cake"
  "עוגת תמרים ואגוזים|date-walnut-cake"
  "מייפל פיצוחים|maple-nut-cake"
  "עוגת תפוחים|apple-spice-cake"
  "מארז פחזניות|vanilla-crumble-choux"
  "רולדת קפה|coffee-hazelnut-roll"
  "טארט שקדים וקרמל|almond-pear-tart"
  "טירמיסו|classic-tiramisu"
  "פרסבורגר פרג|poppy-pressburger"
  "עוגת גבינה|ny-cheesecake"
)

cd "$(dirname "$0")/.."

for entry in "${MAP[@]}"; do
  src_name="${entry%%|*}"
  slug="${entry##*|}"
  target="$DIR/$slug.jpg"

  # התאמה לכל סיומת ולכל אותיות רישיות: .JPG .jpg .jpeg .webp .png
  found=""
  for candidate in "$DIR/$src_name".*; do
    [ -e "$candidate" ] || continue
    found="$candidate"
    break
  done

  if [ -z "$found" ]; then
    echo "דילוג — לא נמצא קובץ עבור: $src_name"
    continue
  fi

  if [ -e "$target" ]; then
    echo "דילוג — כבר קיים: $target"
    continue
  fi

  mv "$found" "$target"
  echo "שונה: $(basename "$found")  ->  $slug.jpg"
done

echo
echo "סיום. מומלץ להריץ עכשיו:  git add -A && git commit -m \"product images\" && git push"
