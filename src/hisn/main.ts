/**
 * CLI entry point for the Hisn al-Muslim scraper.
 * Standalone — does not touch the main hadith scraper.
 *
 * Usage:
 *   deno task scrape:hisn
 *   deno run --allow-net --allow-read --allow-write src/hisn/main.ts
 */

import { scrapeHisn } from "./scraper.ts";

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Hisn al-Muslim Scraper                                   ║
║  Fortress of the Muslim — Du'a Collection                  ║
╚════════════════════════════════════════════════════════════╝
`);

  try {
    const result = await scrapeHisn();
    console.log(`\nDone! ${result.stats.total_duas} duas in ${result.stats.total_chapters} chapters.`);
    console.log(`Output: data/collections/hisn.json`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nFailed: ${message}`);
    Deno.exit(1);
  }
}

main();
