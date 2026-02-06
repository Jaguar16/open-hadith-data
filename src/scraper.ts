/**
 * Main scraper logic for sunnah.com
 */

import {
  BASE_URL,
  COLLECTIONS,
  MAX_RETRIES,
  RATE_LIMIT_MS,
  RETRY_DELAY_MS,
  type CollectionConfig,
  type CollectionId,
  type ScrapedBook,
  type ScrapedCollection,
  type ScraperState,
} from "./types.ts";
import { parseBookPage, parseFlatCollectionPage } from "./parser.ts";
import {
  initDataDir,
  loadBookData,
  loadState,
  log,
  markBookCompleted,
  markCollectionCompleted,
  printStateSummary,
  recordError,
  saveBookData,
  saveCollectionData,
  saveState,
  startCollection,
} from "./state.ts";

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a URL with retries
 */
async function fetchWithRetry(
  url: string,
  state: ScraperState,
  collectionId: CollectionId,
  book: number | string | null,
): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log.info(`Fetching ${url} (attempt ${attempt}/${MAX_RETRIES})`);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "HadathaniScraper/1.0 (Educational hadith app)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Attempt ${attempt} failed: ${message}`);

      if (attempt === MAX_RETRIES) {
        await recordError(state, {
          collection: collectionId,
          book,
          hadith_number: null,
          error_type: "fetch",
          message,
          url,
        });
        return null;
      }

      await sleep(RETRY_DELAY_MS);
    }
  }

  return null;
}

/**
 * Scrape a single book/page
 */
async function scrapeBook(
  config: CollectionConfig,
  book: number | string,
  state: ScraperState,
): Promise<ScrapedBook | null> {
  // Check if already scraped (from incremental saves)
  const existing = await loadBookData(config.id, book);
  if (existing) {
    log.info(`Book ${book} already scraped, loading from cache`);
    return existing as ScrapedBook;
  }

  const url = `${BASE_URL}/${config.slug}/${book}`;
  const html = await fetchWithRetry(url, state, config.id, book);

  if (!html) {
    return null;
  }

  try {
    const parsed = parseBookPage(html, config.id, config.type, book);

    const scrapedBook: ScrapedBook = {
      book_number: typeof book === "number" ? book : 0,
      book_key: typeof book === "string" ? book : null,
      name_en: parsed.book_name_en,
      name_ar: parsed.book_name_ar,
      chapters: parsed.chapters,
      hadiths: parsed.hadiths,
    };

    // Save incrementally
    await saveBookData(config.id, book, scrapedBook);

    log.success(
      `Scraped book ${book}: ${parsed.hadiths.length} hadiths, ${parsed.chapters.length} chapters`,
    );

    return scrapedBook;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to parse book ${book}: ${message}`);

    await recordError(state, {
      collection: config.id,
      book,
      hadith_number: null,
      error_type: "parse",
      message,
      url,
    });

    return null;
  }
}

/**
 * Scrape a flat collection (like nawawi40)
 */
async function scrapeFlatCollection(
  config: CollectionConfig,
  state: ScraperState,
): Promise<ScrapedCollection | null> {
  const url = `${BASE_URL}/${config.slug}`;
  const html = await fetchWithRetry(url, state, config.id, null);

  if (!html) {
    return null;
  }

  try {
    const hadiths = parseFlatCollectionPage(html, config.id);

    log.success(`Scraped flat collection: ${hadiths.length} hadiths`);

    return {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to parse flat collection: ${message}`);

    await recordError(state, {
      collection: config.id,
      book: null,
      hadith_number: null,
      error_type: "parse",
      message,
      url,
    });

    return null;
  }
}

/**
 * Scrape a collection with books
 */
