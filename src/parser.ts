/**
 * HTML parser for sunnah.com pages using deno-dom
 * Proper DOM manipulation for reliable extraction
 */

import { DOMParser, Element, HTMLDocument } from "deno-dom";
import type {
  CollectionId,
  CollectionType,
  ParsedBookPage,
  ScrapedChapter,
  ScrapedHadith,
} from "./types.ts";

// Collection display names for reference matching
const COLLECTION_NAMES: Record<CollectionId, string> = {
  bukhari: "Sahih al-Bukhari",
  muslim: "Sahih Muslim",
  malik: "Muwatta Malik",
  nawawi40: "40 Hadith an-Nawawi",
  riyadussalihin: "Riyad as-Salihin",
  nasai: "Sunan an-Nasa'i",
  abudawud: "Sunan Abi Dawud",
  tirmidhi: "Jami` at-Tirmidhi",
  ibnmajah: "Sunan Ibn Majah",
  ahmad: "Musnad Ahmad ibn Hanbal",
  darimi: "Sunan ad-Darimi",
  adab: "Al-Adab Al-Mufrad",
  bulugh: "Bulugh al-Maram",
  shamail: "Ash-Shama'il Al-Muhammadiyya",
  mishkat: "Mishkat al-Masabih",
  qudsi40: "40 Hadith Qudsi",
  shahwaliullah40: "Shah Waliullah's 40 Hadith",
  // hisn skipped - du'a collection, different HTML structure
};

/**
 * Parse HTML string into DOM document
 */
function parseHTML(html: string): HTMLDocument | null {
  const parser = new DOMParser();
  return parser.parseFromString(html, "text/html");
}

/**
 * Parse a book page (e.g., /bukhari/1)
 */
export function parseBookPage(
  html: string,
  collectionId: CollectionId,
  collectionType: CollectionType,
  bookNumber: number | string,
): ParsedBookPage {
  const doc = parseHTML(html);
  if (!doc) {
    return {
      book_name_en: `Book ${bookNumber}`,
      book_name_ar: null,
      chapters: [],
      hadiths: [],
    };
  }

  const bookNameEn = extractBookNameEn(doc) || `Book ${bookNumber}`;
  const bookNameAr = extractBookNameAr(doc);
  const chapters = extractChapters(doc);
  const hadiths = extractHadiths(doc, collectionId, collectionType);

  // Set url_source for each hadith (format: https://sunnah.com/collection:number)
  for (const hadith of hadiths) {
    hadith.url_source = `https://sunnah.com/${collectionId}:${hadith.hadith_number}`;
  }

  return {
    book_name_en: bookNameEn,
    book_name_ar: bookNameAr,
    chapters,
    hadiths,
  };
}

/**
 * Parse a flat collection page (e.g., /nawawi40)
 */
export function parseFlatCollectionPage(
  html: string,
  collectionId: CollectionId,
): ScrapedHadith[] {
  const doc = parseHTML(html);
  if (!doc) return [];

  const hadiths = extractHadiths(doc, collectionId, "compilation");

  // Set url_source for each hadith
  for (const hadith of hadiths) {
    hadith.url_source = `https://sunnah.com/${collectionId}:${hadith.hadith_number}`;
  }

  return hadiths;
}

/**
 * Extract book name in English from page
 */
function extractBookNameEn(doc: HTMLDocument): string | null {
  // Try <title> tag: "Book Name - Collection - Sunnah.com"
  const title = doc.querySelector("title")?.textContent;
  if (title) {
    const parts = title.split(" - ");
    if (parts.length >= 1) {
      return cleanText(parts[0]);
    }
  }

  // Try h1 tag
  const h1 = doc.querySelector("h1");
  if (h1) {
    return cleanText(h1.textContent || "");
  }

  return null;
}

/**
 * Extract book name in Arabic
 * HTML structure: <div class="book_page_arabic_name arabic">كتاب بدء الوحى</div>
 */
function extractBookNameAr(doc: HTMLDocument): string | null {
  // Primary: Use the specific .book_page_arabic_name selector
  const bookArabicEl = doc.querySelector(".book_page_arabic_name");
  if (bookArabicEl) {
    const text = cleanText(bookArabicEl.textContent || "");
    if (text && text.length > 2) {
      return text;
    }
  }

  // Fallback: Look for Arabic text in headers
  const arabicPattern = /[\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u065F]{5,}/;

  // Check in h1
  const h1 = doc.querySelector("h1");
  if (h1) {
    const text = h1.textContent || "";
    const match = text.match(arabicPattern);
    if (match) {
      return cleanText(match[0]);
    }
  }

  // Check in page-title or book-title class
  const titleEl = doc.querySelector(".page-title, .book-title, [dir='rtl'] h1");
  if (titleEl) {
    const text = titleEl.textContent || "";
    const match = text.match(arabicPattern);
    if (match) {
      return cleanText(match[0]);
    }
  }

  return null;
}

/**
 * Extract chapters from page using proper CSS selectors
 * HTML structure: <div class="chapter">
 *   <div class="echapno">(1)</div>
 *   <div class="englishchapter">Chapter: Title</div>
 *   <div class="achapno">(1)</div>
 *   <div class="arabicchapter arabic">باب العنوان</div>
 * </div>
 */
function extractChapters(doc: HTMLDocument): ScrapedChapter[] {
  const chapters: ScrapedChapter[] = [];
  const seenNumbers = new Set<number>();

  // Look for chapter container elements
  const chapterContainers = doc.querySelectorAll(".chapter");

  for (const container of chapterContainers) {
    const el = container as Element;

    // Get chapter number from .echapno or .achapno
    let chapterNum: number | null = null;
    const echapno = el.querySelector(".echapno");
    const achapno = el.querySelector(".achapno");

    if (echapno) {
      const numMatch = (echapno.textContent || "").match(/\((\d+)\)/);
      if (numMatch) chapterNum = parseInt(numMatch[1]);
    }
    if (!chapterNum && achapno) {
      const numMatch = (achapno.textContent || "").match(/\((\d+)\)/);
      if (numMatch) chapterNum = parseInt(numMatch[1]);
    }

    // Get English title from .englishchapter
    const englishEl = el.querySelector(".englishchapter");
    let nameEn: string | null = null;
    if (englishEl) {
      nameEn = cleanText(englishEl.textContent || "");
      // Remove "Chapter:" prefix
      nameEn = nameEn.replace(/^Chapter:?\s*/i, "").trim();
      if (nameEn.length < 2) nameEn = null;
    }

    // Get Arabic title from .arabicchapter
    const arabicEl = el.querySelector(".arabicchapter");
    let nameAr: string | null = null;
    if (arabicEl) {
      nameAr = cleanText(arabicEl.textContent || "");
      // Remove "باب" prefix if it's just that
      if (nameAr === "باب") nameAr = null;
      if (nameAr && nameAr.length < 2) nameAr = null;
    }

    // Skip if no valid content
    if (!nameEn && !nameAr) continue;

    // Assign chapter number if not found
    if (chapterNum === null) {
      chapterNum = chapters.length + 1;
    }

    // Avoid duplicates
    if (seenNumbers.has(chapterNum)) continue;
    seenNumbers.add(chapterNum);

    chapters.push({
      chapter_number: chapterNum,
      name_en: nameEn,
      name_ar: nameAr,
    });
  }

  // Fallback: If no .chapter containers found, try older format
  if (chapters.length === 0) {
    const chapterElements = doc.querySelectorAll(".achapter, .chapterTitle");
    let chapterNum = 0;

    for (const el of chapterElements) {
      chapterNum++;
      const text = cleanText((el as Element).textContent || "");

      const numMatch = text.match(/^\((\d+)\)/);
      if (numMatch) {
        chapterNum = parseInt(numMatch[1]);
      }

      const isArabic = /[\u0600-\u06FF]/.test(text);
      const title = text.replace(/^\(\d+\)\s*/, "").replace(/^Chapter:?\s*/i, "");

      if (title && title.length > 2) {
        chapters.push({
          chapter_number: chapterNum,
          name_en: isArabic ? null : title,
          name_ar: isArabic ? title : null,
        });
      }
    }
  }

  return chapters;
}

