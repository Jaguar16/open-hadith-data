/**
 * Scraper for Hisn al-Muslim collection.
 * Fetches the single /hisn page and parses all 268 duas.
 */

import { ensureDir } from "@std/fs";
import { HISN_CONFIG, type HisnCollection } from "./types.ts";
import { parseHisnPage } from "./parser.ts";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const DATA_DIR = "./data";

// ============================================================================
// Logger (standalone, does not import from main scraper)
// ============================================================================

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

const log = {
  info: (msg: string) => console.log(`[${timestamp()}] ℹ️  ${msg}`),
  success: (msg: string) => console.log(`[${timestamp()}] ✅ ${msg}`),
  warn: (msg: string) => console.log(`[${timestamp()}] ⚠️  ${msg}`),
  error: (msg: string) => console.error(`[${timestamp()}] ❌ ${msg}`),
};

// ============================================================================
// Fetch with retry
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string): Promise<string> {
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
        throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts: ${message}`);
      }

      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error("Unreachable");
}

// ============================================================================
// Main scrape function
// ============================================================================

export async function scrapeHisn(): Promise<HisnCollection> {
  log.info(`Starting scrape of ${HISN_CONFIG.name_en}`);

  // Ensure output directory
  await ensureDir(`${DATA_DIR}/collections`);

  // Fetch the single page
  const html = await fetchWithRetry(HISN_CONFIG.url);

  // Parse
  log.info("Parsing HTML...");
  const { chapters, duas } = parseHisnPage(html);

  // Build collection
  const collection: HisnCollection = {
    collection: {
      id: "hisn",
      name_en: HISN_CONFIG.name_en,
      name_ar: HISN_CONFIG.name_ar,
      author_en: HISN_CONFIG.author_en,
      author_ar: HISN_CONFIG.author_ar,
      scraped_at: new Date().toISOString(),
    },
    chapters,
    duas,
    stats: {
      total_chapters: chapters.length,
      total_duas: duas.length,
    },
  };

  // Save
  const filepath = `${DATA_DIR}/collections/hisn.json`;
  await Deno.writeTextFile(filepath, JSON.stringify(collection, null, 2));
  log.success(`Saved ${filepath}`);

  log.success(`
╔════════════════════════════════════════════════════════════╗
║  COLLECTION COMPLETE: ${HISN_CONFIG.name_en.padEnd(35)}║
║  Chapters: ${String(chapters.length).padEnd(45)}║
║  Duas: ${String(duas.length).padEnd(49)}║
╚════════════════════════════════════════════════════════════╝
`);

  return collection;
}
