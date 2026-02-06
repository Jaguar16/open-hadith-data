/**
 * Standalone re-scrape script for a single collection.
 * Bypasses the state system to allow safe parallel execution.
 * Usage: deno run --allow-net --allow-read --allow-write src/rescrape-one.ts <collection>
 */

import {
  BASE_URL,
  COLLECTIONS,
  MAX_RETRIES,
  RATE_LIMIT_MS,
  RETRY_DELAY_MS,
  type CollectionId,
  type ScrapedBook,
  type ScrapedCollection,
} from "./types.ts";
import { parseBookPage, parseFlatCollectionPage } from "./parser.ts";

const collectionId = Deno.args[0] as CollectionId;
if (!collectionId || !(collectionId in COLLECTIONS)) {
  console.error(`Usage: deno run ... rescrape-one.ts <collection>`);
  console.error(`Valid: ${Object.keys(COLLECTIONS).join(", ")}`);
  Deno.exit(1);
}

const config = COLLECTIONS[collectionId];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "HadathaniScraper/1.0 (Educational hadith app)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.text();
    } catch (e) {
      if (attempt === MAX_RETRIES) throw e;
      console.warn(
        `  Attempt ${attempt} failed: ${e instanceof Error ? e.message : e}. Retrying...`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw new Error("unreachable");
}

const booksDir = `data/books/${collectionId}`;
const collectionsDir = `data/collections`;

await Deno.mkdir(booksDir, { recursive: true });
await Deno.mkdir(collectionsDir, { recursive: true });

console.log(`\n=== Re-scraping: ${config.name_en} (${collectionId}) ===\n`);

let result: ScrapedCollection;

if (config.books === null) {
  // Flat collection
  const url = `${BASE_URL}/${config.slug}`;
  console.log(`Fetching flat collection: ${url}`);
  const html = await fetchWithRetry(url);
  const hadiths = parseFlatCollectionPage(html, config.id);
  console.log(`  Parsed ${hadiths.length} hadiths`);

  result = {
    collection: {
      id: config.id,
      name_en: config.name_en,
      name_ar: config.name_ar,
      author_en: config.author_en,
      author_ar: config.author_ar,
      type: config.type,
      scraped_at: new Date().toISOString(),
    },
    books: null,
    hadiths,
    stats: {
      total_books: 0,
      total_chapters: 0,
      total_hadiths: hadiths.length,
    },
  };
} else {
  // Book-based collection
  const books: ScrapedBook[] = [];
  const totalBooks = config.books.length;

  for (let i = 0; i < config.books.length; i++) {
    const book = config.books[i];
    const url = `${BASE_URL}/${config.slug}/${book}`;

    console.log(`[${i + 1}/${totalBooks}] Fetching book ${book}...`);

    try {
      const html = await fetchWithRetry(url);
      const parsed = parseBookPage(html, config.id, config.type, book);

      const scrapedBook: ScrapedBook = {
        book_number: typeof book === "number" ? book : 0,
        book_key: typeof book === "string" ? book : null,
        name_en: parsed.book_name_en,
        name_ar: parsed.book_name_ar,
        chapters: parsed.chapters,
        hadiths: parsed.hadiths,
      };

      const bookFile = `${booksDir}/${book}.json`;
      await Deno.writeTextFile(bookFile, JSON.stringify(scrapedBook, null, 2));

      books.push(scrapedBook);
      console.log(
        `  done ${parsed.hadiths.length} hadiths, ${parsed.chapters.length} chapters`,
      );
    } catch (e) {
      console.error(
        `  FAILED: ${e instanceof Error ? e.message : e}`,
      );
    }

    if (i < config.books.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  let totalChapters = 0, totalHadiths = 0;
  for (const b of books) {
    totalChapters += b.chapters.length;
    totalHadiths += b.hadiths.length;
  }

  result = {
    collection: {
      id: config.id,
      name_en: config.name_en,
      name_ar: config.name_ar,
      author_en: config.author_en,
      author_ar: config.author_ar,
      type: config.type,
      scraped_at: new Date().toISOString(),
    },
    books,
    stats: {
      total_books: books.length,
      total_chapters: totalChapters,
      total_hadiths: totalHadiths,
    },
  };
}

const collectionFile = `${collectionsDir}/${collectionId}.json`;
await Deno.writeTextFile(collectionFile, JSON.stringify(result, null, 2));

console.log(`\n=== ${config.name_en} COMPLETE ===`);
console.log(`  Books: ${result.stats.total_books}`);
console.log(`  Chapters: ${result.stats.total_chapters}`);
console.log(`  Hadiths: ${result.stats.total_hadiths}`);