/**
 * Extract all hadiths from page using DOM
 */
function extractHadiths(
  doc: HTMLDocument,
  collectionId: CollectionId,
  collectionType: CollectionType,
): ScrapedHadith[] {
  const hadiths: ScrapedHadith[] = [];
  const collectionName = COLLECTION_NAMES[collectionId];

  // Sunnah.com uses specific container classes for hadiths
  // Try multiple selectors based on DOM analysis
  const hadithContainers = doc.querySelectorAll(
    ".hadithContainer, .actualHadithContainer, .hadith, [class*='hadith']"
  );

  // If containers found, process each one
  if (hadithContainers.length > 0) {
    for (const container of hadithContainers) {
      const el = container as Element;
      const hadith = parseHadithContainer(el, collectionId, collectionType, collectionName);
      if (hadith) {
        // Check for duplicates (variants)
        const existingIdx = hadiths.findIndex(
          (h) => h.hadith_number.replace(/[a-z]$/, "") === hadith.hadith_number.replace(/[a-z]$/, "")
        );
        if (existingIdx !== -1) {
          hadiths[existingIdx].has_variants = true;
        } else {
          hadiths.push(hadith);
        }
      }
    }
  }

  // Fallback: Find hadiths by reference patterns in the DOM
  if (hadiths.length === 0) {
    const allLinks = doc.querySelectorAll(`a[href*="/${collectionId}:"]`);
    const seenNumbers = new Set<string>();

    for (const link of allLinks) {
      const href = (link as Element).getAttribute("href") || "";
      const match = href.match(new RegExp(`/${collectionId}:(\\d+)([a-z])?`));

      if (match) {
        const num = match[2] ? `${match[1]}${match[2]}` : match[1];
        const baseNum = num.replace(/[a-z]$/, "");

        if (seenNumbers.has(baseNum)) {
          // Mark as having variants
          const existing = hadiths.find((h) => h.hadith_number.replace(/[a-z]$/, "") === baseNum);
          if (existing) existing.has_variants = true;
          continue;
        }
        seenNumbers.add(baseNum);

        // Find the hadith content around this link
        const hadith = extractHadithFromLink(link as Element, num, collectionId, collectionType, collectionName);
        if (hadith) {
          hadiths.push(hadith);
        }
      }
    }
  }

  // Second fallback: Find by collection name pattern in text
  if (hadiths.length === 0) {
    return extractHadithsByTextPattern(doc, collectionId, collectionType, collectionName);
  }

  return hadiths;
}

/**
 * Parse a hadith container element
 * Extracts separated fields for training:
 * - matn_ar: Arabic hadith text (actual Prophet's ﷺ words) from .arabic_text_details
 * - matn_en: English hadith text from .text_details
 * - isnad_ar: First chain of narration from first .arabic_sanad
 * - closing_ar: Second isnad/closing from second .arabic_sanad (if exists)
 */
function parseHadithContainer(
  container: Element,
  collectionId: CollectionId,
  collectionType: CollectionType,
  collectionName: string,
): ScrapedHadith | null {
  // Find hadith number - look for reference links or text
  let hadithNumber: string | null = null;

  // Try link with collection ID
  const refLink = container.querySelector(`a[href*="/${collectionId}:"]`);
  if (refLink) {
    const href = refLink.getAttribute("href") || "";
    const match = href.match(new RegExp(`/${collectionId}:(\\d+)([a-z])?`));
    if (match) {
      hadithNumber = match[2] ? `${match[1]}${match[2]}` : match[1];
    }
  }

  // Try finding number in reference text
  if (!hadithNumber) {
    const refText = container.querySelector(".hadith_reference, .hadithReference")?.textContent;
    if (refText) {
      const numMatch = refText.match(/(\d+)\s*([a-z])?$/);
      if (numMatch) {
        hadithNumber = numMatch[2] ? `${numMatch[1]}${numMatch[2]}` : numMatch[1];
      }
    }
  }

  // Try from class or data attribute
  if (!hadithNumber) {
    const dataNum = container.getAttribute("data-hadith-number") ||
                    container.getAttribute("id")?.match(/hadith-?(\d+)/)?.[1];
    if (dataNum) {
      hadithNumber = dataNum;
    }
  }

  // Try <a name=N> anchor tag (used by darimi and some other Arabic-only collections)
  if (!hadithNumber) {
    const anchorEl = container.querySelector("a[name]");
    if (anchorEl) {
      const name = (anchorEl as Element).getAttribute("name") || "";
      if (/^\d+[a-z]?$/.test(name)) {
        hadithNumber = name;
      }
    }
  }

  if (!hadithNumber) return null;

  // =========================================================================
  // ARABIC TEXT EXTRACTION
  // =========================================================================
  // Structure varies by collection:
  // Standard (Bukhari, Muslim, etc.):
  //   <div class="arabic_hadith_full">
  //     <span class="arabic_sanad">isnad chain...</span>
  //     <span class="arabic_text_details">matn (actual hadith)...</span>
  //     <span class="arabic_sanad">closing/second isnad...</span>
  //   </div>
  // Flat (Nawawi40): Plain text without spans
  // Some hadiths: Empty sanads, all text in arabic_text_details

  const arabicFullEl = container.querySelector(".arabic_hadith_full");
  const textAr = arabicFullEl
    ? cleanArabicText(arabicFullEl.textContent || "")
    : null;
  if (!textAr) return null;

  // Extract matn_ar from .arabic_text_details (the actual hadith content)
  const arabicMatnEl = container.querySelector(".arabic_text_details");
  let matnAr: string | null = null;
  if (arabicMatnEl) {
    matnAr = cleanArabicText(arabicMatnEl.textContent || "");
    // Remove surrounding quotes if present
    matnAr = matnAr.replace(/^["‏]+|["‏]+$/g, "").trim();
    if (matnAr.length < 3) matnAr = null;
  }

  // Get all .arabic_sanad elements
  const arabicSanadEls = container.querySelectorAll(".arabic_sanad");
  let isnadAr: string | null = null;
  let closingAr: string | null = null;

  if (arabicSanadEls.length > 0) {
    // First sanad is the chain of narration
    const firstSanad = cleanArabicText((arabicSanadEls[0] as Element).textContent || "");
    if (firstSanad.length > 3) {
      isnadAr = firstSanad;
    }

    // Second sanad (if exists) is closing/additional commentary
    if (arabicSanadEls.length > 1) {
      const secondSanad = cleanArabicText((arabicSanadEls[1] as Element).textContent || "");
      // Only keep if it has meaningful content (not just punctuation)
      if (secondSanad.length > 5 && !/^[\s\u200F\u200E‏.،؛:!؟]+$/.test(secondSanad)) {
        closingAr = secondSanad;
      }
    }
  }

  // When .arabic_sanad was empty but .arabic_text_details has full text (isnad + matn combined),
  // try to split using narration verb patterns
  if (!isnadAr && matnAr && startsWithIsnadPattern(matnAr)) {
    const split = splitIsnadFromMatn(matnAr);
    if (split) {
      isnadAr = split.isnad;
      matnAr = split.matn;
    }
  }

  // Fallback for flat collections (Nawawi40) - no spans, use regex
  if (!isnadAr && !matnAr) {
    const split = splitIsnadFromMatn(textAr);
    if (split) {
      isnadAr = split.isnad;
      matnAr = split.matn;
    } else {
      isnadAr = extractIsnadAr(textAr);
      // For flat collections, matn_ar = full text (no separation possible)
      matnAr = textAr;
    }
  }

  // =========================================================================
  // ENGLISH TEXT EXTRACTION
  // =========================================================================
  // Structure:
  //   <div class="hadith_narrated">Narrated X:</div>
  //   <div class="text_details">The hadith content...</div>

  const narratedEl = container.querySelector(".hadith_narrated");
  const textDetailsEl = container.querySelector(".text_details");

  let narratorFromDom: string | null = null;
  let textEn: string | null = null;
  let matnEn: string | null = null;
  let isnadEn: string | null = null;

  if (narratedEl || textDetailsEl) {
    // Extract narrator intro (isnad_en)
    const narratedText = narratedEl ? cleanEnglishText(narratedEl.textContent || "") : "";
    // Extract main hadith text (matn_en)
    const detailsText = textDetailsEl ? cleanEnglishText(textDetailsEl.textContent || "") : "";

    // Parse narrator from the narrated element
    if (narratedText) {
      narratorFromDom = extractNarratorFromNarrated(narratedText);
      isnadEn = narratedText.replace(/:$/, "").trim();
    }

    // matn_en is the actual hadith content
    if (detailsText && detailsText.length > 3) {
      matnEn = detailsText;
    }

    // When no .hadith_narrated element exists, the narrator intro may be embedded
    // in .text_details (e.g., "It was narrated from X that..." or "Narrated X: ...")
    // Strip it from matn_en and set isnad_en
    if (!isnadEn && matnEn) {
      const stripped = stripEnglishNarratorIntro(matnEn);
      if (stripped) {
        isnadEn = stripped.isnad;
        matnEn = stripped.matn;
        if (!narratorFromDom) {
          narratorFromDom = extractNarratorFromNarrated(stripped.isnad);
        }
      }
    }

    // Combine for full text display
    textEn = [narratedText, detailsText].filter(Boolean).join(" ").trim();
  }

  // Fallback to full container
  if (!textEn) {
    const englishEl = container.querySelector(".english_hadith_full, .english_text, .hadithText");
    textEn = englishEl ? cleanEnglishText(englishEl.textContent || "") : null;
    // For fallback, matn_en = full text (no separation possible)
    matnEn = textEn;
    isnadEn = textEn ? extractIsnadEn(textEn) : null;
  }

  // Allow Arabic-only hadiths (e.g., darimi) - use empty string for display
  if (!textEn) textEn = "";

  // Extract in-book reference
  const inBookRef = extractInBookReference(container);

  // Extract narrator - prefer DOM extraction, fall back to regex
  const narrator = narratorFromDom || extractNarrator(textEn);

  // For compilations: extract source reference
  let sourceReference: string | null = null;
  let sourceGrade: string | null = null;

  if (collectionType === "compilation") {
    sourceReference = extractSourceReference(container);
    sourceGrade = extractSourceGrade(container);
  }

  // Extract grade from .gradetable (used by nasai, abudawud, tirmidhi, etc.)
  const grades = extractGrades(container);
  // If source_grade not yet set (primary collections), use normalized grade
  if (!sourceGrade && grades.normalized) {
    sourceGrade = grades.normalized;
  }

  return {
    hadith_number: hadithNumber,
    reference: `${collectionName} ${hadithNumber}`,
    in_book_reference: inBookRef,
    chapter_number: null,
    text_ar: textAr,
    text_en: textEn,
    isnad_ar: isnadAr,
    isnad_en: isnadEn,
    matn_ar: matnAr,
    matn_en: matnEn,
    closing_ar: closingAr,
    narrator,
    has_variants: false,
    source_reference: sourceReference,
    source_grade: sourceGrade,
    grade_en: grades.grade_en,
    grade_ar: grades.grade_ar,
    url_source: null, // Will be set by parseBookPage/parseFlatCollectionPage
  };
}

