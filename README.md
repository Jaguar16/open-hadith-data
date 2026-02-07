# Open Hadith Data

**The most comprehensive, structured, open-source hadith dataset for developers.**

**أشمل قاعدة بيانات مهيكلة للأحاديث النبوية، مفتوحة المصدر للمطورين.**

---

**46,891 hadiths** across **17 collections** — available as **SQLite**, **JSON**, and **CSV**.

**46,891 حديثًا** من **17 مصنّفًا** — متوفرة بصيغ **SQLite** و**JSON** و**CSV**.

[**Download Latest Release**](../../releases/latest)

---

## Why? / لماذا؟

While websites like [sunnah.com](https://sunnah.com) and [qaalarasulallah.com](https://qaalarasulallah.com/) provide excellent access to hadith literature, there is no ready-to-use, structured database available for developers. Building a hadith app, doing Islamic NLP research, or simply searching across collections programmatically requires a dataset that doesn't exist (or at least I did not find one) in an accessible format — until now.

This project fills that gap by extracting data from [sunnah.com](https://sunnah.com) into a clean, structured, downloadable database that any developer can use immediately.

---

رغم أن مواقع مثل [sunnah.com](https://sunnah.com) و[قال رسول الله](https://qalarasulullah.com) توفر وصولًا ممتازًا إلى كتب الحديث النبوي، لا توجد قاعدة بيانات مهيكلة وجاهزة للاستخدام متاحة للمطورين. سواء لبناء تطبيق حديثي، أو إجراء أبحاث في المعالجة اللغوية للنصوص الشرعية، أو البحث البرمجي في المصنّفات — لم تكن هناك قاعدة بيانات متاحة بصيغة مناسبة، حتى الآن.

هذا المشروع يسد هذه الثغرة باستخراج البيانات من [sunnah.com](https://sunnah.com) إلى قاعدة بيانات نظيفة ومهيكلة وقابلة للتحميل، يمكن لأي مطور استخدامها فورًا.

---

## Features / الخصائص

- **17 hadith collections** — The 6 major books (Kutub al-Sittah), and more (full list on [sunnah.com](https://sunnah.com))
- **Bilingual** — Arabic text with English translations
- **Isnad/Matn separation** — Chain of narration separated from hadith content (useful for NLP/ML)
- **Grading information** — Hadith grades (Sahih, Hasan, Da'if) where available
- **Multiple formats** — SQLite database, JSON files, CSV files
- **Extraction source code** — Scraper included for transparency and community corrections

---

- **17 مصنّفًا حديثيًا** — الكتب الستة (الصحيحان والسنن الأربع)، والموطأ والمسند وغيرها (القائمة الكاملة على [sunnah.com](https://sunnah.com))
- **عربي وإنجليزي** — المتون العربية مع ترجمتها الإنجليزية
- **فصل الإسناد عن المتن** — السند مفصول عن متن الحديث (مفيد للمعالجة اللغوية والتعلم الآلي)
- **أحكام المحدّثين** — درجة الحديث (صحيح، حسن، ضعيف) حيثما توفرت
- **صيغ متعددة** — قاعدة بيانات SQLite، ملفات JSON، ملفات CSV
- **الكود المصدري** — أداة الاستخراج متضمنة للشفافية ولتصحيح الأخطاء من المجتمع

---

## Collections / المصنّفات

### Primary Collections / الأمهات

| Collection / المصنَّف | Hadiths / الأحاديث | Books / الكتب |
|---|---:|---:|
| Sahih al-Bukhari / صحيح البخاري | 7,252 | 97 |
| Sahih Muslim / صحيح مسلم | 3,087 | 56 |
| Sunan an-Nasa'i / سنن النسائي | 5,754 | 52 |
| Sunan Abi Dawud / سنن أبي داود | 5,274 | 43 |
| Jami' at-Tirmidhi / جامع الترمذي | 3,954 | 49 |
| Sunan Ibn Majah / سنن ابن ماجه | 4,339 | 38 |
| Muwatta Malik / موطأ مالك | 1,846 | 61 |
| Musnad Ahmad / مسند أحمد | 1,374 | 8 |
| Sunan ad-Darimi / سنن الدارمي | 3,406 | 24 |
| Al-Adab Al-Mufrad / الأدب المفرد | 1,322 | 57 |

### Compilation Collections / المختارات والمجاميع

| Collection / المصنَّف | Hadiths / الأحاديث | Books / الكتب |
|---|---:|---:|
| Riyad as-Salihin / رياض الصالحين | 1,896 | 20 |
| Bulugh al-Maram / بلوغ المرام | 1,557 | 16 |
| Ash-Shama'il / الشمائل المحمدية | 402 | 57 |
| Mishkat al-Masabih / مشكاة المصابيح | 5,306 | 29 |
| 40 Hadith an-Nawawi / الأربعون النووية | 42 | — |
| 40 Hadith Qudsi / الأحاديث القدسية | 40 | — |
| Shah Waliullah's 40 / أربعون شاه ولي الله | 40 | — |

---

## Download / التحميل

All data is available on the [**Releases page**](../../releases/latest):

| Format | File | Best for |
|--------|------|----------|
| **SQLite** | `hadiths.db` | Mobile/desktop apps, SQL queries, data analysis |
| **JSON** | `collections-json.zip` | Web development, APIs, JavaScript/Python |
| **CSV** | `collections-csv.zip` | Spreadsheets, data science, quick import |

جميع البيانات متوفرة في [**صفحة الإصدارات**](../../releases/latest).

---

## Data Structure / هيكل البيانات

Each hadith contains these fields:

| Field | Description | الوصف |
|-------|-------------|-------|
| `text_ar` | Full Arabic text (display) | النص الكامل للحديث بالعربية (للعرض) |
| `text_en` | Full English translation (display) | الترجمة الإنجليزية الكاملة (للعرض) |
| `matn_ar` | Arabic hadith content (Prophet's ﷺ words) | المتن — نص الحديث دون الإسناد |
| `matn_en` | English hadith content (Prophet's ﷺ words) | ترجمة المتن بالإنجليزية |
| `isnad_ar` | Arabic chain of narration | الإسناد — سلسلة الرواة |
| `isnad_en` | English narrator introduction | مقدمة السند بالإنجليزية |
| `closing_ar` | Second sanad or scholar commentary | تتمة السند أو كلام المحدّث |
| `narrator` | Primary narrator (Sahabi) | الراوي — الصحابي الذي روى الحديث |
| `grade_en` | Hadith grade in English | درجة الحديث بالإنجليزية |
| `grade_ar` | Hadith grade in Arabic | حكم المحدّث (صحيح، حسن، ضعيف) |
| `hadith_number` | Number within collection | رقم الحديث في المجموعة |
| `reference` | Full reference string | المرجع الكامل |


## Usage Examples / أمثلة الاستخدام

### SQLite

```sql
-- All sahih hadiths from Bukhari
SELECT matn_ar, matn_en FROM hadiths
WHERE collection_id = 'bukhari' AND source_grade = 'sahih';

-- Search hadith content
SELECT * FROM hadiths
WHERE matn_en LIKE '%patience%';

-- Count hadiths per collection
SELECT c.name_en, c.total_hadiths
FROM collections c ORDER BY c.total_hadiths DESC;
```

### Python

```python
import sqlite3

db = sqlite3.connect("hadiths.db")
db.row_factory = sqlite3.Row

# Get all hadiths from a collection
hadiths = db.execute(
    "SELECT matn_ar, matn_en, narrator FROM hadiths WHERE collection_id = ?",
    ("bukhari",)
).fetchall()

for h in hadiths:
    print(f"{h['narrator']}: {h['matn_en'][:80]}...")
```

### JavaScript / TypeScript

```javascript
// Using JSON files
const bukhari = JSON.parse(fs.readFileSync("bukhari.json", "utf-8"));

for (const book of bukhari.books) {
  for (const hadith of book.hadiths) {
    console.log(hadith.matn_en);
  }
}
```

---

## Scraper

The scraper extracts data from [sunnah.com](https://sunnah.com) using Deno and is included in this repository for transparency. If you find extraction errors, you can fix the parser and submit a PR.

أداة الاستخراج تجمع البيانات من [sunnah.com](https://sunnah.com) باستخدام Deno، وهي مضمنة في المستودع للشفافية. إذا وجدت خطأ في الاستخراج، يمكنك إصلاحه وتقديم طلب مراجعة (Pull Request).

### Prerequisites

- [Deno](https://deno.com) v2.x

### Commands

```bash
# استخراج جميع المجموعات
deno task scrape

# استخراج مجموعة واحدة
deno task scrape bukhari

# التحقق من صحة البيانات المستخرجة
deno task validate

# بناء قاعدة بيانات SQLite
deno task build:sqlite

# بناء ملفات CSV
deno task build:csv
```

### Re-scraping / إعادة الاستخراج

```bash
# Parallel re-scrape of a single collection
deno run --allow-net --allow-read --allow-write src/rescrape-one.ts <collection>
```

---

## SQLite Schema

```sql
collections (id, name_en, name_ar, author_en, author_ar, type, total_books, total_chapters, total_hadiths)
books       (id, collection_id, book_number, book_key, name_en, name_ar)
chapters    (id, book_id, chapter_number, name_en, name_ar)
hadiths     (id, collection_id, book_id, chapter_number, hadith_number, reference,
             text_ar, text_en, isnad_ar, isnad_en, matn_ar, matn_en, closing_ar,
             narrator, has_variants, source_reference, source_grade, grade_en, grade_ar, url_source)
```

See [docs/SCHEMA.md](docs/SCHEMA.md) for detailed field descriptions.

---

## License / الترخيص

- **Code**: [MIT License](LICENSE)
- **Structured data**: [CC0 1.0 — Public Domain](DATA_LICENSE.md)
- **English translations**: Sourced from sunnah.com — see their terms for redistribution rights

This dataset is a public utility. The structured data is dedicated to the public domain via CC0 so anyone can use it freely, without restriction. See [DATA_LICENSE.md](DATA_LICENSE.md) for full details.

---

- **الكود المصدري**: [رخصة MIT](LICENSE)
- **البيانات المهيكلة**: [CC0 1.0 — ملك عام](DATA_LICENSE.md)
- **الترجمات الإنجليزية**: مصدرها sunnah.com — راجع شروطهم بخصوص إعادة النشر

هذه القاعدة وقف لوجه الله. البيانات المهيكلة مرخّصة تحت CC0 (ملك عام) ليتمكن أي شخص من الانتفاع بها بحرية ودون قيود.

---

## Disclaimer / تنبيه

This dataset is extracted automatically from [sunnah.com](https://sunnah.com). While we strive for accuracy, we do not guarantee the completeness or correctness of the data. **For religious practice and scholarly study, always refer to authenticated printed editions and qualified scholars.**

استُخرجت هذه البيانات آليًا من [sunnah.com](https://sunnah.com). رغم الحرص على الدقة، لا نضمن اكتمال البيانات أو خلوّها من الخطأ. **للعمل بالحديث والدراسة الشرعية، المرجع هو الطبعات المحققة وأهل العلم.**

---

## Contributing / المساهمة

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to report issues and submit parser fixes.

راجع [CONTRIBUTING.md](CONTRIBUTING.md) للمساهمة في تصحيح الأخطاء أو تحسين الاستخراج.
