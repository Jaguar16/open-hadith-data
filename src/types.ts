/**
 * Type definitions for the Sunnah.com scraper
 * Based on SPECIFICATION.md v1.1
 */

// ============================================================================
// Collection Types
// ============================================================================

export type CollectionType = "primary" | "compilation";

export type CollectionId =
  | "bukhari"
  | "muslim"
  | "malik"
  | "nawawi40"
  | "riyadussalihin"
  | "nasai"
  | "abudawud"
  | "tirmidhi"
  | "ibnmajah"
  | "ahmad"
  | "darimi"
  | "adab"
  | "bulugh"
  | "shamail"
  | "mishkat"
  | "qudsi40"
  | "shahwaliullah40";

export interface CollectionConfig {
  id: CollectionId;
  name_en: string;
  name_ar: string;
  author_en: string;
  author_ar: string;
  type: CollectionType;
  /** List of book numbers/keys to scrape, null for flat collections */
  books: (number | string)[] | null;
  /** Base URL path */
  slug: string;
}

// ============================================================================
// Scraped Data Types
// ============================================================================

export interface ScrapedCollection {
  collection: {
    id: CollectionId;
    name_en: string;
    name_ar: string;
    author_en: string;
    author_ar: string;
    type: CollectionType;
    scraped_at: string;
  };
  books: ScrapedBook[] | null;
  /** For flat collections like nawawi40 */
  hadiths?: ScrapedHadith[];
  stats: {
    total_books: number;
    total_chapters: number;
    total_hadiths: number;
  };
}

export interface ScrapedBook {
  book_number: number;
  book_key: string | null;
  name_en: string;
  name_ar: string | null;
  chapters: ScrapedChapter[];
  hadiths: ScrapedHadith[];
}

export interface ScrapedChapter {
  chapter_number: number;
  name_en: string | null;
  name_ar: string | null;
}

export interface ScrapedHadith {
  hadith_number: string;
  reference: string;
  in_book_reference: string | null;
  chapter_number: number | null;
  /** Full Arabic text for display (isnad + matn + closing) */
  text_ar: string;
  /** Full English text for display */
  text_en: string;
  /** Arabic chain of narration (first .arabic_sanad) */
  isnad_ar: string | null;
  /** English narrator intro ("Narrated X:") */
  isnad_en: string | null;
  /** Arabic hadith content - actual Prophet's ﷺ words (from .arabic_text_details) - USE FOR TRAINING */
  matn_ar: string | null;
  /** English hadith content - actual hadith text (from .text_details) - USE FOR TRAINING */
  matn_en: string | null;
  /** Arabic closing/additional isnad (second .arabic_sanad if exists) */
  closing_ar: string | null;
  narrator: string | null;
  has_variants: boolean;
  /** For compilations: source collection reference */
  source_reference: string | null;
  /** For compilations: grade from source */
  source_grade: string | null;
  /** Full English grade string (e.g., "Sahih (Darussalam)") from .gradetable */
  grade_en: string | null;
  /** Full Arabic grade string from .gradetable */
  grade_ar: string | null;
  /** URL to the hadith on sunnah.com */
  url_source: string | null;
}

// ============================================================================
// Scraper State Types
// ============================================================================

export interface ScraperState {
  /** Current collection being scraped */
  current_collection: CollectionId | null;
  /** Completed collections */
  completed_collections: CollectionId[];
  /** Books completed for current collection */
  completed_books: (number | string)[];
  /** Last successful scrape timestamp */
  last_update: string;
  /** Any errors encountered */
  errors: ScraperError[];
}

export interface ScraperError {
  timestamp: string;
  collection: CollectionId;
  book: number | string | null;
  hadith_number: string | null;
  error_type: "fetch" | "parse" | "validation";
  message: string;
  url: string;
}

// ============================================================================
// Parser Types
// ============================================================================

export interface ParsedBookPage {
  book_name_en: string;
  book_name_ar: string | null;
  chapters: ScrapedChapter[];
  hadiths: ScrapedHadith[];
}

export interface ParsedHadithElement {
  hadith_number: string;
  reference: string;
  in_book_reference: string | null;
  text_ar: string;
  text_en: string;
  narrator: string | null;
  source_reference: string | null;
  chapter_number: number | null;
}

// ============================================================================
// Configuration
// ============================================================================