/**
 * Extract hadith from a reference link by traversing up to find content
 */
function extractHadithFromLink(
  link: Element,
  hadithNumber: string,
  collectionId: CollectionId,
  collectionType: CollectionType,
  collectionName: string,
): ScrapedHadith | null {
  // Walk up to find a container
  let container: Element | null = link;
  for (let i = 0; i < 10 && container; i++) {
    const parent: Element | null = container.parentElement;
    if (!parent) break;

    // Check if this parent has hadith-like structure
    const hasArabic = parent.querySelector("p[dir='rtl'], .arabic, [lang='ar']");
    const hasEnglish = parent.textContent && parent.textContent.length > 100;

    if (hasArabic && hasEnglish) {
      const hadith = parseHadithContainer(parent, collectionId, collectionType, collectionName);
      if (hadith) {
        hadith.hadith_number = hadithNumber;
        hadith.reference = `${collectionName} ${hadithNumber}`;
        return hadith;
      }
    }
    container = parent;
  }

  // Try to extract from document body around the link
  const doc = link.ownerDocument;
  if (!doc) return null;

  // Get surrounding content
  const bodyText = doc.body?.textContent || "";
  const linkText = link.textContent || "";
  const linkIdx = bodyText.indexOf(linkText);

  if (linkIdx === -1) return null;

  // Extract a window around the link
  const windowStart = Math.max(0, linkIdx - 2000);
  const windowEnd = Math.min(bodyText.length, linkIdx + 3000);
  const window = bodyText.slice(windowStart, windowEnd);

  // Find Arabic text
  const arabicMatch = window.match(/([\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u065F،:.!؟]{30,})/);
  const textAr = arabicMatch ? cleanArabicText(arabicMatch[1]) : null;
  if (!textAr) return null;

  // Find English text (narration pattern)
  const englishMatch = window.match(
    /((?:On the authority of|Narrated|It was narrated|It is narrated)[^]*?(?:\.|(?=[\u0600-\u06FF])))/i
  );
  const textEn = englishMatch ? cleanEnglishText(englishMatch[1]) : null;
  if (!textEn) return null;

  return {
    hadith_number: hadithNumber,
    reference: `${collectionName} ${hadithNumber}`,
    in_book_reference: null,
    chapter_number: null,
    text_ar: textAr,
    text_en: textEn,
    isnad_ar: extractIsnadAr(textAr),
    isnad_en: extractIsnadEn(textEn),
    matn_ar: textAr, // Fallback: use full text as matn
    matn_en: textEn, // Fallback: use full text as matn
    closing_ar: null,
    narrator: extractNarrator(textEn),
    has_variants: false,
    source_reference: collectionType === "compilation" ? extractSourceReferenceFromText(window) : null,
    source_grade: null,
    grade_en: null,
    grade_ar: null,
    url_source: null,
  };
}

/**
 * Fallback: Extract hadiths by finding text patterns
 */
function extractHadithsByTextPattern(
  doc: HTMLDocument,
  collectionId: CollectionId,
  collectionType: CollectionType,
  collectionName: string,
): ScrapedHadith[] {
  const hadiths: ScrapedHadith[] = [];
  const bodyText = doc.body?.textContent || "";

  // Find all occurrences of collection name with number
  const refPattern = new RegExp(
    `${escapeRegex(collectionName)}\\s+(\\d+)\\s*([a-z])?`,
    "gi"
  );

  const seenNumbers = new Set<string>();
  let match;

  while ((match = refPattern.exec(bodyText)) !== null) {
    const num = match[2] ? `${match[1]}${match[2]}` : match[1];
    const baseNum = num.replace(/[a-z]$/, "");

    if (seenNumbers.has(baseNum)) continue;
    seenNumbers.add(baseNum);

    // Extract content around this match
    const startIdx = Math.max(0, match.index - 2000);
    const endIdx = Math.min(bodyText.length, match.index + 3000);
    const section = bodyText.slice(startIdx, endIdx);

    // Find Arabic text
    const arabicMatch = section.match(/([\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u065F،:.!؟]{30,})/);
    const textAr = arabicMatch ? cleanArabicText(arabicMatch[1]) : null;
    if (!textAr) continue;

    // Find English text
    const englishMatch = section.match(
      /((?:On the authority of|Narrated|It was narrated|It is narrated)[^]*?\.)/i
    );
    const textEn = englishMatch ? cleanEnglishText(englishMatch[1]) : null;
    if (!textEn) continue;

    hadiths.push({
      hadith_number: num,
      reference: `${collectionName} ${num}`,
      in_book_reference: null,
      chapter_number: null,
      text_ar: textAr,
      text_en: textEn,
      isnad_ar: extractIsnadAr(textAr),
      isnad_en: extractIsnadEn(textEn),
      matn_ar: textAr, // Fallback: use full text as matn
      matn_en: textEn, // Fallback: use full text as matn
      closing_ar: null,
      narrator: extractNarrator(textEn),
      has_variants: false,
      source_reference: collectionType === "compilation" ? extractSourceReferenceFromText(section) : null,
      source_grade: null,
      grade_en: null,
      grade_ar: null,
      url_source: null,
    });
  }

  return hadiths;
}

