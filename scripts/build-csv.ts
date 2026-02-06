/**
 * Build CSV files from scraped JSON collection files.
 *
 * Usage:
 *   deno run --allow-read --allow-write scripts/build-csv.ts
 *
 * Output:
 *   dist/csv/collections.csv
 *   dist/csv/books.csv
 *   dist/csv/chapters.csv
 *   dist/csv/hadiths.csv
 */

import {
  COLLECTIONS,
  type CollectionId,
  type ScrapedCollection,
} from "../src/types.ts";

const COLLECTIONS_DIR = "data/collections";
const OUTPUT_DIR = "dist/csv";

await Deno.mkdir(OUTPUT_DIR, { recursive: true });

// ============================================================================
// CSV helpers
// ============================================================================

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function writeCsvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(escapeCsv).join(",") + "\n";
}

// ============================================================================
// Build CSV files
// ============================================================================

const collectionIds = Object.keys(COLLECTIONS) as CollectionId[];

// Open file handles
const collectionsFile = await Deno.open(`${OUTPUT_DIR}/collections.csv`, { write: true, create: true, truncate: true });
const booksFile = await Deno.open(`${OUTPUT_DIR}/books.csv`, { write: true, create: true, truncate: true });
const chaptersFile = await Deno.open(`${OUTPUT_DIR}/chapters.csv`, { write: true, create: true, truncate: true });
const hadithsFile = await Deno.open(`${OUTPUT_DIR}/hadiths.csv`, { write: true, create: true, truncate: true });

const encoder = new TextEncoder();

// Write headers
const write = (file: Deno.FsFile, row: string) => file.write(encoder.encode(row));

await write(collectionsFile, writeCsvRow([
  "id", "name_en", "name_ar", "author_en", "author_ar", "type",
  "total_books", "total_chapters", "total_hadiths", "scraped_at",
]));

await write(booksFile, writeCsvRow([
  "collection_id", "book_number", "book_key", "name_en", "name_ar",
]));

await write(chaptersFile, writeCsvRow([
  "collection_id", "book_number", "chapter_number", "name_en", "name_ar",
]));

await write(hadithsFile, writeCsvRow([
  "collection_id", "book_number", "chapter_number", "hadith_number",
  "reference", "in_book_reference",
  "text_ar", "text_en",
  "isnad_ar", "isnad_en", "matn_ar", "matn_en", "closing_ar",
  "narrator", "has_variants", "source_reference", "source_grade",
  "grade_en", "grade_ar", "url_source",
]));

console.log("Building CSV files...\n");

let totalHadiths = 0;

for (const collectionId of collectionIds) {
  const filePath = `${COLLECTIONS_DIR}/${collectionId}.json`;

  let raw: string;
  try {
    raw = await Deno.readTextFile(filePath);
  } catch {
    console.warn(`  Skipping ${collectionId} — file not found`);
    continue;
  }

  const data: ScrapedCollection = JSON.parse(raw);
  const col = data.collection;

  // Write collection row
  await write(collectionsFile, writeCsvRow([
    col.id, col.name_en, col.name_ar, col.author_en, col.author_ar,
    col.type, data.stats.total_books, data.stats.total_chapters,
    data.stats.total_hadiths, col.scraped_at,
  ]));

  let hadithCount = 0;

  if (data.books) {
    for (const book of data.books) {
      const bookNum = book.book_key || book.book_number;

      // Write book row
      await write(booksFile, writeCsvRow([
        collectionId, book.book_number, book.book_key, book.name_en, book.name_ar,
      ]));

      // Write chapters
      for (const ch of book.chapters) {
        await write(chaptersFile, writeCsvRow([
          collectionId, bookNum, ch.chapter_number, ch.name_en, ch.name_ar,
        ]));
      }

      // Write hadiths
      for (const h of book.hadiths) {
        await write(hadithsFile, writeCsvRow([
          collectionId, bookNum, h.chapter_number, h.hadith_number,
          h.reference, h.in_book_reference,
          h.text_ar, h.text_en,
          h.isnad_ar, h.isnad_en, h.matn_ar, h.matn_en, h.closing_ar,
          h.narrator, h.has_variants, h.source_reference, h.source_grade,
          h.grade_en, h.grade_ar, h.url_source,
        ]));
        hadithCount++;
      }
    }
  } else if (data.hadiths) {
    for (const h of data.hadiths) {
      await write(hadithsFile, writeCsvRow([
        collectionId, null, h.chapter_number, h.hadith_number,
        h.reference, h.in_book_reference,
        h.text_ar, h.text_en,
        h.isnad_ar, h.isnad_en, h.matn_ar, h.matn_en, h.closing_ar,
        h.narrator, h.has_variants, h.source_reference, h.source_grade,
        h.grade_en, h.grade_ar, h.url_source,
      ]));
      hadithCount++;
    }
  }

  totalHadiths += hadithCount;
  console.log(`  ${collectionId.padEnd(20)} ${String(hadithCount).padStart(6)} hadiths`);
}

collectionsFile.close();
booksFile.close();
chaptersFile.close();
hadithsFile.close();

console.log(`\nCSV files built in ${OUTPUT_DIR}/`);
console.log(`  Total hadiths: ${totalHadiths}`);

// Show file sizes
for (const name of ["collections.csv", "books.csv", "chapters.csv", "hadiths.csv"]) {
  const info = await Deno.stat(`${OUTPUT_DIR}/${name}`);
  const size = info.size < 1024 * 1024
    ? `${(info.size / 1024).toFixed(0)} KB`
    : `${(info.size / 1024 / 1024).toFixed(1)} MB`;
  console.log(`  ${name.padEnd(20)} ${size}`);
}
