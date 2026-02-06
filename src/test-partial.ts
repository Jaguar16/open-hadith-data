/**
 * Partial scrape test - scrapes first N books of a collection
 * Usage: deno run --allow-net --allow-read --allow-write src/test-partial.ts <collection> [max_books]
 */

import { COLLECTIONS, type CollectionId } from "./types.ts";
import { parseBookPage, parseFlatCollectionPage } from "./parser.ts";
import { ensureDir } from "@std/fs";

const DELAY_MS = 1500;
const MAX_RETRIES = 3;

async function fetchWithRetry(url: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HadathaniBot/1.0; educational)",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error("Failed after retries");
}

async function testCollection(collectionId: CollectionId, maxBooks: number) {
  const config = COLLECTIONS[collectionId];
  console.log(`\n🔍 Testing ${config.name_en} (max ${maxBooks} books)...\n`);

  const results = {
    collection: collectionId,
    books_scraped: 0,
    total_hadiths: 0,
    total_chapters: 0,
    hadiths_with_narrator: 0,
    hadiths_with_isnad: 0,
    errors: [] as string[],
  };

  await ensureDir(`./data/books/${collectionId}`);

  // Flat collection (nawawi40) - books is null
  if (config.books === null) {
    const url = `https://sunnah.com/${collectionId}`;
    console.log(`  Fetching ${url}...`);
    try {
      const html = await fetchWithRetry(url);
      const hadiths = parseFlatCollectionPage(html, collectionId);
      results.total_hadiths = hadiths.length;
      results.hadiths_with_narrator = hadiths.filter((h) => h.narrator).length;
      results.hadiths_with_isnad = hadiths.filter((h) => h.isnad_en || h.isnad_ar).length;

      // Save
      const data = { collection: config, hadiths };
      await Deno.writeTextFile(
        `./data/collections/${collectionId}.json`,
        JSON.stringify(data, null, 2)
      );
      console.log(`  ✅ ${hadiths.length} hadiths extracted`);
    } catch (error) {
      results.errors.push(`Flat collection error: ${error}`);
      console.log(`  ❌ Error: ${error}`);
    }
  } else {
    // Book-based collection
    const booksToScrape = Math.min(maxBooks, config.books.length);

    for (let i = 0; i < booksToScrape; i++) {
      const bookKey = config.books[i];
      const url = `https://sunnah.com/${collectionId}/${bookKey}`;
      console.log(`  [${i + 1}/${booksToScrape}] Fetching ${url}...`);

      try {
        const html = await fetchWithRetry(url);
        const parsed = parseBookPage(html, collectionId, config.type, bookKey);

        results.books_scraped++;
        results.total_hadiths += parsed.hadiths.length;
        results.total_chapters += parsed.chapters.length;
        results.hadiths_with_narrator += parsed.hadiths.filter((h) => h.narrator).length;
        results.hadiths_with_isnad += parsed.hadiths.filter((h) => h.isnad_en || h.isnad_ar).length;

        // Save book
        const bookData = {
          book_number: typeof bookKey === "number" ? bookKey : i + 1,
          book_key: `${collectionId}/${bookKey}`,
          name_en: parsed.book_name_en,
          name_ar: parsed.book_name_ar,
          chapters: parsed.chapters,
          hadiths: parsed.hadiths,
        };
        await Deno.writeTextFile(
          `./data/books/${collectionId}/${bookKey}.json`,
          JSON.stringify(bookData, null, 2)
        );

        console.log(`  ✅ Book ${bookKey}: ${parsed.hadiths.length} hadiths, ${parsed.chapters.length} chapters`);
      } catch (error) {
        results.errors.push(`Book ${bookKey}: ${error}`);
        console.log(`  ❌ Book ${bookKey} error: ${error}`);
      }

      // Rate limiting
      if (i < booksToScrape - 1) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }
  }

  // Summary
  console.log(`\n📊 Results for ${config.name_en}:`);
  console.log(`   Books: ${results.books_scraped}`);
  console.log(`   Hadiths: ${results.total_hadiths}`);
  console.log(`   Chapters: ${results.total_chapters}`);
  console.log(`   With narrator: ${results.hadiths_with_narrator} (${Math.round(100 * results.hadiths_with_narrator / Math.max(1, results.total_hadiths))}%)`);
  console.log(`   With isnad: ${results.hadiths_with_isnad} (${Math.round(100 * results.hadiths_with_isnad / Math.max(1, results.total_hadiths))}%)`);
  if (results.errors.length > 0) {
    console.log(`   Errors: ${results.errors.length}`);
  }

  return results;
}

// Main
const collectionId = Deno.args[0] as CollectionId;
const maxBooks = parseInt(Deno.args[1] || "3");

if (!collectionId || !COLLECTIONS[collectionId]) {
  console.error("Usage: deno run --allow-net --allow-read --allow-write src/test-partial.ts <collection> [max_books]");
  console.error("Collections: bukhari, muslim, malik, nawawi40, riyadussalihin");
  Deno.exit(1);
}

const result = await testCollection(collectionId, maxBooks);
console.log("\n✅ Test complete");
Deno.exit(result.errors.length > 0 ? 1 : 0);