/**
 * Extract in-book reference from container
 */
function extractInBookReference(container: Element): string | null {
  const refEl = container.querySelector(".hadith_reference, .in-book-reference");
  if (refEl) {
    const text = refEl.textContent || "";
    const match = text.match(/Book\s+(\d+),?\s*Hadith\s+(\d+)/i);
    if (match) {
      return `Book ${match[1]}, Hadith ${match[2]}`;
    }
  }
  return null;
}

/**
 * Extract source reference from compilation container
 */
function extractSourceReference(container: Element): string | null {
  // Valid English source names
  const validSources = ["Bukhari", "Muslim", "Tirmidhi", "Abu Dawud", "An-Nasa'i", "Ibn Majah", "Malik"];

  // Look for links to source collections
  const sourceLinks = container.querySelectorAll('a[href*="/bukhari"], a[href*="/muslim"], a[href*="/tirmidhi"], a[href*="/abudawud"], a[href*="/nasai"], a[href*="/ibnmajah"], a[href*="/malik"]');

  if (sourceLinks.length > 0) {
    const sources: string[] = [];
    for (const link of sourceLinks) {
      const text = (link as Element).textContent?.trim();
      // Only keep English source names (no Arabic)
      if (text && !sources.includes(text) && !/[\u0600-\u06FF]/.test(text)) {
        // Normalize source name
        const normalized = validSources.find(s =>
          text.toLowerCase().includes(s.toLowerCase().replace(/['-]/g, ""))
        );
        if (normalized && !sources.includes(normalized)) {
          sources.push(normalized);
        }
      }
    }
    if (sources.length > 0) {
      return `[${sources.join(" and ")}]`;
    }
  }

  // Fallback: Look for bracketed text
  const containerText = container.textContent || "";
  return extractSourceReferenceFromText(containerText);
}

/**
 * Extract source reference from text
 */
function extractSourceReferenceFromText(text: string): string | null {
  // Pattern 1: [Bukhari and Muslim] or [Bukhari & Muslim]
  const bracketPattern = /\[\s*((?:Al-)?Bukhari|Muslim|At-Tirmidhi|Abu Dawud|An-Nasa['']?i|Ibn Majah|Malik)(?:\s*(?:&|and)\s*((?:Al-)?Bukhari|Muslim))?\s*\]/gi;
  const bracketMatch = bracketPattern.exec(text);
  if (bracketMatch) {
    if (bracketMatch[2]) {
      return `[${bracketMatch[1]} and ${bracketMatch[2]}]`;
    }
    return `[${bracketMatch[1]}]`;
  }

  // Pattern 2: "related by X" or "reported by X"
  const relatedMatch = text.match(
    /(?:related|reported|narrated)\s+by\s+((?:al-)?Bukhari|Muslim|(?:at-)?Tirmidhi|Abu Dawud|(?:an-)?Nasa['']?i|Ibn Majah)/i
  );
  if (relatedMatch) {
    return `[${relatedMatch[1]}]`;
  }

  // Pattern 3: "hadeeth which was related by X"
  const hadithMatch = text.match(
    /hadee?th\s+(?:which\s+was\s+)?(?:related|narrated)\s+by\s+((?:al-)?Bukhari|Muslim|(?:at-)?Tirmidhi)/i
  );
  if (hadithMatch) {
    return `[${hadithMatch[1]}]`;
  }

  return null;
}

/**
 * Extract grade information from .gradetable HTML
 * HTML pattern (consistent across all graded collections):
 *   <table class=gradetable>
 *     <tr>
 *       <td class=english_grade><b>Grade</b>:</td>
 *       <td class=english_grade>&nbsp;<b>Sahih</b> (Darussalam)</td>
 *       <td class=arabic_grade></td>
 *       <td class=arabic_grade></td>
 *     </tr>
 *   </table>
 */
function extractGrades(container: Element): { grade_en: string | null; grade_ar: string | null; normalized: string | null } {
  const gradeTable = container.querySelector(".gradetable");
  if (!gradeTable) {
    return { grade_en: null, grade_ar: null, normalized: null };
  }

  let gradeEn: string | null = null;
  let gradeAr: string | null = null;
  let normalized: string | null = null;

  // Get English grade from 2nd td.english_grade
  const englishGradeTds = gradeTable.querySelectorAll("td.english_grade");
  if (englishGradeTds.length >= 2) {
    const gradeText = cleanText((englishGradeTds[1] as Element).textContent || "").trim();
    if (gradeText && gradeText.length > 1) {
      gradeEn = gradeText;
      // Normalize: extract the grade word from text like "Sahih (Darussalam)"
      const lower = gradeText.toLowerCase();
      if (lower.includes("maudu") || lower.includes("fabricat")) {
        normalized = "maudu";
      } else if (lower.includes("daif") || lower.includes("da'if") || lower.includes("weak")) {
        normalized = "daif";
      } else if (lower.includes("hasan sahih") || lower.includes("sahih hasan")) {
        normalized = "hasan sahih";
      } else if (lower.includes("hasan")) {
        normalized = "hasan";
      } else if (lower.includes("sahih")) {
        normalized = "sahih";
      }
    }
  }

  // Get Arabic grade from 2nd td.arabic_grade
  const arabicGradeTds = gradeTable.querySelectorAll("td.arabic_grade");
  if (arabicGradeTds.length >= 2) {
    const gradeText = cleanArabicText((arabicGradeTds[1] as Element).textContent || "").trim();
    if (gradeText && gradeText.length > 1) {
      gradeAr = gradeText;
    }
  }

  return { grade_en: gradeEn, grade_ar: gradeAr, normalized };
}

/**
 * Extract grade from container (for compilations - legacy)
 */
function extractSourceGrade(container: Element): string | null {
  // First try .gradetable (used by most collections)
  const { normalized } = extractGrades(container);
  if (normalized) return normalized;

  const gradeEl = container.querySelector(".grade, .hadith_grade");
  if (gradeEl) {
    const text = gradeEl.textContent?.toLowerCase() || "";
    if (text.includes("sahih")) return "sahih";
    if (text.includes("hasan")) return "hasan";
    if (text.includes("daif") || text.includes("da'if") || text.includes("weak")) return "daif";
  }

  // Fallback: Check text
  const containerText = (container.textContent || "").toLowerCase();
  const patterns = [
    /(?:grade|status)\s*:?\s*(sahih|hasan|da['']?if|weak)/i,
    /hadith\s+(sahih|hasan|da['']?if)/i,
    /\((sahih|hasan|da['']?if)\)/i,
  ];

  for (const pattern of patterns) {
    const match = containerText.match(pattern);
    if (match) {
      const grade = match[1].toLowerCase();
      if (grade === "weak" || grade.includes("daif") || grade.includes("da'if")) return "daif";
      return grade;
    }
  }

  return null;
}

/**
 * Extract narrator name directly from the .hadith_narrated DOM element text
 * This is much simpler since the text is already isolated
 * Examples:
 * - "Abu Huraira reported:" -> "Abu Huraira"
 * - "It is narrated on the authority of Abu Huraira that..." -> "Abu Huraira"
 * - "'A'isha (Allah be pleased with her) said:" -> "A'isha"
 */
function extractNarratorFromNarrated(text: string): string | null {
  if (!text || text.length < 3) return null;

  // Clean the text
  text = text.trim();

  // Pattern 1 (PRIORITY): "Narrated X:" - must check first before other patterns
  // This handles the common format "Narrated Said bin Jubair:"
  const narratedMatch = text.match(/^Narrated\s+(['`']?[A-Z][a-z''`]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-?|bint\s+)?[A-Za-z''`-]+)*)/i);
  if (narratedMatch) {
    const narrator = narratedMatch[1];
    // Make sure we didn't accidentally match "Narrated" as the narrator
    if (narrator.toLowerCase() !== "narrated") {
      return cleanNarratorName(narrator);
    }
  }

  // Pattern 2: "X reported:" or "X said:" - name at start (but not if name is "Narrated")
  const simpleMatch = text.match(/^['`']?([A-Z][a-z''`]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-?|Al-|an-)?[A-Za-z''`-]+)*)\s*(?:\([^)]+\))?\s*(?:reported|said|narrated)/i);
  if (simpleMatch) {
    const narrator = simpleMatch[1];
    // Skip if the "name" is actually the word "Narrated"
    if (narrator.toLowerCase() !== "narrated") {
      return cleanNarratorName(narrator);
    }
  }

  // Pattern 3: "Abu X reported:" or "Ibn X said:"
  const prefixMatch = text.match(/^((?:Abu\s+|Ibn\s+|Umm\s+)[A-Z][a-z''`]+(?:\s+(?:b\.\s*|al-?)?[A-Za-z''`-]+)*)\s*(?:\([^)]+\))?\s*(?:reported|said|narrated)/i);
  if (prefixMatch) {
    return cleanNarratorName(prefixMatch[1]);
  }

  // Pattern 4: "It is narrated on the authority of X that..."
  const authorityMatch = text.match(/(?:on the authority of|narrated (?:on the authority of|by|from))\s+(['`']?[A-Z][a-z''`]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-?)?[A-Za-z''`-]+)*)/i);
  if (authorityMatch) {
    return cleanNarratorName(authorityMatch[1]);
  }

  return null;
}

