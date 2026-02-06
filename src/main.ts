/**
 * Sunnah.com Scraper - Entry Point
 *
 * Usage:
 *   deno task scrape                    # Scrape all collections
 *   deno task scrape bukhari            # Scrape specific collection
 *   deno task scrape --status           # Show current status
 *   deno task scrape --reset            # Reset state and start fresh
 */

import { COLLECTIONS, type CollectionId } from "./types.ts";
import {
  getStatus,
  resetState,
  scrapeAllCollections,
  scrapeCollection,
} from "./scraper.ts";
import { log } from "./state.ts";

function printUsage(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║              SUNNAH.COM HADITH SCRAPER v2.0                       ║
╠════════════════════════════════════════════════════════════════════╣
║  Usage:                                                           ║
║    deno task scrape                  Scrape all collections       ║
║    deno task scrape <collection>     Scrape specific one          ║
║    deno task scrape --status         Show current progress        ║
║    deno task scrape --reset          Reset and start fresh        ║
╠════════════════════════════════════════════════════════════════════╣
║  Primary Collections:                                             ║
║    bukhari          Sahih al-Bukhari (97 books)                   ║
║    muslim           Sahih Muslim (56 books)                       ║
║    nasai            Sunan an-Nasa'i (52 books)                    ║
║    abudawud         Sunan Abi Dawud (43 books)                    ║
║    tirmidhi         Jami\` at-Tirmidhi (49 books)                  ║
║    ibnmajah         Sunan Ibn Majah (38 books)                    ║
║    ahmad            Musnad Ahmad (8 books)                        ║
║    darimi           Sunan ad-Darimi (24 books)                    ║
║    malik            Muwatta Malik (61 books)                      ║
║    adab             Al-Adab Al-Mufrad (57 books)                  ║
║  Compilation Collections:                                         ║
║    riyadussalihin   Riyad as-Salihin (20 books)                   ║
║    bulugh           Bulugh al-Maram (16 books)                    ║
║    shamail          Ash-Shama'il (57 books)                       ║
║    mishkat          Mishkat al-Masabih (29 books)                  ║
║  Flat Collections:                                                ║
║    nawawi40         40 Hadith an-Nawawi                            ║
║    qudsi40          40 Hadith Qudsi                               ║
║    shahwaliullah40  Shah Waliullah's 40 Hadith                    ║
╚════════════════════════════════════════════════════════════════════╝
`);
}

async function main(): Promise<void> {
  const args = Deno.args;

  // No arguments: show usage
  if (args.length === 0) {
    printUsage();
    console.log("Starting full scrape in 3 seconds... (Ctrl+C to cancel)\n");
    await new Promise((r) => setTimeout(r, 3000));
    await scrapeAllCollections();
    return;
  }

  const command = args[0].toLowerCase();

  // Handle flags
  if (command === "--status" || command === "-s") {
    await getStatus();
    return;
  }

  if (command === "--reset" || command === "-r") {
    const confirm = prompt("This will reset all progress. Are you sure? (y/n)");
    if (confirm?.toLowerCase() === "y") {
      await resetState();
    } else {
      log.info("Reset cancelled");
    }
    return;
  }

  if (command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  if (command === "--all" || command === "all") {
    await scrapeAllCollections();
    return;
  }

  // Check if it's a valid collection
  if (command in COLLECTIONS) {
    await scrapeCollection(command as CollectionId);
    return;
  }

  // Unknown command
  log.error(`Unknown command or collection: ${command}`);
  printUsage();
  Deno.exit(1);
}

// Run
if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    log.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}
