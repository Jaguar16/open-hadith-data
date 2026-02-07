# Schema Documentation

## Overview

This project extracts hadith data from sunnah.com and outputs structured files (JSON, SQLite, CSV) for developers and researchers.

## Output Files

### Individual Book Files
```
data/books/{collection}/{book_number}.json
```
One file per book, containing all hadiths from that book.

### Combined Collection Files
```
data/collections/{collection}.json
```
Single file per collection with all books and hadiths combined.

---

## JSON Schema

### Collection File Structure

```json
{
  "collection": {
    "id": "bukhari",
    "name_en": "Sahih al-Bukhari",
    "name_ar": "صحيح البخاري",
    "author_en": "Imam Bukhari",
    "author_ar": "الإمام البخاري",
    "type": "primary",
    "scraped_at": "2026-02-05T16:09:43.000Z"
  },
  "books": [...],
  "hadiths": [...],  // Only for flat collections (nawawi40)
  "stats": {
    "total_books": 97,
    "total_chapters": 3570,
    "total_hadiths": 7252
  }
}
```

### Book Structure

```json
{
  "book_number": 1,
  "book_key": null,
  "name_en": "Revelation",
  "name_ar": "كتاب بدء الوحى",
  "chapters": [...],
  "hadiths": [...]
}
```

### Chapter Structure

```json
{
  "chapter_number": 1,
  "name_en": "How the Divine Revelation started",
  "name_ar": "باب كَيْفَ كَانَ بَدْءُ الْوَحْىِ"
}
```

---

## Hadith Fields

### Complete Hadith Object

```json
{
  "hadith_number": "10",
  "reference": "Sahih al-Bukhari 10",
  "in_book_reference": "Book 2, Hadith 3",
  "chapter_number": null,

  "text_ar": "حَدَّثَنَا آدَمُ... الْمُسْلِمُ مَنْ سَلِمَ... قَالَ أَبُو عَبْدِ اللَّهِ...",
  "text_en": "Narrated 'Abdullah bin 'Amr: The Prophet (ﷺ) said...",

  "isnad_ar": "حَدَّثَنَا آدَمُ بْنُ أَبِي إِيَاسٍ...",
  "isnad_en": "Narrated 'Abdullah bin 'Amr",

  "matn_ar": "الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ...",
  "matn_en": "The Prophet (ﷺ) said, \"A Muslim is the one who avoids harming Muslims...\"",

  "closing_ar": "قَالَ أَبُو عَبْدِ اللَّهِ وَقَالَ أَبُو مُعَاوِيَةَ...",

  "narrator": "Abdullah bin 'Amr",
  "has_variants": false,
  "source_reference": null,
  "source_grade": null,
  "grade_en": "Sahih (Darussalam)",
  "grade_ar": "صحيح (دار السلام)",
  "url_source": "https://sunnah.com/bukhari:10"
}
```

---

## Field Descriptions

### Identification Fields

| Field | Type | Description |
|-------|------|-------------|
| `hadith_number` | string | Hadith number within collection (e.g., "10", "8a") |
| `reference` | string | Full reference (e.g., "Sahih al-Bukhari 10") |
| `in_book_reference` | string \| null | Reference within book (e.g., "Book 2, Hadith 3") |
| `chapter_number` | number \| null | Chapter number if available |
| `url_source` | string | Direct URL to hadith on sunnah.com |

### Text Fields (Display)

| Field | Type | Description |
|-------|------|-------------|
| `text_ar` | string | **Full Arabic text** - Complete hadith for display (isnad + matn + closing) |
| `text_en` | string | **Full English text** - Complete translation for display |

### Text Fields (Content)

| Field | Type | Description |
|-------|------|-------------|
| `matn_ar` | string \| null | **Arabic hadith content** — The actual Prophet's ﷺ words/teachings |
| `matn_en` | string \| null | **English hadith content** — Translated hadith text |

### Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `isnad_ar` | string \| null | Arabic chain of narration (first sanad) |
| `isnad_en` | string \| null | English narrator introduction |
| `closing_ar` | string \| null | Additional Arabic commentary/second sanad |
| `narrator` | string \| null | Extracted narrator name |
| `has_variants` | boolean | True if hadith has variant narrations (8a, 8b, etc.) |

### Grade Fields

| Field | Type | Description |
|-------|------|-------------|
| `grade_en` | string \| null | Full English grade (e.g., "Sahih (Darussalam)") |
| `grade_ar` | string \| null | Full Arabic grade (e.g., "صحيح (دار السلام)") |

### Compilation Fields

| Field | Type | Description |
|-------|------|-------------|
| `source_reference` | string \| null | Original source (e.g., "[Bukhari and Muslim]") |
| `source_grade` | string \| null | Normalized grade (sahih, hasan, daif, maudu) |

---

## Understanding Arabic Hadith Structure

A typical hadith has 3 parts:

```
┌─────────────────────────────────────────────────────────────┐
│  ISNAD (Chain of Narration)                                 │
│  حَدَّثَنَا آدَمُ بْنُ أَبِي إِيَاسٍ، قَالَ حَدَّثَنَا شُعْبَةُ...     │
│  "Adam ibn Abi Iyas told us, Shu'ba told us..."             │
├─────────────────────────────────────────────────────────────┤
│  MATN (Hadith Content)                                      │
│  الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ        │
│  "A Muslim is one from whose tongue and hand Muslims are    │
│   safe"                                                     │
├─────────────────────────────────────────────────────────────┤
│  CLOSING (Additional Commentary) - Optional                 │
│  قَالَ أَبُو عَبْدِ اللَّهِ وَقَالَ أَبُو مُعَاوِيَةَ...              │
│  "Abu Abdullah said, Abu Mu'awiya said..."                  │
└─────────────────────────────────────────────────────────────┘
```

### Field Mapping

| Arabic Part | Field | Content |
|-------------|-------|---------|
| إسناد (Isnad) | `isnad_ar` | Chain of transmission |
| متن (Matn) | `matn_ar` | Prophet's ﷺ actual words |
| تعليق (Closing) | `closing_ar` | Scholar's commentary |
| الكل (Full) | `text_ar` | All parts combined |

---

## Using `matn_*` vs `text_*`

| Field | Contains | Best for |
|-------|----------|----------|
| `text_ar` | isnad + matn + closing | Full display |
| `matn_ar` | Only hadith content | NLP, search, analysis |
| `text_en` | narrator + translation | Full display |
| `matn_en` | Only translation | NLP, search, analysis |

For most applications (search, NLP, ML), prefer `matn_ar`/`matn_en` over `text_ar`/`text_en` — they contain only the hadith content without chains of narration.

---

## Collection Types

### Primary Collections (10)
Original hadith collections with full isnad:
- **bukhari** - Sahih al-Bukhari (97 books)
- **muslim** - Sahih Muslim (56 books)
- **malik** - Muwatta Malik (61 books)
- **nasai** - Sunan an-Nasa'i (52 books)
- **abudawud** - Sunan Abi Dawud (43 books)
- **tirmidhi** - Jami` at-Tirmidhi (49 books)
- **ibnmajah** - Sunan Ibn Majah (38 books)
- **ahmad** - Musnad Ahmad (8 books)
- **darimi** - Sunan ad-Darimi (24 books, Arabic-only)
- **adab** - Al-Adab Al-Mufrad (57 books)

### Compilation Collections (4)
Selected hadiths from other sources:
- **riyadussalihin** - Riyad as-Salihin (20 books)
- **bulugh** - Bulugh al-Maram (16 books)
- **shamail** - Ash-Shama'il Al-Muhammadiyya (57 books)
- **mishkat** - Mishkat al-Masabih (29 books)

### Flat Collections (3)
Single-page collections without book hierarchy:
- **nawawi40** - 40 Hadith an-Nawawi
- **qudsi40** - 40 Hadith Qudsi
- **shahwaliullah40** - Shah Waliullah's 40 Hadith

---

## Statistics

| Collection | Hadiths | Books | Chapters |
|------------|---------|-------|----------|
| bukhari | 7,252 | 97 | 3,570 |
| muslim | 3,087 | 56 | 1,332 |
| malik | 1,834 | 61 | 0 |
| nasai | 5,754 | 52 | 2,843 |
| abudawud | 5,274 | 43 | 1,871 |
| tirmidhi | 3,954 | 49 | 2,199 |
| ibnmajah | 4,339 | 38 | 1,574 |
| ahmad | 1,374 | 8 | 0 |
| darimi | 3,406 | 24 | 0 |
| adab | 1,322 | 57 | 631 |
| riyadussalihin | 1,896 | 20 | 368 |
| bulugh | 1,557 | 16 | 396 |
| shamail | 402 | 57 | 398 |
| mishkat | 5,306 | 29 | 194 |
| nawawi40 | 42 | 0 | 0 |
| qudsi40 | 40 | 0 | 0 |
| shahwaliullah40 | 40 | 0 | 0 |
| **Total** | **46,879** | **607** | **15,376** |

---

## Notes

### Unicode Cleaning
All Arabic text is cleaned of invisible Unicode characters:
- U+200F (RLM - Right-to-Left Mark)
- U+200E (LRM - Left-to-Right Mark)
- U+200B (ZWSP - Zero Width Space)
- U+FEFF (BOM - Byte Order Mark)

### Arabic-Only Collections
Some collections (e.g., darimi) have no English text on sunnah.com. For these, `text_en` and `matn_en` will be empty strings.

### Null Values
Fields may be `null` when:
- Data not available in source HTML
- Collection structure doesn't support it (e.g., chapters in Malik)
- Flat collection without book hierarchy (nawawi40, qudsi40, shahwaliullah40)
- Grade not provided for the collection

### Variant Hadiths
Some hadiths have multiple narrations (e.g., 8a, 8b, 8c). Only the first variant is kept, with `has_variants: true` flag set.