/**
 * Clean narrator name by removing parenthetical content and extra whitespace
 */
function cleanNarratorName(name: string): string | null {
  if (!name) return null;
  // Remove parenthetical content like "(Allah be pleased with him)"
  name = name.replace(/\s*\([^)]+\)\s*/g, " ").trim();
  // Remove leading quotes
  name = name.replace(/^['`']+/, "");
  // Clean up whitespace
  name = name.replace(/\s+/g, " ").trim();
  return name.length > 2 && name.length < 100 ? name : null;
}

/**
 * Extract narrator name (regex fallback for when DOM extraction fails)
 */
function extractNarrator(text: string): string | null {
  // Common name pattern: handles Abu X, Ibn X, Umm X, 'Abdullah, Al-X, an-X, Abu'l-X, etc.
  // Also handles backtick ` as apostrophe variant
  const namePattern = "(?:Abu[d]?(?:'l-)?\\s*|Ibn\\s+|Umm\\s+)?[A-Z''`][a-z''`]+(?:\\s+(?:b\\.\\s*|bin\\s+|ibn\\s+|al-?|Al-|an-)[A-Za-z''`-]+)*";

  const patterns = [
    // === Muslim format: "Name (Allah be pleased with him) reported/said" (without "May") ===
    new RegExp(`^['']?(${namePattern})\\s*\\(Allah be pleased with (?:him|her|them)\\)\\s*(?:said|reported)`, "i"),

    // === Riyadussalihin format: "Name (May Allah be pleased with him) said/reported:" ===
    new RegExp(`^(${namePattern})\\s*\\(May Allah be pleased with (?:him|her|them)\\)\\s*(?:said|reported)`, "i"),

    // === Muslim format: "Name reported Allah's Messenger/Messsenger (typo with 3 s)" ===
    new RegExp(`^['']?(${namePattern})\\s+reported\\s+(?:Allah's\\s+)?(?:Messenger|Messsenger|Prophet|Apostle)`, "i"),

    // === Muslim format: "'A'isha reported that there was..." ===
    new RegExp(`^['']?(${namePattern})\\s+reported\\s+that\\s+(?:there|the|he|she|when|a|one|it|whenever)`, "i"),

    // === "Name bint X said:" - women with bint ===
    /^['']?([A-Z][a-z']+\s+bint\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|reported)/i,

    // === "Name, the freed slave/wife of... reported" ===
    /^['']?([A-Z][a-z']+(?:\s+(?:b\.\s*)?[A-Za-z'-]+)*),\s+the\s+(?:freed\s+slave|wife|mother)\s+of\s+[^,]+,?\s*(?:said|reported)/i,

    // === "Name is reported as saying:" ===
    new RegExp(`^['']?(${namePattern})\\s+is\\s+reported\\s+as\\s+saying`, "i"),

    // === "Name says: I heard..." ===
    new RegExp(`^['']?(${namePattern})\\s+says:\\s*I\\s+heard`, "i"),

    // === "X told that Y said" - extract X ===
    new RegExp(`^['']?(${namePattern})\\s+told\\s+that`, "i"),

    // === "X heard Y as saying" - extract Y ===
    /heard\s+((?:Abu\s+)?[A-Z][a-z']+(?:\s+(?:b\.\s*|al-)[A-Za-z'-]+)*)\s+as\s+saying/i,

    // === "Ibn X said:" - simple Ibn pattern ===
    /^(Ibn\s+['']?[A-Z][a-z]+)\s+said:/i,

    // === "It is narrated from X that" ===
    /It is narrated from\s+(['']?[A-Z][a-z]+(?:\s+(?:b\.\s*|al-)?[A-Za-z'-]+)*)\s+that/i,

    // === "X reported the Messenger... to have said" ===
    new RegExp(`^['']?(${namePattern})\\s+reported\\s+the\\s+Messenger`, "i"),

    // === "Umm X daughter of Y reported" ===
    /^(Umm\s+[A-Z][a-z]+\s+daughter\s+of\s+[A-Z][a-z]+)\s+(?:said|reported)/i,

    // === "X, the son/daughter of Y, reported" ===
    /^(['']?[A-Z][a-z'-]+),?\s+the\s+(?:son|daughter)\s+of\s+[^,]+,?\s*reported/i,

    // === "Abu al. X said:" - name with "al. " (space after) ===
    /^(Abu\s+al\.\s*['']?[A-Z][a-z'-]+(?:\s+(?:b\.\s*)?[A-Za-z'-]+)*)\s+said:/i,

    // === "Zainab bint X (description) reported" ===
    /^(['']?[A-Z][a-z]+\s+bint\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\([^)]+\)\s*reported/i,

    // === Handle backticks: `Abdullah (b. Mas`ud) said: ===
    /^`([A-Z][a-z]+)\s*\([^)]+\)\s*said:/i,

    // === "X reported it from his father/mother:" ===
    new RegExp(`^['']?(${namePattern})\\s+reported\\s+it\\s+from\\s+(?:his|her)\\s+(?:father|mother)`, "i"),

    // === "It is reported from X that she/he observed:" ===
    /It is reported from\s+(['']?[A-Z][a-z']+)\s+that\s+(?:she|he)\s+observed/i,

    // === "X the wife/husband of the Messenger reported" ===
    /^(['']?[A-Z][a-z']+)\s+the\s+(?:wife|husband)\s+of\s+(?:the\s+)?(?:Messenger|Prophet|Holy\s+Prophet)/i,

    // === "X reported with regard to" ===
    new RegExp(`^['']?(${namePattern})\\s+reported\\s+with\\s+regard\\s+to`, "i"),

    // === "X reported that so far as" ===
    new RegExp(`^['']?(${namePattern})\\s+reported\\s+that\\s+so\\s+far`, "i"),

    // === "'A'isha said:" / "Rabi'a b. Ka'b said:" - simple patterns ===
    /^['']([A-Z][a-z']+)\s+said:/i,
    /^([A-Z][a-z']+(?:\s+b\.\s+[A-Z][a-z']+)+)\s+said:/i,

    // === "Abu Anas reported that Uthman performed" - X reported that Y ===
    new RegExp(`^(${namePattern})\\s+reported\\s+that\\s+[A-Z][a-z]+\\s+(?:performed|said|did|went)`, "i"),

    // === "X reported from the Messenger" ===
    new RegExp(`^['']?(${namePattern})\\s+reported\\s+from\\s+(?:the\\s+)?(?:Messenger|Prophet|Apostle)`, "i"),

    // === "X quoted the Messenger" ===
    new RegExp(`^['']?(${namePattern})\\s+quoted\\s+(?:the\\s+)?(?:Messenger|Prophet|Apostle)`, "i"),

    // === "Ibn Sirin reported X as saying:" ===
    /reported\s+((?:Abu\s+)?[A-Z][a-z]+(?:\s+(?:b\.\s*|al-)?[A-Za-z'-]+)*)\s+as\s+saying/i,

    // === "X reported. I heard" (period after reported) ===
    new RegExp(`^['']?(${namePattern})\\s+reported\\.\\s+I\\s+heard`, "i"),

    // === "X (also) said:" or "X (something) reported:" ===
    /^['']?([A-Z][a-z']+)\s*\([^)]+\)\s*(?:said|reported)/i,

    // === "'Abdullah (b. Mas'ud) reported that" ===
    /^['']?([A-Z][a-z']+)\s*\(b\.\s*[A-Z][a-z']+\)\s*reported/i,

    // === "X is reported to have said:" ===
    new RegExp(`^['']?(${namePattern})\\s+is\\s+reported\\s+to\\s+have\\s+said`, "i"),

    // === "X b. Y heard Z say:" - extract Z ===
    /heard\s+((?:Abu\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+say/i,

    // === "X (a Companion) reported" ===
    new RegExp(`^['']?(${namePattern})\\s*\\([^)]*[Cc]ompanion[^)]*\\)\\s*reported`, "i"),

    // === "X said he heard" ===
    new RegExp(`^['']?(${namePattern})\\s+said\\s+he\\s+heard`, "i"),

    // === "X observed that" or "X thus reported" ===
    new RegExp(`^['']?(${namePattern})\\s+(?:observed|thus\\s+reported)\\s+that`, "i"),

    // === "X asked Y" - extract X ===
    new RegExp(`^['']?(${namePattern})\\s+asked\\s+['']?[A-Z]`, "i"),

    // === "X wrote to Y:" ===
    new RegExp(`^['']?(${namePattern})\\s+wrote\\s+to\\s+[A-Z]`, "i"),

    // === "X reported Allah's Apostle/Messenger" (variation) ===
    new RegExp(`^['']?(${namePattern})\\s+reported\\s+Allah's\\s+(?:Apostle|Messenger)`, "i"),

    // === "X told of Y saying" - extract Y ===
    /told of\s+((?:Abu\s+)?[A-Z][a-z]+(?:\s+(?:b\.\s*)?[A-Za-z'-]+)*)\s+(?:saying|as\s+saying)/i,

    // === Fallback: Any name at start + said/reported + colon or content ===
    /^((?:Abu\s+|Ibn\s+|Umm\s+|Al-)?[A-Z][a-z']+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)?[A-Za-z''-]+)*)\s+(?:said|reported)(?::|,?\s+(?:that\s+)?(?:the|he|she|when|Allah|I|a\s+))/i,

    // === Standard patterns ===
    // "On the authority of X (blessing) — description" - handles em-dash, requires space before dash
    /On the authority of\s+([^(,]+?)(?:\s*\([^)]+\))?(?:\s*,|\s+[—–-]|\s+who|\s+that|\s+from|\s*:)/i,
    /Narrated\s+([^:]+):/i,
    /It was narrated (?:from|by|that)\s+([^:,]+)/i,
    /It is narrated on the authority of\s+([^:,]+)/i,
    /([A-Z][^:]+)\s+reported:/i,

    // Malik format: "He said, Yahya related to me from Malik from X"
    /related to me from Malik[^f]*from\s+([A-Z][^,]+)/i,
    /related to me from\s+([A-Z][a-z]+(?:\s+(?:ibn|bin|al-)[A-Za-z-]+)*)/i,

    // "X said that Y" or "X related that"
    /([A-Z][a-z]+(?:\s+(?:ibn|bin|al-)[A-Za-z-]+)*)\s+(?:said|related)\s+that/i,

    // Muslim patterns: "X is reported to have said", "X reported from the Messenger"
    /^([A-Z][a-z']+(?:\s+(?:b\.|bin|ibn|al-)[A-Za-z'-]+)*)\s+(?:is\s+)?reported\s+(?:to\s+have\s+said|from|it\s+from)/i,
    /^([A-Z][a-z']+(?:\s+(?:b\.|bin|ibn|al-)[A-Za-z'-]+)*)\s+narrated\s+from/i,

    // "Al-Bara reported from the Messenger"
    /^(Al-[A-Z][a-z']+)\s+reported\s+from/i,

    // "Abdullah b. X reported"
    /^([A-Z][a-z']+(?:\s+b\.\s+[A-Za-z'-]+)+)\s+(?:reported|narrated)/i,

    // Names starting with single/curly quote: 'Abdullah or 'Abdullah
    /^['']([A-Z][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)\s+(?:is\s+)?reported/i,

    // "I heard X narrating" or "I heard X saying" - X can be "Abu Dharr" etc
    /I heard\s+((?:Abu\s+)?[A-Z][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)\s+(?:narrat|say)/i,

    // "It is narrated by X that Y" - extract X, space after "b." allowed
    /It is narrated by\s+((?:Abu\s+)?[A-Z''][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)\s+that/i,

    // "It is reported from/by X that"
    /It is reported (?:from|by)\s+((?:Abu\s+)?[A-Z''][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)/i,

    // "X transmitted it from" - X can be "Anas b. Malik"
    /^((?:Abu\s+)?[A-Z''][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)\s+transmitted\s+it\s+from/i,

    // "Abu Huraira reported that Muhammad/the Messenger"
    /^(Abu\s+[A-Z][a-z]+)\s+reported\s+that\s+(?:Muhammad|the\s+Messenger|Allah)/i,

    // "X reported that Muhammad" where X is regular name with b./bin
    /^([A-Z''][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)\s+reported\s+that\s+(?:Muhammad|the\s+Messenger)/i,

    // "Qatada reported that he heard X saying" - extract X
    /reported that he heard\s+((?:Abu\s+)?[A-Z][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)/i,

    // "X who was one of the Companions...reported" - X can be "Jabir b. 'Abdullah"
    /^((?:Abu\s+)?[A-Z''][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)\s+(?:al-[A-Za-z]+\s+)?who\s+was/i,

    // "X said:" or "X reported:" (fallback for simple cases like "Abu Huraira said:")
    /^((?:Abu\s+)?[A-Z''][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)\s+(?:said|reported):/i,

    // "Suhaib reported the Apostle" (name + reported + the Apostle/Prophet)
    /^((?:Abu\s+)?[A-Z''][a-z]+)\s+reported\s+the\s+(?:Apostle|Prophet)/i,

    // === Additional Muslim/Riyadussalihin patterns ===
    // "X heard Y reporting it from the Messenger" - extract Y
    /heard\s+((?:Abu\s+)?[A-Z][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)\s+(?:b\.\s+[A-Za-z]+\s+)?report/i,

    // "X was delivering an address and saying:"
    /^((?:Abu\s+|Ibn\s+|Umm\s+)?[A-Z''][a-z]+(?:\s+(?:b\.\s*|bin\s+|ibn\s+|al-)[A-Za-z''-]+)*)\s+was\s+(?:delivering|saying|speaking)/i,

    // "X reported to us:" pattern
    /^((?:Abu\s+|Al-)?[A-Z][a-z]+(?:-[A-Z][a-z]+)?)\s+reported\s+to\s+us/i,

    // === Additional patterns for Muslim ===
    // "X repotted/reported" - handle typo
    new RegExp(`^['']?(${namePattern})\\s+(?:repotted|repoorted)\\s+`, "i"),

    // "X, said:" - comma before said
    new RegExp(`^['']?(${namePattern}),\\s*said:`, "i"),

    // "X reported (that..." - parenthesis after reported
    new RegExp(`^['']?(${namePattern})\\s+reported\\s*\\(`, "i"),

    // "X is reported to have heard"
    new RegExp(`^['']?(${namePattern})\\s+is\\s+reported\\s+to\\s+have\\s+heard`, "i"),

    // "X reported that Y took/gave/sent/came" - more verbs
    new RegExp(`^['']?(${namePattern})\\s+reported\\s+that\\s+[A-Z][a-z']+(?:\\s+(?:b\\.\\s*)?[A-Za-z'-]+)*\\s+(?:took|gave|sent|came|went|struck|entered|used|asked|forbade)`, "i"),

    // "X told that Y said" - extract X
    new RegExp(`^['']?(${namePattern})\\s+told\\s+that\\s+['']?[A-Z]`, "i"),

    // "Kuraib reported that Umm Fadl" etc - X reported that Y (more flexible)
    new RegExp(`^([A-Z][a-z]+)\\s+reported\\s+that\\s+(Umm|Abu|Ibn)\\s+`, "i"),

    // "X was delivering...and saying:" with :I (no space)
    new RegExp(`^['']?(${namePattern})\\s+was\\s+[^:]+and\\s+saying:`, "i"),

    // === More Muslim patterns ===
    // "X (Allah be pleased with him/her/them/both of them) said that"
    /^[''`]?([A-Z''`][a-z''`]+(?:\s+(?:b\.\s*|al-?\s*)?[A-Za-z''`-]+)*)\s*\(Allah be pleased with (?:him|her|them|both of them)\)\s*(?:said|reported)\s+that/i,

    // Handle backtick names: `A'isha
    /^`([A-Z][a-z'`]+(?:\s+(?:b\.\s*)?[A-Za-z'`-]+)*)\s*(?:,\s*the\s+wife|\s*\(Allah)/i,

    // "X told that Y said" - extract X
    /^[''`]?([A-Z][a-z''`]+(?:\s+(?:b\.\s*)?[A-Za-z''`-]+)*)\s+told\s+that\s+[''`]?[A-Z]/i,

    // "Abu'l-X told/said/reported"
    /^(Abu'l-[A-Z][a-z-]+)\s+(?:told|said|reported)/i,

    // "X was asked about"
    /^[''`]?([A-Z][a-z''`]+(?:\s+(?:b\.\s*)?[A-Za-z''`-]+)*)\s+was\s+asked\s+about/i,

    // "X said to Y" - extract X
    /^[''`]?([A-Z][a-z''`]+(?:\s+(?:b\.\s*)?[A-Za-z''`-]+)*)\s+said\s+to\s+[''`]?[A-Z]/i,

    // "X and Y reported" - extract X
    /^[''`]?([A-Z][a-z''`]+(?:\s+(?:b\.\s*)?[A-Za-z''`-]+)*)\s*\([^)]+\)\s*and\s+[A-Z][a-z]+\s+(?:reported|said)/i,

    // "Abu Nadra reported X as saying" - extract X
    /reported\s+([A-Z][a-z''`]+(?:\s+(?:b\.\s*|al-?\s*)?[A-Za-z''`-]+)*)\s+as\s+saying/i,

    // === Final Muslim patterns ===
    // "X, (Allah be pleased..." - comma before parenthesis
    /^[''`]?([A-Z][a-z''`]+(?:\s+(?:b\.\s*|al\.?\s*)?[A-Za-z''`-]+)*),?\s*\(Allah be pleased/i,

    // "X reported; I" - semicolon after reported
    /^[''`]?([A-Z][a-z''`]+(?:\s+(?:b\.\s*)?[A-Za-z''`-]+)*)\s+reported[;:]/i,

    // "X (reported) that" - parenthesis around reported
    /^[''`]?([A-Z][a-z''`]+(?:\s+(?:b\.\s*)?[A-Za-z''`-]+)*)\s+\(reported\)\s+that/i,

    // Handle "al. " (period + space) in names like "Abu Sa'id al. Khudri"
    /^(Abu\s+[A-Z][a-z''`]+\s+al\.\s*[A-Z][a-z]+)\s+(?:reported|said)/i,

    // "X reported that some/the/a (people/person)" - more variants
    /^[''`]?([A-Z][a-z''`]+(?:\s+(?:b\.\s*|al-?\s*)?[A-Za-z''`-]+)*)\s+reported\s+that\s+(?:some|the|a|once|when|he|she|it)/i,

    // Typos in names: Ahdullah, etc - just extract first capital word
    /^(Ahd?ullah)\s+(?:b\.\s*)?[A-Za-z]+\s+(?:reported|\(reported\))/i,

    // "X heardY" - no space (typo)
    /^([A-Z][a-z]+\s+al-[A-Z][a-z]+)\s+heard[A-Z]/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let narrator = match[1].trim();
      narrator = narrator.replace(/\s+who\s+said.*$/i, "").trim();
      narrator = narrator.replace(/\s*\([^)]+\)\s*/g, " ").trim();
      // Skip if the "name" is actually the word "Narrated" (false positive)
      if (narrator.toLowerCase() === "narrated") {
        continue;
      }
      if (narrator.length > 2 && narrator.length < 100) {
        return narrator;
      }
    }
  }

  return null;
}

/**
 * Strip narrator intro from English matn text when no .hadith_narrated DOM element exists.
 * Handles patterns like:
 * - "It was narrated from X that..." → isnad = "It was narrated from X", matn = rest
 * - "It was narrated that X said:" → isnad = "It was narrated that X said", matn = rest
 * - "Narrated X: ..." → isnad = "Narrated X", matn = rest
 * Returns null if no narrator intro pattern is found.
 */
function stripEnglishNarratorIntro(text: string): { isnad: string; matn: string } | null {
  if (!text || text.length < 10) return null;

  // Pattern 1: "It was narrated from/that X that ..." — split at the last "that "
  // e.g., "It was narrated from Abu Hurairah that the Messenger of Allah said: ..."
  const itWasMatch = text.match(
    /^(It was narrated (?:from|that|on the authority of)\s+[^.]+?\s+that)\s+/i
  );
  if (itWasMatch) {
    const isnad = itWasMatch[1].trim();
    const matn = text.slice(itWasMatch[0].length).trim();
    if (matn.length > 5) {
      return { isnad, matn };
    }
  }

  // Pattern 2: "It was narrated from X:" — split at colon
  const itWasColonMatch = text.match(
    /^(It was narrated (?:from|that|by)\s+[^:]+):\s*/i
  );
  if (itWasColonMatch) {
    const isnad = itWasColonMatch[1].trim();
    const matn = text.slice(itWasColonMatch[0].length).trim();
    if (matn.length > 5) {
      return { isnad, matn };
    }
  }

  // Pattern 3: "Narrated X:" — split at colon
  const narratedMatch = text.match(/^(Narrated\s+[^:]+):\s*/i);
  if (narratedMatch) {
    const isnad = narratedMatch[1].trim();
    const matn = text.slice(narratedMatch[0].length).trim();
    if (matn.length > 5) {
      return { isnad, matn };
    }
  }

  return null;
}

/**
 * Extract isnad from English text
 */
function extractIsnadEn(text: string): string | null {
  const authorityMatch = text.match(/^(On the authority of[^:]+):/i);
  if (authorityMatch) {
    return authorityMatch[1].trim();
  }

  const narratedMatch = text.match(/^(Narrated[^:]+):/i);
  if (narratedMatch) {
    return narratedMatch[1].trim();
  }

  // Malik format: "He said, Yahya related to me from Malik from X from Y that..."
  const malikMatch = text.match(/^(He said,?\s*"?[^"]*related to me from[^t]+)that/i);
  if (malikMatch) {
    return malikMatch[1].replace(/"$/, "").trim();
  }

  // Generic "X related to me from Y" pattern
  const relatedMatch = text.match(/^([A-Z][^.]+related to me from[^.]+?)(?:that|\.)/i);
  if (relatedMatch) {
    return relatedMatch[1].trim();
  }

  const colonIdx = text.indexOf(":");
  if (colonIdx > 0 && colonIdx < 150) {
    const isnad = text.substring(0, colonIdx).trim();
    if (isnad.length > 5 && isnad.length < 200) {
      return isnad;
    }
  }

  return null;
}

/**
 * Arabic narration verbs that indicate isnad chain continuation.
 * When قَالَ is followed by one of these, it's still part of the isnad.
 * All strings are NFC-normalized to handle varying diacritics ordering from sunnah.com.
 */
const ARABIC_NARRATION_VERBS = [
  "حَدَّثَنَا", "حَدَّثَنِي", "حَدَّثَنَاهُ",
  "أَخْبَرَنَا", "أَخْبَرَنِي",
  "أَنْبَأَنَا", "أَنْبَأَنِي",
  "سَمِعْتُ", "سَمِعَ",
].map(v => v.normalize("NFC"));

/**
 * Check if Arabic text starts with an isnad pattern (narration verb).
 * Uses NFC normalization to handle varying diacritics ordering.
 */
function startsWithIsnadPattern(text: string): boolean {
  const trimmed = text.trimStart().normalize("NFC");
  return ARABIC_NARRATION_VERBS.slice(0, 7).some(verb => trimmed.startsWith(verb));
}

/**
 * Split combined Arabic text into isnad (chain of narration) and matn (hadith content).
 *
 * Arabic isnad chains use narration verbs (حَدَّثَنَا/أَخْبَرَنَا/أَنْبَأَنَا)
 * connecting narrator names via عَنْ/قَالَ. The transition to matn occurs at:
 * 1. The first قَالَ/يَقُولُ NOT followed by a narration verb
 * 2. أَنَّ followed by رَسُولَ/النَّبِيَّ/رَسُولُ/النَّبِيُّ
 *
 * Only activates if text starts with a narration verb.
 * Returns null if no clear split point is found.
 */
function splitIsnadFromMatn(text: string): { isnad: string; matn: string } | null {
  if (!text || !startsWithIsnadPattern(text)) return null;

  // Normalize to NFC for consistent diacritics ordering
  const normalized = text.normalize("NFC");

  // Strategy 1: Find أَنَّ + رَسُولَ/النَّبِيَّ — the matn starts at أَنَّ
  // This pattern means "that the Messenger/Prophet..." which introduces the matn
  const annaPattern = "أَنَّ".normalize("NFC");
  const rasulPatterns = ["رَسُولَ", "النَّبِيَّ", "رَسُولُ", "النَّبِيُّ", "نَبِيَّ"].map(s => s.normalize("NFC"));
  let annaMatch: { index: number } | null = null;

  let annaIdx = normalized.indexOf(annaPattern);
  while (annaIdx !== -1) {
    const afterAnna = normalized.slice(annaIdx + annaPattern.length).trimStart();
    if (rasulPatterns.some(p => afterAnna.startsWith(p))) {
      annaMatch = { index: annaIdx };
      break;
    }
    annaIdx = normalized.indexOf(annaPattern, annaIdx + 1);
  }

  // Strategy 2: Find all قَالَ / يَقُولُ positions, pick first not followed by narration verb
  const qalaStr = "قَالَ".normalize("NFC");
  const yaquluStr = "يَقُولُ".normalize("NFC");
  let bestSplit: number | null = null;

  // Scan for قَالَ and يَقُولُ positions
  for (let i = 0; i < normalized.length; i++) {
    let matchLen = 0;
    if (normalized.startsWith(qalaStr, i)) {
      matchLen = qalaStr.length;
    } else if (normalized.startsWith(yaquluStr, i)) {
      matchLen = yaquluStr.length;
    }
    if (matchLen === 0) continue;

    const afterPos = i + matchLen;
    // Strip leading whitespace and punctuation (commas between قَالَ and next verb)
    const remaining = normalized.slice(afterPos).replace(/^[\s،,:.]+/, "");

    // Check if the next word is a narration verb (still in isnad)
    let isNarrationContinuation = false;
    for (const verb of ARABIC_NARRATION_VERBS) {
      if (remaining.startsWith(verb)) {
        isNarrationContinuation = true;
        break;
      }
    }

    if (!isNarrationContinuation) {
      // This قَالَ transitions to matn — split AFTER قَالَ
      bestSplit = afterPos;
      break;
    }

    // Skip past this match to avoid re-matching substrings
    i = afterPos - 1;
  }

  // Pick the earliest transition point between the two strategies
  let splitIndex: number | null = null;

  if (annaMatch?.index != null && bestSplit != null) {
    splitIndex = Math.min(annaMatch.index, bestSplit);
  } else if (annaMatch?.index != null) {
    splitIndex = annaMatch.index;
  } else if (bestSplit != null) {
    splitIndex = bestSplit;
  }

  if (splitIndex == null) return null;

  const isnad = normalized.slice(0, splitIndex).trim();
  const matn = normalized.slice(splitIndex).trim();

  // Sanity checks: both parts should have meaningful content
  // and isnad shouldn't be too large (>80% of text suggests bad split)
  if (isnad.length < 5 || matn.length < 5) return null;
  if (isnad.length > normalized.length * 0.85) return null;

  return { isnad, matn };
}

/**
 * Extract isnad from Arabic text
 */
function extractIsnadAr(text: string): string | null {
  const patterns = [
    /(حَدَّثَنَا[^]*?)(?:قَالَ\s+قَالَ|أَنَّ\s+رَسُولَ|:)/,
    /(أَخْبَرَنَا[^]*?)(?:قَالَ\s+قَالَ|أَنَّ\s+رَسُولَ|:)/,
    /(عَنْ[^]*?)(?:قَالَ\s+قَالَ|أَنَّ\s+رَسُولَ)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1].length > 10 && match[1].length < text.length * 0.7) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Clean Arabic text - removes invisible Unicode characters from sunnah.com HTML
 */
function cleanArabicText(text: string): string {
  return text
    // Remove invisible Unicode characters (RLM, LRM, ZWSP, ZWJ, ZWNJ, BOM)
    .replace(/[\u200F\u200E\u200B\u200C\u200D\uFEFF]/g, "")
    // Convert NBSP to regular space
    .replace(/\u00A0/g, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean English text by removing artifacts
 */
function cleanEnglishText(text: string): string {
  return text
    // Remove JavaScript artifacts
    .replace(/rtHadith\([^)]+\)['">\s]*/gi, "")
    .replace(/tHadith\([^)]+\)['">\s]*/gi, "")
    .replace(/Hadith\(\d+,\s*'[^']+'\)['">\s]*/gi, "")
    // Remove UI elements
    .replace(/Report Error\s*\|\s*Share\s*\|\s*Copy\s*▼?/gi, "")
    .replace(/Report Error/gi, "")
    .replace(/Share\s*\|/gi, "")
    .replace(/Copy\s*▼/gi, "")
    // Remove reference text at end
    .replace(/Reference\s*:\s*Hadith\s+\d+.*$/gi, "")
    // Remove Arabic characters
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean generic text
 */
function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
