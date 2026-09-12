/**
 * PII Detection Engine — pure regex + spatial proximity detection.
 * Operates on Tesseract.js OCR word-level bounding boxes.
 *
 * SECURITY: This module MUST NEVER log recognized text.
 *           Only safe diagnostic counts are permitted.
 */

import type { PIICategory, Redaction } from './types';

/** A single word recognized by OCR with its bounding box. */
export interface OCRWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

/** Character span within a reconstructed line pointing to its source OCR word. */
export interface WordSpan {
  word: OCRWord;
  start: number; // inclusive start char index in line text
  end: number;   // exclusive end char index in line text
}

/** Reconstructed line with character span mappings to original OCR words. */
export interface ReconstructedLine {
  text: string;
  words: OCRWord[];
  spans: WordSpan[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface DetectionResult {
  redactions: Redaction[];
  highRiskLabelsCount: number;
  linesReconstructed: number;
  reviewRequired: boolean;
}

// ─── Text Normalization ──────────────────────────────────────────────

/**
 * Normalizes OCR text before matching:
 * - Unicode spaces (non-breaking, em-space, etc.) -> standard space
 * - Unicode hyphens/dashes -> standard '-'
 * - OCR punctuation noise around edges
 */
export function normalizeText(text: string): string {
  return text
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Pattern Matchers ────────────────────────────────────────────────

/** Payment card: 13–19 digits with optional spaces/dashes. */
const CARD_RE = /(?:^|[^\d])((?:\d{4}[\s-]?){3}\d{1,7})\b/g;

/** Aadhaar: 12 digits (4-4-4 or 12 continuous) with boundary checks. */
const AADHAAR_RE = /(?:^|[^\d])(\d{4}[\s-]?\d{4}[\s-]?\d{4})(?=[^\d]|$)/g;

/** PAN: 5 letters + 4 digits + 1 letter, case insensitive. */
const PAN_RE = /(?:^|[^A-Za-z0-9])([A-Za-z]{5}\d{4}[A-Za-z])(?=[^A-Za-z0-9]|$)/gi;

/** Email address: tolerates token split around '@' and '.'. */
const EMAIL_RE = /(?:^|[\s:;,<\(\[])([A-Za-z0-9._%+\-]+(?:\s*@\s*)[A-Za-z0-9.\-]+(?:\s*\.\s*)[A-Za-z]{2,})\b/gi;

/** Indian mobile: optional +91 prefix, then 10 digits (joined or split). */
const PHONE_RE = /(?:^|[^\d+])((?:\+91[\s\-]?)?[6-9](?:[\s\-]*\d){9})\b/g;

/** IFSC code: 4 letters + 0 + 6 alphanumeric. */
const IFSC_RE = /(?:^|[^A-Za-z0-9])([A-Za-z]{4}0[A-Za-z0-9]{6})(?=[^A-Za-z0-9]|$)/gi;

// ─── Same-Line Contextual Matchers ───────────────────────────────────

const ACCOUNT_LINE_RE = /(?:^|[^A-Za-z0-9])(?:account\s*(?:number|no\.?|#)?|a\/c\s*(?:number|no\.?|#)?|bank\s*account)[\s:.\-#]+(\d{6,18})\b/gi;
const OTP_LINE_RE = /(?:^|[^A-Za-z0-9])(?:otp|one\s*time\s*(?:password|code)|verification\s*code|security\s*code)[\s:.\-#]+(\d{4,8})\b/gi;
const CVV_LINE_RE = /(?:^|[^A-Za-z0-9])(?:cvv|cvc|card\s*security(?:\s*code)?|security\s*code)[\s:.\-#]+(\d{3,4})\b/gi;
const PASSWORD_LINE_RE = /(?:^|[^A-Za-z0-9])(?:password|pass\s*word|mpin|upi\s*pin|passcode)[\s:.\-#]+(\S{3,30})\b/gi;

// ─── Spatial Labels for Multi-line Detection ────────────────────────

export const HIGH_RISK_LABEL_REGEX = /\b(aadhaar|aadhar|आधार|pan\s*(?:number|no\.?|card)|card\s*number|credit\s*card|debit\s*card|cvv|cvc|otp|one\s*time\s*password|password|mpin|upi\s*pin|account\s*(?:number|no\.?|#)|a\/c\s*(?:number|no\.?|#))\b/i;

const CVV_LABELS = /\b(cvv|cvc|security\s*code|card\s*security)\b/i;
const OTP_LABELS = /\b(otp|one\s*time\s*(?:password|code)|verification\s*code|security\s*code)\b/i;
const ACCOUNT_LABELS = /\b(account\s*(?:number|no\.?|#)?|a\/c\s*(?:number|no\.?|#)?|bank\s*account)\b/i;
const PASSWORD_LABELS = /\b(password|pass\s*word|pin|mpin|upi\s*pin|passcode)\b/i;
const AADHAAR_LABELS = /\b(aadhaar|aadhar|आधार)\b/i;
const PAN_LABELS = /\b(pan\s*(?:card|number|no\.?)?|पैन)\b/i;
const PHONE_LABELS = /\b(mobile|phone|contact|telephone|cell)\b/i;
const EMAIL_LABELS = /\b(email|e-mail|mail)\b/i;

/** Known label tokens that should never be redacted as values. */
const KNOWN_LABEL_TOKENS = /^(aadhaar|aadhar|pan|phone|mobile|email|mail|contact|account|number|no|cvv|cvc|otp|ifsc|code|password|pin|mpin|room|year|price|total|date|name|id)$/i;

/** Semantic label for the redaction overlay. */
const LABELS: Record<PIICategory, string> = {
  aadhaar: '[AADHAAR FILLED]',
  pan: '[PAN FILLED]',
  card: '[CARD NUMBER FILLED]',
  cvv: '[CVV FILLED]',
  otp: '[OTP FILLED]',
  phone: '[PHONE FILLED]',
  email: '[EMAIL FILLED]',
  account: '[ACCOUNT FILLED]',
  ifsc: '[IFSC FILLED]',
  password: '[PASSWORD FILLED]',
};

/** Luhn checksum for payment card validation. */
function luhnValid(digits: string): boolean {
  const nums = digits.replace(/\D/g, '');
  if (nums.length < 13 || nums.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = nums.length - 1; i >= 0; i--) {
    const char = nums[i];
    if (!char) continue;
    let digit = parseInt(char, 10);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Build a merged bounding box from an array of word boxes. */
export function mergeBoxes(words: OCRWord[]): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: Math.min(...words.map(w => w.bbox.x0)),
    y0: Math.min(...words.map(w => w.bbox.y0)),
    x1: Math.max(...words.map(w => w.bbox.x1)),
    y1: Math.max(...words.map(w => w.bbox.y1)),
  };
}

/** Retrieves all OCR words that contribute characters to a match range. */
export function getWordsForSpan(spans: WordSpan[], start: number, end: number): OCRWord[] {
  return spans
    .filter(s => !(s.end <= start || s.start >= end))
    .map(s => s.word);
}

/**
 * Groups OCR words into lines by y-coordinate clustering,
 * sorts words horizontally, and creates character-span mappings.
 */
export function buildLines(words: OCRWord[]): ReconstructedLine[] {
  const validWords = words
    .filter(w => w.text && w.text.trim().length > 0)
    .map(w => ({
      original: w,
      cleanedText: w.text
        .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
        .trim(),
    }))
    .filter(item => item.cleanedText.length > 0);

  if (validWords.length === 0) return [];

  // Sort words vertically by center Y
  const sorted = [...validWords].sort((a, b) => {
    const cyA = (a.original.bbox.y0 + a.original.bbox.y1) / 2;
    const cyB = (b.original.bbox.y0 + b.original.bbox.y1) / 2;
    return cyA - cyB;
  });

  const lineClusters: Array<{ items: Array<{ original: OCRWord; cleanedText: string }>; y0: number; y1: number }> = [];

  for (const item of sorted) {
    const w = item.original;
    const wHeight = w.bbox.y1 - w.bbox.y0;
    const wCenterY = (w.bbox.y0 + w.bbox.y1) / 2;

    let matchedLine: { items: Array<{ original: OCRWord; cleanedText: string }>; y0: number; y1: number } | null = null;

    for (const cluster of lineClusters) {
      const clusterHeight = cluster.y1 - cluster.y0;
      const clusterCenterY = (cluster.y0 + cluster.y1) / 2;
      const minH = Math.min(wHeight, clusterHeight);

      const overlapY = Math.min(cluster.y1, w.bbox.y1) - Math.max(cluster.y0, w.bbox.y0);

      if (overlapY > minH * 0.35 || Math.abs(wCenterY - clusterCenterY) <= minH * 0.5) {
        matchedLine = cluster;
        break;
      }
    }

    if (matchedLine) {
      matchedLine.items.push(item);
      matchedLine.y0 = Math.min(matchedLine.y0, w.bbox.y0);
      matchedLine.y1 = Math.max(matchedLine.y1, w.bbox.y1);
    } else {
      lineClusters.push({
        items: [item],
        y0: w.bbox.y0,
        y1: w.bbox.y1,
      });
    }
  }

  // Sort lines vertically
  lineClusters.sort((a, b) => a.y0 - b.y0);

  const lines: ReconstructedLine[] = [];

  for (const cluster of lineClusters) {
    // Sort words horizontally left-to-right
    cluster.items.sort((a, b) => a.original.bbox.x0 - b.original.bbox.x0);

    let lineText = '';
    const spans: WordSpan[] = [];
    const lineWords: OCRWord[] = [];

    for (let i = 0; i < cluster.items.length; i++) {
      const item = cluster.items[i]!;
      const word = item.original;
      lineWords.push(word);
      if (i > 0) lineText += ' ';
      const start = lineText.length;
      lineText += item.cleanedText;
      const end = lineText.length;
      spans.push({ word, start, end });
    }

    lines.push({
      text: lineText,
      words: lineWords,
      spans,
      bbox: mergeBoxes(lineWords),
    });
  }

  return lines;
}

/** Spatial proximity test between two boxes (same row or adjacent below). */
function isSpatiallyNear(
  labelBox: { x0: number; y0: number; x1: number; y1: number },
  valBox: { x0: number; y0: number; x1: number; y1: number },
  maxHDist: number,
  maxVDist: number
): boolean {
  // Case 1: To the right on the same line
  const vOverlap = Math.min(labelBox.y1, valBox.y1) - Math.max(labelBox.y0, valBox.y0);
  const minH = Math.min(labelBox.y1 - labelBox.y0, valBox.y1 - valBox.y0);
  if (vOverlap >= minH * 0.3) {
    const hDist = valBox.x0 - labelBox.x1;
    if (hDist >= -10 && hDist <= maxHDist) return true;
  }

  // Case 2: Directly below the label (form input underneath label)
  const vDist = valBox.y0 - labelBox.y1;
  if (vDist >= -5 && vDist <= maxVDist) {
    const hAligned = valBox.x0 <= labelBox.x1 + 100 && valBox.x1 >= labelBox.x0 - 50;
    if (hAligned) return true;
  }

  return false;
}

/**
 * Detect PII regions in OCR output with safe diagnostic metadata.
 */
export function detectPIIWithDiagnostics(
  words: OCRWord[],
  canvasWidth: number,
  canvasHeight: number
): DetectionResult {
  const redactions: Redaction[] = [];
  const processedWords = new Set<OCRWord>();
  const lines = buildLines(words);

  const padX = Math.max(4, Math.round(canvasWidth * 0.006));
  const padY = Math.max(3, Math.round(canvasHeight * 0.005));

  const maxHDist = Math.max(120, Math.round(canvasWidth * 0.15));
  const maxVDist = Math.max(80, Math.round(canvasHeight * 0.1));

  function addRedaction(category: PIICategory, involvedWords: OCRWord[]) {
    // If any word in involvedWords is already processed, do not duplicate
    if (involvedWords.some(w => processedWords.has(w))) return;
    if (involvedWords.length === 0) return;

    const box = mergeBoxes(involvedWords);
    redactions.push({
      category,
      x: Math.max(0, box.x0 - padX),
      y: Math.max(0, box.y0 - padY),
      width: Math.min(canvasWidth, box.x1 + padX) - Math.max(0, box.x0 - padX),
      height: Math.min(canvasHeight, box.y1 + padY) - Math.max(0, box.y0 - padY),
      label: LABELS[category],
    });
    for (const w of involvedWords) {
      processedWords.add(w);
    }
  }

  // ─── Pass 1: Line-level Pattern & Same-Line Contextual Matching ─────

  for (const line of lines) {
    const text = line.text;

    // 1. Explicit same-line Account Number (checked before Aadhaar to avoid swallowing 12-digit account numbers)
    ACCOUNT_LINE_RE.lastIndex = 0;
    let accLineMatch: RegExpExecArray | null;
    while ((accLineMatch = ACCOUNT_LINE_RE.exec(text)) !== null) {
      const matchVal = accLineMatch[1]!;
      const start = accLineMatch.index + accLineMatch[0].lastIndexOf(matchVal);
      const end = start + matchVal.length;
      const matchedWords = getWordsForSpan(line.spans, start, end);
      addRedaction('account', matchedWords);
    }

    // 2. Same-line OTP
    OTP_LINE_RE.lastIndex = 0;
    let otpLineMatch: RegExpExecArray | null;
    while ((otpLineMatch = OTP_LINE_RE.exec(text)) !== null) {
      const matchVal = otpLineMatch[1]!;
      const start = otpLineMatch.index + otpLineMatch[0].lastIndexOf(matchVal);
      const end = start + matchVal.length;
      const matchedWords = getWordsForSpan(line.spans, start, end);
      addRedaction('otp', matchedWords);
    }

    // 3. Same-line CVV
    CVV_LINE_RE.lastIndex = 0;
    let cvvLineMatch: RegExpExecArray | null;
    while ((cvvLineMatch = CVV_LINE_RE.exec(text)) !== null) {
      const matchVal = cvvLineMatch[1]!;
      const start = cvvLineMatch.index + cvvLineMatch[0].lastIndexOf(matchVal);
      const end = start + matchVal.length;
      const matchedWords = getWordsForSpan(line.spans, start, end);
      addRedaction('cvv', matchedWords);
    }

    // 4. Same-line Password / PIN
    PASSWORD_LINE_RE.lastIndex = 0;
    let passLineMatch: RegExpExecArray | null;
    while ((passLineMatch = PASSWORD_LINE_RE.exec(text)) !== null) {
      const matchVal = passLineMatch[1]!;
      const start = passLineMatch.index + passLineMatch[0].lastIndexOf(matchVal);
      const end = start + matchVal.length;
      const matchedWords = getWordsForSpan(line.spans, start, end);
      addRedaction('password', matchedWords);
    }

    // 5. Payment Card (Luhn valid)
    CARD_RE.lastIndex = 0;
    let cardMatch: RegExpExecArray | null;
    while ((cardMatch = CARD_RE.exec(text)) !== null) {
      const matchVal = cardMatch[1]!;
      const digits = matchVal.replace(/\D/g, '');
      if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
        const start = cardMatch.index + cardMatch[0].indexOf(matchVal);
        const end = start + matchVal.length;
        const matchedWords = getWordsForSpan(line.spans, start, end);
        addRedaction('card', matchedWords);
      }
    }

    // 6. Aadhaar: 12 digits (4-4-4, 4 4 4, or 12 continuous)
    AADHAAR_RE.lastIndex = 0;
    let aadhaarMatch: RegExpExecArray | null;
    while ((aadhaarMatch = AADHAAR_RE.exec(text)) !== null) {
      const matchVal = aadhaarMatch[1]!;
      const digits = matchVal.replace(/\D/g, '');
      if (digits.length === 12) {
        const start = aadhaarMatch.index + aadhaarMatch[0].indexOf(matchVal);
        const end = start + matchVal.length;
        const matchedWords = getWordsForSpan(line.spans, start, end);
        // Only redact if not already processed as account or card
        if (!matchedWords.some(w => processedWords.has(w))) {
          addRedaction('aadhaar', matchedWords);
        }
      }
    }

    // 7. PAN: 5 letters + 4 digits + 1 letter
    PAN_RE.lastIndex = 0;
    let panMatch: RegExpExecArray | null;
    while ((panMatch = PAN_RE.exec(text)) !== null) {
      const matchVal = panMatch[1]!;
      const start = panMatch.index + panMatch[0].indexOf(matchVal);
      const end = start + matchVal.length;
      const matchedWords = getWordsForSpan(line.spans, start, end);
      addRedaction('pan', matchedWords);
    }

    // 8. Email
    EMAIL_RE.lastIndex = 0;
    let emailMatch: RegExpExecArray | null;
    while ((emailMatch = EMAIL_RE.exec(text)) !== null) {
      const matchVal = emailMatch[1]!;
      const start = emailMatch.index + emailMatch[0].indexOf(matchVal);
      const end = start + matchVal.length;
      const matchedWords = getWordsForSpan(line.spans, start, end);
      addRedaction('email', matchedWords);
    }

    // 9. Phone (Indian mobile with optional +91)
    PHONE_RE.lastIndex = 0;
    let phoneMatch: RegExpExecArray | null;
    while ((phoneMatch = PHONE_RE.exec(text)) !== null) {
      const matchVal = phoneMatch[1]!;
      const start = phoneMatch.index + phoneMatch[0].indexOf(matchVal);
      const end = start + matchVal.length;
      const matchedWords = getWordsForSpan(line.spans, start, end);
      addRedaction('phone', matchedWords);
    }

    // 10. IFSC Code
    IFSC_RE.lastIndex = 0;
    let ifscMatch: RegExpExecArray | null;
    while ((ifscMatch = IFSC_RE.exec(text)) !== null) {
      const matchVal = ifscMatch[1]!;
      const start = ifscMatch.index + ifscMatch[0].indexOf(matchVal);
      const end = start + matchVal.length;
      const matchedWords = getWordsForSpan(line.spans, start, end);
      addRedaction('ifsc', matchedWords);
    }
  }

  // ─── Pass 2: Spatial Proximity (Values Below or Adjacent to Labels) ─

  interface FoundLabel {
    category: PIICategory;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }
  const foundLabels: FoundLabel[] = [];

  for (const line of lines) {
    if (CVV_LABELS.test(line.text)) foundLabels.push({ category: 'cvv', bbox: line.bbox });
    if (OTP_LABELS.test(line.text)) foundLabels.push({ category: 'otp', bbox: line.bbox });
    if (ACCOUNT_LABELS.test(line.text)) foundLabels.push({ category: 'account', bbox: line.bbox });
    if (PASSWORD_LABELS.test(line.text)) foundLabels.push({ category: 'password', bbox: line.bbox });
    if (AADHAAR_LABELS.test(line.text)) foundLabels.push({ category: 'aadhaar', bbox: line.bbox });
    if (PAN_LABELS.test(line.text)) foundLabels.push({ category: 'pan', bbox: line.bbox });
    if (PHONE_LABELS.test(line.text)) foundLabels.push({ category: 'phone', bbox: line.bbox });
    if (EMAIL_LABELS.test(line.text)) foundLabels.push({ category: 'email', bbox: line.bbox });
  }

  for (const label of foundLabels) {
    for (const w of words) {
      if (processedWords.has(w)) continue;

      const raw = w.text.replace(/[:;,.\-\s]/g, '');
      if (KNOWN_LABEL_TOKENS.test(raw)) continue; // Never redact label words themselves

      if (isSpatiallyNear(label.bbox, w.bbox, maxHDist, maxVDist)) {
        if (label.category === 'cvv' && /^\d{3,4}$/.test(raw)) {
          addRedaction('cvv', [w]);
        } else if (label.category === 'otp' && /^\d{4,8}$/.test(raw)) {
          addRedaction('otp', [w]);
        } else if (label.category === 'account' && /^\d{6,18}$/.test(raw)) {
          addRedaction('account', [w]);
        } else if (label.category === 'password' && raw.length >= 4 && raw.length <= 30) {
          if (!/^(password|pin|mpin|upi|passcode|secret|code)$/i.test(raw)) {
            addRedaction('password', [w]);
          }
        } else if (label.category === 'aadhaar' && /^\d{4,12}$/.test(raw)) {
          addRedaction('aadhaar', [w]);
        } else if (label.category === 'pan' && /^[A-Z]{5}\d{4}[A-Z]$/i.test(raw)) {
          addRedaction('pan', [w]);
        }
      }
    }
  }

  // ─── Pass 3: Safety Gate — Check for High-Risk Labels ───────────────

  let highRiskLabelsCount = 0;
  for (const line of lines) {
    HIGH_RISK_LABEL_REGEX.lastIndex = 0;
    if (HIGH_RISK_LABEL_REGEX.test(line.text)) {
      highRiskLabelsCount++;
    }
  }

  // If high-risk labels are present but NO redactions were made, fail closed
  const reviewRequired = highRiskLabelsCount > 0 && redactions.length === 0;

  return {
    redactions,
    highRiskLabelsCount,
    linesReconstructed: lines.length,
    reviewRequired,
  };
}

/**
 * Backwards-compatible PII detector returning only the redaction array.
 */
export function detectPII(words: OCRWord[], canvasWidth: number, canvasHeight: number): Redaction[] {
  return detectPIIWithDiagnostics(words, canvasWidth, canvasHeight).redactions;
}
