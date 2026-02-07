/**
 * DOM parser for Hisn al-Muslim collection.
 * Parses the flat /hisn page which contains all 268 duas inline.
 *
 * HTML structure:
 *   .AllHadith
 *     <a name="C{n}.00"> + .chapter (interleaved chapter headers)
 *     .actualHadithContainer.hadith_container_hisn (dua entries)
 *       .hadithTextContainers
 *         .englishcontainer
 *           .english_hadith_full
 *             .hadith_narrated (optional context/preamble)
 *               span.transliteration (context transliteration)
 *               span.translation (context translation)
 *             .text_details
 *               span.transliteration (dua transliteration)
 *               span.translation (dua translation)
 *               span.hisn_english_reference (source reference)
 *         .arabic_hadith_full
 *           span.arabic_text_details (arabic dua text — sometimes missing)
 */

import { DOMParser, type Element } from "deno-dom";
import type { ScrapedDua, ScrapedHisnChapter } from "./types.ts";

// ============================================================================
// Text Cleaning
// ============================================================================

function cleanArabicText(text: string): string {
  return text
    .replace(/[\u200F\u200E\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function cleanEnglishText(text: string): string {
  return text
    .replace(/rtHadith\([^)]+\)['">\s]*/gi, "")
    .replace(/tHadith\([^)]+\)['">\s]*/gi, "")
    .replace(/Hadith\(\d+,\s*'[^']+'\)['">\s]*/gi, "")
    .replace(/Report Error\s*\|\s*Share\s*\|\s*Copy\s*▼?/gi, "")
    .replace(/Report Error/gi, "")
    .replace(/Share\s*\|/gi, "")
    .replace(/Copy\s*▼/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// Chapter Extraction
// ============================================================================

function extractChapters(doc: ReturnType<DOMParser["parseFromString"]>): ScrapedHisnChapter[] {
  const chapters: ScrapedHisnChapter[] = [];
  const seen = new Set<number>();

  const chapterDivs = doc.querySelectorAll(".chapter");

  for (const div of chapterDivs) {
    const el = div as unknown as Element;

    // Extract chapter number
    const echapno = el.querySelector(".echapno");
    if (!echapno) continue;

    const numMatch = echapno.textContent.match(/\((\d+)\)/);
    if (!numMatch) continue;

    const chapterNum = parseInt(numMatch[1], 10);
    if (seen.has(chapterNum)) continue;
    seen.add(chapterNum);

    // Extract names
    const engChapter = el.querySelector(".englishchapter");
    const arChapter = el.querySelector(".arabicchapter");

    let nameEn = engChapter?.textContent?.trim() ?? null;
    if (nameEn) {
      // Remove "Chapter: " prefix if present
      nameEn = nameEn.replace(/^Chapter:\s*/i, "").trim();
      nameEn = cleanText(nameEn);
    }

    let nameAr = arChapter?.textContent?.trim() ?? null;
    if (nameAr) {
      nameAr = cleanArabicText(nameAr);
    }

    chapters.push({
      chapter_number: chapterNum,
      name_en: nameEn || null,
      name_ar: nameAr || null,
    });
  }

  return chapters;
}

// ============================================================================
// Dua Extraction
// ============================================================================

/**
 * Determine which chapter a dua container belongs to by walking backward
 * through preceding siblings to find the nearest .chapter div.
 */
function findChapterForContainer(container: Element): number | null {
  let sibling = container.previousElementSibling;
  while (sibling) {
    const el = sibling as unknown as Element;
    if (el.classList?.contains("chapter")) {
      const echapno = el.querySelector(".echapno");
      if (echapno) {
        const match = echapno.textContent.match(/\((\d+)\)/);
        if (match) return parseInt(match[1], 10);
      }
    }
    sibling = el.previousElementSibling;
  }
  return null;
}

/**
 * Extract dua number from the container.
 * Looks at .hadith_reference_sticky, anchor names, and reference table.
 */
function extractDuaNumber(container: Element): string | null {
  // Try .hadith_reference_sticky first
  const sticky = container.querySelector(".hadith_reference_sticky");
  if (sticky) {
    const match = sticky.textContent.match(/Hisn al-Muslim\s+(\d+[a-z]?)/i);
    if (match) return match[1];
  }

  // Try anchor name
  const anchor = container.querySelector("a[name]");
  if (anchor) {
    const name = (anchor as unknown as Element).getAttribute("name");
    if (name && /^\d+[a-z]?$/.test(name)) return name;
  }

  // Try reference table
  const refTable = container.querySelector(".hadith_reference");
  if (refTable) {
    const match = refTable.textContent.match(/Hisn al-Muslim\s+(\d+[a-z]?)/i);
    if (match) return match[1];
  }

  return null;
}

/**
 * Parse a single dua container into a ScrapedDua.
 */
function parseDuaContainer(container: Element, chapterNumber: number): ScrapedDua | null {
  const duaNumber = extractDuaNumber(container);
  if (!duaNumber) return null;

  // -- English section --
  let transliteration: string | null = null;
  let translation: string | null = null;
  let contextEn: string | null = null;
  let contextTransliteration: string | null = null;
  let hisnReference: string | null = null;

  const textDetails = container.querySelector(".text_details");
  if (textDetails) {
    const el = textDetails as unknown as Element;

    // Main transliteration
    const translitSpan = el.querySelector("span.transliteration");
    if (translitSpan) {
      transliteration = cleanText(translitSpan.textContent);
      if (!transliteration) transliteration = null;
    }

    // Main translation
    const transSpan = el.querySelector("span.translation");
    if (transSpan) {
      translation = cleanEnglishText(transSpan.textContent);
      if (!translation) translation = null;
    }

    // Source reference
    const refSpan = el.querySelector("span.hisn_english_reference");
    if (refSpan) {
      hisnReference = cleanText(refSpan.textContent);
      if (!hisnReference) hisnReference = null;
    }
  }

  // -- Context from .hadith_narrated (optional) --
  const narrated = container.querySelector(".hadith_narrated");
  if (narrated) {
    const el = narrated as unknown as Element;

    // Context transliteration
    const ctxTranslit = el.querySelector("span.transliteration");
    if (ctxTranslit) {
      contextTransliteration = cleanText(ctxTranslit.textContent);
      if (!contextTransliteration) contextTransliteration = null;
    }

    // Context translation
    const ctxTrans = el.querySelector("span.translation");
    if (ctxTrans) {
      contextEn = cleanEnglishText(ctxTrans.textContent);
      if (!contextEn) contextEn = null;
    }

    // If no spans found, use raw text as context
    if (!contextEn && !contextTransliteration) {
      const rawText = cleanEnglishText(el.textContent);
      if (rawText) contextEn = rawText;
    }
  }

  // -- Arabic section --
  let textAr = "";

  const arabicFull = container.querySelector(".arabic_hadith_full");
  if (arabicFull) {
    const el = arabicFull as unknown as Element;

    // Try .arabic_text_details first (normal case)
    const arabicDetails = el.querySelector(".arabic_text_details");
    if (arabicDetails && arabicDetails.textContent.trim()) {
      textAr = cleanArabicText(arabicDetails.textContent);
    } else {
      // Fallback: direct text node (edge case like #32)
      // Get text content excluding child span elements
      let directText = "";
      for (const child of el.childNodes) {
        if (child.nodeType === 3) { // TEXT_NODE
          directText += child.textContent;
        }
      }
      directText = cleanArabicText(directText);

      if (directText) {
        textAr = directText;
      } else {
        // Last fallback: full element text
        textAr = cleanArabicText(el.textContent);
      }
    }
  }

  if (!textAr && !transliteration && !translation) {
    // Completely empty dua, skip
    return null;
  }

  return {
    dua_number: duaNumber,
    reference: `Hisn al-Muslim ${duaNumber}`,
    chapter_number: chapterNumber,
    text_ar: textAr,
    transliteration,
    translation,
    context_en: contextEn,
    context_transliteration: contextTransliteration,
    hisn_reference: hisnReference,
    url_source: `https://sunnah.com/hisn:${duaNumber}`,
  };
}

// ============================================================================
// Main Parse Function
// ============================================================================

export interface ParsedHisnPage {
  chapters: ScrapedHisnChapter[];
  duas: ScrapedDua[];
}

/**
 * Parse the /hisn main page HTML into structured data.
 */
export function parseHisnPage(html: string): ParsedHisnPage {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    throw new Error("Failed to parse HTML document");
  }

  // Extract chapters
  const chapters = extractChapters(doc);

  // Extract duas from all .hadith_container_hisn containers
  // No deduplication — capture all variants (e.g., 75a and 75)
  const duas: ScrapedDua[] = [];
  const containers = doc.querySelectorAll(".hadith_container_hisn");

  for (const container of containers) {
    const el = container as unknown as Element;

    const chapterNumber = findChapterForContainer(el) ?? 0;
    const dua = parseDuaContainer(el, chapterNumber);

    if (dua) {
      duas.push(dua);
    }
  }

  return { chapters, duas };
}
