/**
 * State management for scraper progress and error tracking
 */

import { ensureDir } from "@std/fs";
import { dirname } from "@std/path";
import type {
  CollectionId,
  ScrapedCollection,
  ScraperError,
  ScraperState,
} from "./types.ts";

const STATE_FILE = "./data/scraper-state.json";
const DATA_DIR = "./data";
const ERRORS_FILE = "./data/errors.log";

/**
 * Logger utility with timestamps
 */
export const log = {
  info: (msg: string) => console.log(`[${timestamp()}] ℹ️  ${msg}`),
  success: (msg: string) => console.log(`[${timestamp()}] ✅ ${msg}`),
  warn: (msg: string) => console.log(`[${timestamp()}] ⚠️  ${msg}`),
  error: (msg: string) => console.error(`[${timestamp()}] ❌ ${msg}`),
  progress: (current: number, total: number, label: string) => {
    const pct = ((current / total) * 100).toFixed(1);
    const bar = progressBar(current, total);
    console.log(`[${timestamp()}] ${bar} ${pct}% | ${label}`);
  },
};

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function progressBar(current: number, total: number, width = 20): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

/**
 * Initialize data directory
 */
export async function initDataDir(): Promise<void> {
  await ensureDir(DATA_DIR);
  await ensureDir(`${DATA_DIR}/collections`);
}

/**
 * Load scraper state from file
 */
export async function loadState(): Promise<ScraperState> {
  try {
    const data = await Deno.readTextFile(STATE_FILE);
    return JSON.parse(data) as ScraperState;
  } catch {
    // Return fresh state if file doesn't exist
    return {
      current_collection: null,
      completed_collections: [],
      completed_books: [],
      last_update: new Date().toISOString(),
      errors: [],
    };
  }
}

/**
 * Save scraper state to file
 */
export async function saveState(state: ScraperState): Promise<void> {
  await ensureDir(dirname(STATE_FILE));
  state.last_update = new Date().toISOString();
  await Deno.writeTextFile(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Mark a book as completed
 */
export async function markBookCompleted(
  state: ScraperState,
  book: number | string,
): Promise<void> {
  if (!state.completed_books.includes(book)) {
    state.completed_books.push(book);
  }
  await saveState(state);
}

/**
 * Mark a collection as completed
 */
export async function markCollectionCompleted(
  state: ScraperState,
  collectionId: CollectionId,
): Promise<void> {
  if (!state.completed_collections.includes(collectionId)) {
    state.completed_collections.push(collectionId);
  }
  state.current_collection = null;
  state.completed_books = [];
  await saveState(state);
}

/**
 * Start scraping a collection
 */
export async function startCollection(
  state: ScraperState,
  collectionId: CollectionId,
): Promise<void> {
  // If resuming the same collection, keep completed books
  if (state.current_collection !== collectionId) {
    state.current_collection = collectionId;
    state.completed_books = [];
  }
  await saveState(state);
}

/**
 * Record an error
 */
export async function recordError(
  state: ScraperState,
  error: Omit<ScraperError, "timestamp">,
): Promise<void> {
  const fullError: ScraperError = {
    ...error,
    timestamp: new Date().toISOString(),
  };

  state.errors.push(fullError);
  await saveState(state);

  // Also append to error log file
  const logLine = `[${fullError.timestamp}] ${fullError.error_type.toUpperCase()} | ` +
    `${fullError.collection}/${fullError.book ?? "?"} | ` +
    `${fullError.message} | ${fullError.url}\n`;

  await Deno.writeTextFile(ERRORS_FILE, logLine, { append: true });
}

/**
 * Save collection data to JSON file
 */
export async function saveCollectionData(
  data: ScrapedCollection,
): Promise<void> {
  const filepath = `${DATA_DIR}/collections/${data.collection.id}.json`;
  await Deno.writeTextFile(filepath, JSON.stringify(data, null, 2));
  log.success(`Saved ${filepath}`);
}

/**
 * Load existing collection data (for resuming)
 */
export async function loadCollectionData(
  collectionId: CollectionId,
): Promise<ScrapedCollection | null> {
  const filepath = `${DATA_DIR}/collections/${collectionId}.json`;
  try {
    const data = await Deno.readTextFile(filepath);
    return JSON.parse(data) as ScrapedCollection;
  } catch {
    return null;
  }
}

/**
 * Save incremental book data (for robustness)
 */
export async function saveBookData(
  collectionId: CollectionId,
  book: number | string,
  data: unknown,
): Promise<void> {
  await ensureDir(`${DATA_DIR}/books/${collectionId}`);
  const filepath = `${DATA_DIR}/books/${collectionId}/${book}.json`;
  await Deno.writeTextFile(filepath, JSON.stringify(data, null, 2));
}

/**
 * Load incremental book data
 */
export async function loadBookData(
  collectionId: CollectionId,
  book: number | string,
): Promise<unknown | null> {
  const filepath = `${DATA_DIR}/books/${collectionId}/${book}.json`;
  try {
    const data = await Deno.readTextFile(filepath);
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Print state summary
 */
export function printStateSummary(state: ScraperState): void {
  console.log("\n" + "=".repeat(60));
  console.log("SCRAPER STATE SUMMARY");
  console.log("=".repeat(60));
  console.log(`Last update: ${state.last_update}`);
  console.log(
    `Completed collections: ${state.completed_collections.join(", ") || "(none)"}`,
  );
  if (state.current_collection) {
    console.log(`Current collection: ${state.current_collection}`);
    console.log(`Completed books: ${state.completed_books.length}`);
  }
  console.log(`Total errors: ${state.errors.length}`);
  console.log("=".repeat(60) + "\n");
}
