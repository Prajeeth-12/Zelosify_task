/**
 * ResumeParserService – PDF / Text Extraction
 * ============================================
 * Accepts a raw file `Buffer` (from multer's memory storage) and extracts
 * the full plaintext content using `pdf-parse` (PDFParse class).
 *
 * This service is the **first stage** of the automated resume pipeline:
 *   Buffer → raw text → (FeatureExtractorService) → ScoringService
 *
 * Supported formats:
 *   • PDF  (via pdf-parse PDFParse class)
 *   • TXT  (direct buffer toString)
 *
 * Returns a `ParsedResume` object containing the raw text and page count.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
import { logger } from "../../utils/logger/logger.js";

// ─── Public types ────────────────────────────────────────────────────────────

export interface ParsedResume {
  /** Full extracted plaintext content of the resume */
  rawText: string;
  /** Number of pages (PDF only; 1 for plaintext) */
  pageCount: number;
  /** MIME type of the source file */
  mimeType: string;
}

// ─── Supported MIME types ────────────────────────────────────────────────────

const PDF_MIME = "application/pdf";
const TXT_MIME = "text/plain";

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a resume file buffer into raw text.
 *
 * @param buffer    - The file buffer (from `req.file.buffer`)
 * @param mimeType  - MIME type of the uploaded file (from `req.file.mimetype`)
 * @param filename  - Original filename (for logging)
 * @returns ParsedResume with extracted text
 *
 * @throws Error if the file type is unsupported or the PDF is unreadable
 */
export async function parseResume(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParsedResume> {
  logger.info("ResumeParserService: starting extraction", {
    meta: { filename, mimeType, bufferSize: buffer.length },
  });

  if (mimeType === PDF_MIME) {
    return parsePdf(buffer, mimeType, filename);
  }

  if (mimeType === TXT_MIME) {
    return parsePlainText(buffer, mimeType, filename);
  }

  throw new Error(
    `ResumeParserService: unsupported MIME type "${mimeType}". ` +
      `Only PDF and TXT files are supported for automated parsing.`
  );
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function parsePdf(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParsedResume> {
  try {
    const parser = new PDFParse({ data: buffer, verbosity: 0 });
    const result = await parser.getText();

    const rawText = result.text?.trim() ?? "";

    if (rawText.length === 0) {
      logger.warn("ResumeParserService: PDF yielded empty text (scanned/image PDF?)", {
        meta: { filename, pages: result.total },
      });
    }

    logger.info("ResumeParserService: PDF parsed successfully", {
      meta: {
        filename,
        pages: result.total,
        textLength: rawText.length,
      },
    });

    await parser.destroy();

    return {
      rawText,
      pageCount: result.total ?? 1,
      mimeType,
    };
  } catch (err: any) {
    logger.error("ResumeParserService: PDF parsing failed", {
      meta: { filename, error: err.message },
    });
    throw new Error(`Failed to parse PDF "${filename}": ${err.message}`);
  }
}

function parsePlainText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): ParsedResume {
  const rawText = buffer.toString("utf-8").trim();

  logger.info("ResumeParserService: plaintext parsed", {
    meta: { filename, textLength: rawText.length },
  });

  return {
    rawText,
    pageCount: 1,
    mimeType,
  };
}
