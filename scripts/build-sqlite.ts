/**
 * Build SQLite database from scraped JSON collection files.
 *
 * Usage:
 *   deno run --allow-read --allow-write --allow-ffi scripts/build-sqlite.ts
 *
 * Output:
 *   dist/hadiths.db
 */

import { DatabaseSync } from "node:sqlite";
import {
  COLLECTIONS,
  type CollectionId,
  type ScrapedBook,
  type ScrapedChapter,
  type ScrapedCollection,
  type ScrapedHadith,
} from "../src/types.ts";

const COLLECTIONS_DIR = "data/collections";
const OUTPUT_DIR = "dist";
const DB_PATH = `${OUTPUT_DIR}/hadiths.db`;

// Ensure output directory exists
await Deno.mkdir(OUTPUT_DIR, { recursive: true });

// Remove existing DB
try {
  await Deno.remove(DB_PATH);
} catch { /* ignore if not exists */ }

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for faster writes
db.exec("PRAGMA journal_mode=WAL");
db.exec("PRAGMA synchronous=NORMAL");

// ============================================================================
// Create tables
// ============================================================================

db.exec(`
  CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    author_en TEXT NOT NULL,
    author_ar TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('primary', 'compilation')),
    total_books INTEGER NOT NULL DEFAULT 0,
    total_chapters INTEGER NOT NULL DEFAULT 0,
    total_hadiths INTEGER NOT NULL DEFAULT 0,
    scraped_at TEXT
  );

  CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id TEXT NOT NULL REFERENCES collections(id),
    book_number INTEGER NOT NULL,
    book_key TEXT,
    name_en TEXT NOT NULL,
    name_ar TEXT,
    UNIQUE(collection_id, book_number, book_key)
  );

  CREATE TABLE chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id),
    chapter_number INTEGER,
    name_en TEXT,
    name_ar TEXT
  );

  CREATE TABLE hadiths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id TEXT NOT NULL REFERENCES collections(id),
    book_id INTEGER REFERENCES books(id),
    chapter_number INTEGER,
    hadith_number TEXT NOT NULL,
    reference TEXT,
    in_book_reference TEXT,

    text_ar TEXT NOT NULL DEFAULT '',
    text_en TEXT NOT NULL DEFAULT '',

    isnad_ar TEXT,
    isnad_en TEXT,
    matn_ar TEXT,
    matn_en TEXT,
    closing_ar TEXT,

    narrator TEXT,
    has_variants INTEGER NOT NULL DEFAULT 0,
    source_reference TEXT,
    source_grade TEXT,
    grade_en TEXT,
    grade_ar TEXT,
    url_source TEXT
  );

  CREATE INDEX idx_hadiths_collection ON hadiths(collection_id);
  CREATE INDEX idx_hadiths_book ON hadiths(book_id);
  CREATE INDEX idx_hadiths_number ON hadiths(collection_id, hadith_number);
  CREATE INDEX idx_hadiths_narrator ON hadiths(narrator);
  CREATE INDEX idx_hadiths_grade ON hadiths(source_grade);
  CREATE INDEX idx_books_collection ON books(collection_id);
  CREATE INDEX idx_chapters_book ON chapters(book_id);
`);

// ============================================================================
// Prepared statements
// ============================================================================

const insertCollection = db.prepare(`
  INSERT INTO collections (id, name_en, name_ar, author_en, author_ar, type, total_books, total_chapters, total_hadiths, scraped_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertBook = db.prepare(`
  INSERT INTO books (collection_id, book_number, book_key, name_en, name_ar)
  VALUES (?, ?, ?, ?, ?)
`);

const insertChapter = db.prepare(`
  INSERT INTO chapters (book_id, chapter_number, name_en, name_ar)
  VALUES (?, ?, ?, ?)
`);

const insertHadith = db.prepare(`
  INSERT INTO hadiths (
    collection_id, book_id, chapter_number, hadith_number, reference, in_book_reference,
    text_ar, text_en, isnad_ar, isnad_en, matn_ar, matn_en, closing_ar,
    narrator, has_variants, source_reference, source_grade, grade_en, grade_ar, url_source
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// ============================================================================
// Import data
// ============================================================================

const collectionIds = Object.keys(COLLECTIONS) as CollectionId[];
let totalHadiths = 0;

console.log("Building SQLite database...\n");

db.exec("BEGIN TRANSACTION");

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

  // Insert collection
  insertCollection.run(
    col.id, col.name_en, col.name_ar, col.author_en, col.author_ar,
    col.type, data.stats.total_books, data.stats.total_chapters, data.stats.total_hadiths,
    col.scraped_at,
  );

  let hadithCount = 0;

  if (data.books) {
    // Book-based collection
    for (const book of data.books) {
      const result = insertBook.run(
        collectionId,
        book.book_number,
        book.book_key,
        book.name_en,
        book.name_ar,
      );
      const bookId = Number(result.lastInsertRowid);

      // Insert chapters
      for (const chapter of book.chapters) {
        insertChapter.run(bookId, chapter.chapter_number, chapter.name_en, chapter.name_ar);
      }

      // Insert hadiths
      for (const h of book.hadiths) {
        insertHadith.run(
          collectionId, bookId, h.chapter_number, h.hadith_number,
          h.reference, h.in_book_reference,
          h.text_ar || "", h.text_en || "",
          h.isnad_ar, h.isnad_en, h.matn_ar, h.matn_en, h.closing_ar,
          h.narrator, h.has_variants ? 1 : 0,
          h.source_reference, h.source_grade, h.grade_en, h.grade_ar, h.url_source,
        );
        hadithCount++;
      }
    }
  } else if (data.hadiths) {
    // Flat collection
    for (const h of data.hadiths) {
      insertHadith.run(
        collectionId, null, h.chapter_number, h.hadith_number,
        h.reference, h.in_book_reference,
        h.text_ar || "", h.text_en || "",
        h.isnad_ar, h.isnad_en, h.matn_ar, h.matn_en, h.closing_ar,
        h.narrator, h.has_variants ? 1 : 0,
        h.source_reference, h.source_grade, h.grade_en, h.grade_ar, h.url_source,
      );
      hadithCount++;
    }
  }

  totalHadiths += hadithCount;
  console.log(`  ${collectionId.padEnd(20)} ${String(hadithCount).padStart(6)} hadiths`);
}

db.exec("COMMIT");

// Final stats
const stats = db.prepare("SELECT COUNT(*) as n FROM hadiths").get() as { n: number };
const bookCount = db.prepare("SELECT COUNT(*) as n FROM books").get() as { n: number };
const chapterCount = db.prepare("SELECT COUNT(*) as n FROM chapters").get() as { n: number };

console.log(`\nDatabase built: ${DB_PATH}`);
console.log(`  Collections: ${collectionIds.length}`);
console.log(`  Books:       ${bookCount.n}`);
console.log(`  Chapters:    ${chapterCount.n}`);
console.log(`  Hadiths:     ${stats.n}`);

// Get file size
const fileInfo = await Deno.stat(DB_PATH);
const sizeMB = (fileInfo.size / 1024 / 1024).toFixed(1);
console.log(`  Size:        ${sizeMB} MB`);

db.close();
