/**
 * Type definitions for the Hisn al-Muslim (Fortress of the Muslim) scraper.
 * Independent from the main hadith scraper types.
 */

// ============================================================================
// Scraped Data Types
// ============================================================================

export interface ScrapedDua {
  /** Dua number as string (e.g., "59" or "75a") */
  dua_number: string;
  /** Display reference (e.g., "Hisn al-Muslim 59") */
  reference: string;
  /** Chapter number this dua belongs to */
  chapter_number: number;
  /** Full Arabic text of the dua */
  text_ar: string;
  /** Arabic transliteration in Latin script */
  transliteration: string | null;
  /** English translation of the dua */
  translation: string | null;
  /** Context/preamble from .hadith_narrated (instructions, not narrator) */
  context_en: string | null;
  /** Transliteration found inside .hadith_narrated context */
  context_transliteration: string | null;
  /** Source reference (free-form, e.g., "Abu Dawud 2/86, An-Nasa'i 3/53") */
  hisn_reference: string | null;
  /** URL to the dua on sunnah.com */
  url_source: string;
}

export interface ScrapedHisnChapter {
  chapter_number: number;
  name_en: string | null;
  name_ar: string | null;
}

export interface HisnCollection {
  collection: {
    id: "hisn";
    name_en: string;
    name_ar: string;
    author_en: string;
    author_ar: string;
    scraped_at: string;
  };
  chapters: ScrapedHisnChapter[];
  duas: ScrapedDua[];
  stats: {
    total_chapters: number;
    total_duas: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

export const HISN_CONFIG = {
  id: "hisn" as const,
  name_en: "Fortress of the Muslim (Hisn al-Muslim)",
  name_ar: "حصن المسلم",
  author_en: "Sa'id bin Ali bin Wahf Al-Qahtani",
  author_ar: "سعيد بن علي بن وهف القحطاني",
  slug: "hisn",
  url: "https://sunnah.com/hisn",
};