async function scrapeCollectionWithBooks(
  config: CollectionConfig,
  state: ScraperState,
): Promise<ScrapedCollection | null> {
  if (!config.books) {
    throw new Error(`Collection ${config.id} has no books defined`);
  }

  const books: ScrapedBook[] = [];
  const totalBooks = config.books.length;

  for (let i = 0; i < config.books.length; i++) {
    const book = config.books[i];

    // Skip if already completed
    if (state.completed_books.includes(book)) {
      log.info(`Skipping book ${book} (already completed)`);
      // Load from cache
      const cached = await loadBookData(config.id, book);
      if (cached) {
        books.push(cached as ScrapedBook);
      }
      continue;
    }

    log.progress(i + 1, totalBooks, `${config.name_en} - Book ${book}`);

    const scrapedBook = await scrapeBook(config, book, state);

    if (scrapedBook) {
      books.push(scrapedBook);
      await markBookCompleted(state, book);
    }

    // Rate limiting
    if (i < config.books.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  // Calculate stats
  let totalChapters = 0;
  let totalHadiths = 0;

  for (const book of books) {
    totalChapters += book.chapters.length;
    totalHadiths += book.hadiths.length;
  }

  return {
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

/**
 * Scrape a single collection
 */
export async function scrapeCollection(
  collectionId: CollectionId,
): Promise<ScrapedCollection | null> {
  const config = COLLECTIONS[collectionId];
  if (!config) {
    log.error(`Unknown collection: ${collectionId}`);
    return null;
  }

  await initDataDir();
  const state = await loadState();

  // Check if already completed
  if (state.completed_collections.includes(collectionId)) {
    log.info(`Collection ${collectionId} already completed`);
    return null;
  }

  log.info(`Starting scrape of ${config.name_en}`);
  await startCollection(state, collectionId);

  let result: ScrapedCollection | null;

  if (config.books === null) {
    // Flat collection (nawawi40)
    result = await scrapeFlatCollection(config, state);
  } else {
    // Collection with books
    result = await scrapeCollectionWithBooks(config, state);
  }

  if (result) {
    await saveCollectionData(result);
    await markCollectionCompleted(state, collectionId);

    log.success(`
╔════════════════════════════════════════════════════════════╗
║  COLLECTION COMPLETE: ${config.name_en.padEnd(35)}║
║  Books: ${String(result.stats.total_books).padEnd(48)}║
║  Chapters: ${String(result.stats.total_chapters).padEnd(45)}║
║  Hadiths: ${String(result.stats.total_hadiths).padEnd(46)}║
╚════════════════════════════════════════════════════════════╝
`);
  }

  return result;
}

/**
 * Scrape all collections
 */
export async function scrapeAllCollections(): Promise<void> {
  await initDataDir();
  const state = await loadState();
  printStateSummary(state);

  const collectionIds = Object.keys(COLLECTIONS) as CollectionId[];
  const remaining = collectionIds.filter(
    (id) => !state.completed_collections.includes(id),
  );

  log.info(`Collections to scrape: ${remaining.join(", ") || "(none)"}`);

  for (const collectionId of remaining) {
    await scrapeCollection(collectionId);
  }

  // Final summary
  const finalState = await loadState();
  printStateSummary(finalState);

  if (finalState.errors.length > 0) {
    log.warn(`Completed with ${finalState.errors.length} errors. See data/errors.log`);
  } else {
    log.success("All collections scraped successfully!");
  }
}

/**
 * Get scraper status
 */
export async function getStatus(): Promise<void> {
  const state = await loadState();
  printStateSummary(state);

  // Show recent errors
  if (state.errors.length > 0) {
    console.log("\nRecent errors:");
    const recent = state.errors.slice(-5);
    for (const err of recent) {
      console.log(`  - [${err.timestamp}] ${err.collection}/${err.book}: ${err.message}`);
    }
  }
}

/**
 * Reset scraper state (for re-running)
 */
export async function resetState(): Promise<void> {
  await initDataDir();
  await saveState({
    current_collection: null,
    completed_collections: [],
    completed_books: [],
    last_update: new Date().toISOString(),
    errors: [],
  });
  log.success("Scraper state reset");
}
