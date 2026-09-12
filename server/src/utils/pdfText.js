import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);

export const MAX_STORED_TEXT_CHARS = 80000;
export const MAX_AI_TEXT_CHARS = 12000;

export function cleanExtractedText(rawText) {
  if (!rawText) {
    return '';
  }

  return rawText
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function clipText(text, maxChars = MAX_AI_TEXT_CHARS) {
  if (!text || text.length <= maxChars) {
    return text || '';
  }

  return `${text.slice(0, maxChars)}\n\n[Text truncated for processing]`;
}

export async function extractPdfText(filePath) {
  let pdfParse;

  try {
    pdfParse = require('pdf-parse/lib/pdf-parse.js');
  } catch {
    pdfParse = require('pdf-parse');
  }

  const buffer = await readFile(filePath);
  const parsed = await pdfParse(buffer);
  const cleaned = cleanExtractedText(parsed?.text || '');

  if (!cleaned) {
    return '';
  }

  return cleaned.slice(0, MAX_STORED_TEXT_CHARS);
}
