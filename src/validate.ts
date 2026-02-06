/**
 * Validation script for scraped data
 *
 * Usage: deno task validate
 */

import { COLLECTIONS, type CollectionId, type ScrapedCollection } from "./types.ts";

interface ValidationResult {
  collection: CollectionId;
  valid: boolean;
  issues: string[];
  stats: {
    books: number;
    chapters: number;
    hadiths: number;
    missing_arabic: number;
    missing_english: number;
    missing_narrator: number;
    missing_source_ref: number;
  };
}

async function loadCollection(id: CollectionId): Promise<ScrapedCollection | null> {
  try {
    const data = await Deno.readTextFile(`./data/collections/${id}.json`);
    return JSON.parse(data) as ScrapedCollection;
  } catch {
    return null;
  }
}

function validateCollection(data: ScrapedCollection, config: typeof COLLECTIONS[CollectionId]): ValidationResult {
  const issues: string[] = [];
  let totalHadiths = 0;
  let missingArabic = 0;
  let missingEnglish = 0;
  let missingNarrator = 0;
  let missingSourceRef = 0;

  // Get all hadiths
  const allHadiths = data.books
    ? data.books.flatMap((b) => b.hadiths)
    : data.hadiths || [];

  totalHadiths = allHadiths.length;

  // Validate each hadith
  for (const hadith of allHadiths) {
    // Check required fields
    if (!hadith.text_ar || hadith.text_ar.trim().length < 10) {
      missingArabic++;
    }

    if (!hadith.text_en || hadith.text_en.trim().length < 10) {
      missingEnglish++;
    }

    if (!hadith.narrator) {
      missingNarrator++;
    }

    // For compilations, check source reference
    if (config.type === "compilation" && !hadith.source_reference) {
      missingSourceRef++;
    }

    // Validate reference format
    const refPattern = /^(Sahih al-Bukhari|Sahih Muslim|Muwatta Malik|40 Hadith an-Nawawi|Riyad as-Salihin) \d+[a-z]?$/;
    if (!refPattern.test(hadith.reference)) {
      issues.push(`Invalid reference format: ${hadith.reference}`);
    }
  }

  // Check hadith count
  if (totalHadiths === 0) {
    issues.push("No hadiths found!");
  }

  // Check for duplicates
  const numbers = allHadiths.map((h) => h.hadith_number);
  const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
  if (duplicates.length > 0) {
    issues.push(`Duplicate hadith numbers: ${[...new Set(duplicates)].slice(0, 5).join(", ")}...`);
  }

  // Stats-based warnings
  if (missingArabic > 0) {
    issues.push(`${missingArabic} hadiths missing Arabic text`);
  }
  if (missingEnglish > 0) {
    issues.push(`${missingEnglish} hadiths missing English text`);
  }
  if (missingNarrator > totalHadiths * 0.5) {
    issues.push(`${missingNarrator} hadiths missing narrator (${((missingNarrator/totalHadiths)*100).toFixed(0)}%)`);
  }
  if (config.type === "compilation" && missingSourceRef > totalHadiths * 0.1) {
    issues.push(`${missingSourceRef} hadiths missing source reference`);
  }

  return {
    collection: data.collection.id,
    valid: issues.length === 0,
    issues,
    stats: {
      books: data.stats.total_books,
      chapters: data.stats.total_chapters,
      hadiths: totalHadiths,
      missing_arabic: missingArabic,
      missing_english: missingEnglish,
      missing_narrator: missingNarrator,
      missing_source_ref: missingSourceRef,
    },
  };
}

async function main(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("SCRAPED DATA VALIDATION REPORT");
  console.log("=".repeat(70) + "\n");

  const results: ValidationResult[] = [];

  for (const [id, config] of Object.entries(COLLECTIONS)) {
    const data = await loadCollection(id as CollectionId);

    if (!data) {
      console.log(`❌ ${config.name_en}: NOT FOUND`);
      results.push({
        collection: id as CollectionId,
        valid: false,
        issues: ["Collection file not found"],
        stats: { books: 0, chapters: 0, hadiths: 0, missing_arabic: 0, missing_english: 0, missing_narrator: 0, missing_source_ref: 0 },
      });
      continue;
    }

    const result = validateCollection(data, config);
    results.push(result);

    const icon = result.valid ? "✅" : "⚠️";
    console.log(`${icon} ${config.name_en}`);
    console.log(`   Books: ${result.stats.books} | Chapters: ${result.stats.chapters} | Hadiths: ${result.stats.hadiths}`);

    if (result.issues.length > 0) {
      console.log("   Issues:");
      for (const issue of result.issues.slice(0, 5)) {
        console.log(`     - ${issue}`);
      }
      if (result.issues.length > 5) {
        console.log(`     ... and ${result.issues.length - 5} more`);
      }
    }
    console.log();
  }

  // Summary
  console.log("=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));

  const totalHadiths = results.reduce((sum, r) => sum + r.stats.hadiths, 0);
  const validCount = results.filter((r) => r.valid).length;
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

  console.log(`Collections: ${validCount}/${results.length} valid`);
  console.log(`Total hadiths: ${totalHadiths.toLocaleString()}`);
  console.log(`Total issues: ${totalIssues}`);

  if (totalIssues > 0) {
    console.log("\nRun with fixes or check the parser for improvements.");
    Deno.exit(1);
  } else {
    console.log("\n✅ All validations passed!");
  }
}

if (import.meta.main) {
  await main();
}
