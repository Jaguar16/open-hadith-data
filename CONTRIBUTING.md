# Contributing / المساهمة

Thank you for your interest in improving the open hadith dataset!

شكرًا لاهتمامك بتحسين مجموعة بيانات الأحاديث المفتوحة!

## How to Contribute / كيفية المساهمة

### Reporting Issues / الإبلاغ عن مشاكل

If you find incorrect data (wrong hadith text, missing fields, wrong grades, etc.):

1. Open a [GitHub Issue](../../issues)
2. Specify the **collection**, **hadith number**, and **field** affected
3. Provide the correct value with a source reference if possible

إذا وجدت بيانات خاطئة (نص حديث خاطئ، حقول مفقودة، درجات خاطئة، إلخ):

1. افتح [مشكلة على GitHub](../../issues)
2. حدد **المجموعة** و**رقم الحديث** و**الحقل** المتأثر
3. قدم القيمة الصحيحة مع مرجع المصدر إن أمكن

### Fixing the Scraper / إصلاح أداة الاستخراج

The data is extracted by the scraper in `src/parser.ts`. To fix extraction issues:

1. **Fork** the repository
2. **Identify the issue** in `src/parser.ts`
3. **Test your fix** on the affected collection:
   ```bash
   # Test a single collection
   deno run --allow-net --allow-read --allow-write src/main.ts <collection>

   # Or test a few books
   deno run --allow-net --allow-read --allow-write src/test-partial.ts <collection> 3
   ```
4. **Submit a Pull Request** with:
   - A clear description of the parsing issue
   - The fix in `src/parser.ts`
   - Before/after examples showing the improvement

I'll re-scrape the affected collections and publish a new data release inShaAllah.

### Project Structure / هيكل المشروع

```
src/
  main.ts          Entry point & CLI
  scraper.ts       HTTP fetching with rate limiting & retries
  parser.ts        HTML parsing (the most important file for fixes)
  types.ts         TypeScript interfaces & collection configs
  state.ts         Progress tracking & incremental saves
  validate.ts      Data validation
scripts/
  build-sqlite.ts  Generate SQLite database from JSON
  build-csv.ts     Generate CSV files from JSON
```

### Development Setup / إعداد بيئة التطوير

```bash
# Prerequisites: Deno v2.x
deno --version

# Scrape a single collection for testing
deno run --allow-net --allow-read --allow-write src/main.ts bukhari

# Validate scraped data
deno run --allow-read src/validate.ts

# Build SQLite database
deno run --allow-read --allow-write --allow-ffi scripts/build-sqlite.ts

# Build CSV files
deno run --allow-read --allow-write scripts/build-csv.ts
```

### Guidelines / إرشادات

- Be respectful of sunnah.com's servers — the scraper includes 1.5s rate limiting
- Do not modify the data files directly — fix the parser and re-scrape
- Keep the scraper focused on accurate extraction, not interpretation
- Test your changes before submitting a PR

كن محترمًا لخوادم sunnah.com — أداة الاستخراج تتضمن تحديد معدل 1.5 ثانية. لا تعدّل ملفات البيانات مباشرة — أصلح المحلل وأعد الاستخراج.

## Release Process / عملية الإصدار

When a PR fixing the parser is merged:

1. Maintainer re-scrapes affected collections
2. Builds new SQLite + JSON + CSV release artifacts
3. Publishes a new GitHub Release with semantic versioning

The data version follows [Semantic Versioning](https://semver.org/):
- **Major** (v2.0.0): Schema changes (new/removed fields) -- unlikely to happen
- **Minor** (v1.1.0): New collections or significant parser improvements
- **Patch** (v1.0.1): Bug fixes in extraction