export const COLLECTIONS: Record<CollectionId, CollectionConfig> = {
  bukhari: {
    id: "bukhari",
    name_en: "Sahih al-Bukhari",
    name_ar: "صحيح البخاري",
    author_en: "Imam Bukhari",
    author_ar: "الإمام البخاري",
    type: "primary",
    slug: "bukhari",
    books: Array.from({ length: 97 }, (_, i) => i + 1),
  },
  muslim: {
    id: "muslim",
    name_en: "Sahih Muslim",
    name_ar: "صحيح مسلم",
    author_en: "Imam Muslim",
    author_ar: "الإمام مسلم",
    type: "primary",
    slug: "muslim",
    books: Array.from({ length: 56 }, (_, i) => i + 1),
  },
  malik: {
    id: "malik",
    name_en: "Muwatta Malik",
    name_ar: "موطأ الإمام مالك",
    author_en: "Imam Malik",
    author_ar: "الإمام مالك",
    type: "primary",
    slug: "malik",
    books: Array.from({ length: 61 }, (_, i) => i + 1),
  },
  nawawi40: {
    id: "nawawi40",
    name_en: "40 Hadith an-Nawawi",
    name_ar: "الأربعون النووية",
    author_en: "Imam an-Nawawi",
    author_ar: "الإمام النووي",
    type: "compilation",
    slug: "nawawi40",
    books: null, // Flat collection
  },
  riyadussalihin: {
    id: "riyadussalihin",
    name_en: "Riyad as-Salihin",
    name_ar: "رياض الصالحين",
    author_en: "Imam an-Nawawi",
    author_ar: "الإمام النووي",
    type: "compilation",
    slug: "riyadussalihin",
    books: [
      "introduction",
      ...Array.from({ length: 19 }, (_, i) => i + 1),
    ],
  },
  nasai: {
    id: "nasai",
    name_en: "Sunan an-Nasa'i",
    name_ar: "سنن النسائي",
    author_en: "Imam an-Nasa'i",
    author_ar: "الإمام النسائي",
    type: "primary",
    slug: "nasai",
    books: [
      ...Array.from({ length: 35 }, (_, i) => i + 1),
      "35b",
      ...Array.from({ length: 16 }, (_, i) => i + 36),
    ],
  },
  abudawud: {
    id: "abudawud",
    name_en: "Sunan Abi Dawud",
    name_ar: "سنن أبي داود",
    author_en: "Imam Abu Dawud",
    author_ar: "الإمام أبو داود",
    type: "primary",
    slug: "abudawud",
    books: Array.from({ length: 43 }, (_, i) => i + 1),
  },
  tirmidhi: {
    id: "tirmidhi",
    name_en: "Jami` at-Tirmidhi",
    name_ar: "جامع الترمذي",
    author_en: "Imam at-Tirmidhi",
    author_ar: "الإمام الترمذي",
    type: "primary",
    slug: "tirmidhi",
    books: Array.from({ length: 49 }, (_, i) => i + 1),
  },
  ibnmajah: {
    id: "ibnmajah",
    name_en: "Sunan Ibn Majah",
    name_ar: "سنن ابن ماجه",
    author_en: "Imam Ibn Majah",
    author_ar: "الإمام ابن ماجه",
    type: "primary",
    slug: "ibnmajah",
    books: [
      "introduction",
      ...Array.from({ length: 37 }, (_, i) => i + 1),
    ],
  },
  ahmad: {
    id: "ahmad",
    name_en: "Musnad Ahmad",
    name_ar: "مسند أحمد",
    author_en: "Imam Ahmad ibn Hanbal",
    author_ar: "الإمام أحمد بن حنبل",
    type: "primary",
    slug: "ahmad",
    books: [...Array.from({ length: 7 }, (_, i) => i + 1), 31],
  },
  darimi: {
    id: "darimi",
    name_en: "Sunan ad-Darimi",
    name_ar: "سنن الدارمي",
    author_en: "Imam ad-Darimi",
    author_ar: "الإمام الدارمي",
    type: "primary",
    slug: "darimi",
    books: [
      "introduction",
      ...Array.from({ length: 23 }, (_, i) => i + 1),
    ],
  },
  adab: {
    id: "adab",
    name_en: "Al-Adab Al-Mufrad",
    name_ar: "الأدب المفرد",
    author_en: "Imam Bukhari",
    author_ar: "الإمام البخاري",
    type: "primary",
    slug: "adab",
    books: Array.from({ length: 57 }, (_, i) => i + 1),
  },
  bulugh: {
    id: "bulugh",
    name_en: "Bulugh al-Maram",
    name_ar: "بلوغ المرام",
    author_en: "Ibn Hajar al-Asqalani",
    author_ar: "ابن حجر العسقلاني",
    type: "compilation",
    slug: "bulugh",
    books: Array.from({ length: 16 }, (_, i) => i + 1),
  },
  shamail: {
    id: "shamail",
    name_en: "Ash-Shama'il Al-Muhammadiyya",
    name_ar: "الشمائل المحمدية",
    author_en: "Imam at-Tirmidhi",
    author_ar: "الإمام الترمذي",
    type: "compilation",
    slug: "shamail",
    books: [
      ...Array.from({ length: 8 }, (_, i) => i + 1),
      "8b",
      ...Array.from({ length: 48 }, (_, i) => i + 9),
    ],
  },
  mishkat: {
    id: "mishkat",
    name_en: "Mishkat al-Masabih",
    name_ar: "مشكاة المصابيح",
    author_en: "Khatib al-Tabrizi",
    author_ar: "الخطيب التبريزي",
    type: "compilation",
    slug: "mishkat",
    books: [
      "introduction",
      ...Array.from({ length: 24 }, (_, i) => i + 1),
      27, 28, 29, 30,
    ],
  },
  qudsi40: {
    id: "qudsi40",
    name_en: "40 Hadith Qudsi",
    name_ar: "الأحاديث القدسية",
    author_en: "Various",
    author_ar: "متنوع",
    type: "compilation",
    slug: "qudsi40",
    books: null, // Flat collection
  },
  shahwaliullah40: {
    id: "shahwaliullah40",
    name_en: "Shah Waliullah's 40 Hadith",
    name_ar: "الأربعون لشاه ولي الله",
    author_en: "Shah Waliullah Dehlawi",
    author_ar: "شاه ولي الله الدهلوي",
    type: "compilation",
    slug: "shahwaliullah40",
    books: null, // Flat collection
  },
  // hisn: Skipped - du'a collection with different HTML structure, not standard hadiths
};

export const BASE_URL = "https://sunnah.com";
export const RATE_LIMIT_MS = 1500; // 1.5 seconds between requests
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 5000;
