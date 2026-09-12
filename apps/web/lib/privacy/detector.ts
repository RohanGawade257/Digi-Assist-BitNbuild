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

// ─── Pattern matchers ────────────────────────────────────────────────

/** Aadhaar: 12 digits with optional space/dash separators. */
const AADHAAR_RE = /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/;

/** PAN: 5 letters + 4 digits + 1 letter, case insensitive. */
const PAN_RE = /\b([A-Z]{5}\d{4}[A-Z])\b/i;

/** Payment card: 13–19 digits with optional spaces/dashes. */
const CARD_RE = /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7})\b/;

/** Email address. */
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;

/** Indian mobile: optional +91 prefix, then 10 digits. */
const PHONE_RE = /(?:\+91[\s-]?)?[6-9]\d{9}\b/;

/** IFSC code: 4 letters + 0 + 6 alphanumeric. */
const IFSC_RE = /\b[A-Z]{4}0[A-Z0-9]{6}\b/i;

// ─── Context labels for proximity detection ────────────────────────

const CVV_LABELS = /\b(cvv|cvc|security\s*code|card\s*security)\b/i;
const OTP_LABELS = /\b(otp|one\s*time\s*(password|code)|verification\s*code|security\s*code)\b/i;
const ACCOUNT_LABELS = /\b(account\s*(number|no\.?|#)|a\/c\s*(number|no\.?|#)|bank\s*account)\b/i;
const PASSWORD_LABELS = /\b(password|pass\s*word|pin|mpin|upi\s*pin|passcode)\b/i;
const AADHAAR_LABELS = /\b(aadhaar|aadhar|आधार)\b/i;
const PAN_LABELS = /\b(pan\s*(card|number|no\.?)?|पैन)\b/i;
const PHONE_LABELS = /\b(mobile|phone|contact|telephone|cell)\b/i;
const EMAIL_LABELS = /\b(email|e-mail|mail)\b/i;

/** Luhn checksum for card validation. */
function luhnValid(digits: string): boolean {
  const nums = digits.replace(/\D/g, '');
  if (nums.length < 13 || nums.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = nums.length - 1; i >= 0; i--) {
    const char = nums[i];
    if (!char) continue;
    let digit = parseInt(char, 10);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Spatial proximity: are two bounding boxes near each other? */
function isNear(
  a: { x0: number; y0: number; x1: number; y1: number },
  b: { x0: number; y0: number; x1: number; y1: number },
  threshold: number
): boolean {
  const hDist = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
  const vDist = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
  return hDist <= threshold && vDist <= threshold;
}

/** Build a merged bounding box from an array of word boxes. */
function mergeBoxes(words: OCRWord[]): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: Math.min(...words.map(w => w.bbox.x0)),
    y0: Math.min(...words.map(w => w.bbox.y0)),
    x1: Math.max(...words.map(w => w.bbox.x1)),
    y1: Math.max(...words.map(w => w.bbox.y1)),
  };
}

/** Merge consecutive tokens on the same line into single strings for multi-token matching. */
function buildLines(words: OCRWord[]): { text: string; words: OCRWord[] }[] {
  const firstWord = words[0];
  if (!firstWord) return [];
  const lines: { text: string; words: OCRWord[] }[] = [];
  let currentLine: OCRWord[] = [firstWord];

  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const curr = words[i];
    if (!prev || !curr) continue;
    // Same line if vertical overlap > 50%
    const overlapY = Math.min(prev.bbox.y1, curr.bbox.y1) - Math.max(prev.bbox.y0, curr.bbox.y0);
    const prevHeight = prev.bbox.y1 - prev.bbox.y0;
    if (overlapY > prevHeight * 0.5) {
      currentLine.push(curr);
    } else {
      lines.push({ text: currentLine.map(w => w.text).join(' '), words: currentLine });
      currentLine = [curr];
    }
  }
  lines.push({ text: currentLine.map(w => w.text).join(' '), words: currentLine });
  return lines;
}

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

/**
 * Detect PII regions in OCR output.
 * Returns redaction descriptors with pixel bounding boxes.
 */
export function detectPII(words: OCRWord[], canvasWidth: number, canvasHeight: number): Redaction[] {
  const redactions: Redaction[] = [];
  const processed = new Set<number>();
  const lines = buildLines(words);

  // Padding: scale relative to image dimensions
  const padX = Math.max(5, Math.round(canvasWidth * 0.008));
  const padY = Math.max(3, Math.round(canvasHeight * 0.006));
  const proximityThreshold = Math.max(40, Math.round(canvasWidth * 0.05));

  function addRedaction(category: PIICategory, involvedWords: OCRWord[]) {
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
    for (const iw of involvedWords) {
      const globalIdx = words.findIndex(w => w === iw);
      if (globalIdx >= 0) processed.add(globalIdx);
    }
  }

  // ─── Pass 1: Line-level pattern matching ──────────────────────────

  for (const line of lines) {
    const lineText = line.text;

    // Payment card
    const cardDigits = lineText.replace(/\D/g, '');
    let isCard = false;
    if (cardDigits.length >= 13 && cardDigits.length <= 19 && CARD_RE.test(lineText) && luhnValid(cardDigits)) {
      const cardWords = line.words.filter(w => /\d{4,}/.test(w.text));
      if (cardWords.length) {
        addRedaction('card', cardWords);
        isCard = true;
      }
    }

    // Aadhaar: 12 digits (avoid matching 16-digit cards or other longer numbers)
    if (!isCard && AADHAAR_RE.test(lineText)) {
      const digits = lineText.replace(/\D/g, '');
      if (digits.length === 12 || (digits.length >= 12 && !/(\d{4}[\s-]?){4}/.test(lineText))) {
        const digitWords = line.words.filter(w => /\d{3,}/.test(w.text));
        if (digitWords.length) addRedaction('aadhaar', digitWords);
      }
    }

    // PAN: 5 letters + 4 digits + 1 letter
    const panMatch = lineText.match(PAN_RE);
    if (panMatch) {
      const panWords = line.words.filter(w => PAN_RE.test(w.text));
      if (panWords.length) addRedaction('pan', panWords);
    }

    // Email
    if (EMAIL_RE.test(lineText)) {
      const emailWords = line.words.filter(w => EMAIL_RE.test(w.text));
      if (emailWords.length) addRedaction('email', emailWords);
    }

    // Phone
    if (PHONE_RE.test(lineText)) {
      const phoneWords = line.words.filter(w => /\d{5,}/.test(w.text) || /\+91/.test(w.text));
      if (phoneWords.length) addRedaction('phone', phoneWords);
    }

    // IFSC
    if (IFSC_RE.test(lineText)) {
      const ifscWords = line.words.filter(w => IFSC_RE.test(w.text));
      if (ifscWords.length) addRedaction('ifsc', ifscWords);
    }
  }

  // ─── Pass 2: Contextual / proximity-based detection ───────────────

  for (let i = 0; i < words.length; i++) {
    if (processed.has(i)) continue;
    const word = words[i];
    if (!word) continue;
    const text = word.text;

    // CVV: 3-4 digits near a CVV label
    if (/^\d{3,4}$/.test(text)) {
      const hasLabel = words.some(other =>
        other !== word && CVV_LABELS.test(other.text) && isNear(word.bbox, other.bbox, proximityThreshold)
      );
      if (hasLabel) { addRedaction('cvv', [word]); continue; }
    }

    // OTP: 4-8 digits near an OTP label
    if (/^\d{4,8}$/.test(text)) {
      const hasLabel = words.some(other =>
        other !== word && OTP_LABELS.test(other.text) && isNear(word.bbox, other.bbox, proximityThreshold)
      );
      if (hasLabel) { addRedaction('otp', [word]); continue; }
    }

    // Account number: numeric sequence near account label
    if (/^\d{6,18}$/.test(text)) {
      const hasLabel = words.some(other =>
        other !== word && ACCOUNT_LABELS.test(other.text) && isNear(word.bbox, other.bbox, proximityThreshold)
      );
      if (hasLabel) { addRedaction('account', [word]); continue; }
    }

    // Password/PIN: any value near password label
    if (text.length >= 3 && text.length <= 30) {
      const hasLabel = words.some(other =>
        other !== word && PASSWORD_LABELS.test(other.text) && isNear(word.bbox, other.bbox, proximityThreshold)
      );
      if (hasLabel && !/^(password|pin|mpin|upi|passcode)$/i.test(text)) {
        addRedaction('password', [word]);
        continue;
      }
    }

    // Aadhaar near label (even if pattern didn't match perfectly)
    if (/\d{4,}/.test(text)) {
      const hasLabel = words.some(other =>
        other !== word && AADHAAR_LABELS.test(other.text) && isNear(word.bbox, other.bbox, proximityThreshold * 1.5)
      );
      if (hasLabel) { addRedaction('aadhaar', [word]); continue; }
    }

    // PAN near label
    if (/[A-Z]{3,}/i.test(text) && /\d/.test(text)) {
      const hasLabel = words.some(other =>
        other !== word && PAN_LABELS.test(other.text) && isNear(word.bbox, other.bbox, proximityThreshold)
      );
      if (hasLabel) { addRedaction('pan', [word]); continue; }
    }

    // Phone near label
    if (/\d{5,}/.test(text)) {
      const hasLabel = words.some(other =>
        other !== word && PHONE_LABELS.test(other.text) && isNear(word.bbox, other.bbox, proximityThreshold)
      );
      if (hasLabel) { addRedaction('phone', [word]); continue; }
    }

    // Email near label
    if (EMAIL_RE.test(text)) {
      const hasLabel = words.some(other =>
        other !== word && EMAIL_LABELS.test(other.text) && isNear(word.bbox, other.bbox, proximityThreshold)
      );
      if (hasLabel) { addRedaction('email', [word]); continue; }
    }
  }

  return redactions;
}
