import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPII } from '../lib/privacy/detector.ts';
import { isSanitized } from '../lib/privacy/types.ts';

test('TEST 1: Aadhaar detection — 1234 5678 9012', () => {
  const words = [
    { text: 'Aadhaar', bbox: { x0: 10, y0: 10, x1: 60, y1: 25 }, confidence: 90 },
    { text: 'Number', bbox: { x0: 65, y0: 10, x1: 110, y1: 25 }, confidence: 90 },
    { text: '1234', bbox: { x0: 120, y0: 10, x1: 160, y1: 25 }, confidence: 90 },
    { text: '5678', bbox: { x0: 165, y0: 10, x1: 205, y1: 25 }, confidence: 90 },
    { text: '9012', bbox: { x0: 210, y0: 10, x1: 250, y1: 25 }, confidence: 90 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'aadhaar');
  assert.equal(redactions[0]?.label, '[AADHAAR FILLED]');
  // Verify bounding box covers the numbers
  assert.ok(redactions[0]?.x <= 120);
  assert.ok(redactions[0]?.width >= 130);
});

test('TEST 2: PAN detection — ABCDE1234F', () => {
  const words = [
    { text: 'PAN', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 }, confidence: 90 },
    { text: 'ABCDE1234F', bbox: { x0: 60, y0: 10, x1: 150, y1: 25 }, confidence: 90 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'pan');
  assert.equal(redactions[0]?.label, '[PAN FILLED]');
});

test('TEST 3: Payment card detection — Luhn valid card', () => {
  const words = [
    { text: 'Card', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 }, confidence: 90 },
    { text: 'Number', bbox: { x0: 55, y0: 10, x1: 100, y1: 25 }, confidence: 90 },
    { text: '4532', bbox: { x0: 110, y0: 10, x1: 150, y1: 25 }, confidence: 90 },
    { text: '0151', bbox: { x0: 155, y0: 10, x1: 195, y1: 25 }, confidence: 90 },
    { text: '1283', bbox: { x0: 200, y0: 10, x1: 240, y1: 25 }, confidence: 90 },
    { text: '0366', bbox: { x0: 245, y0: 10, x1: 285, y1: 25 }, confidence: 90 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'card');
  assert.equal(redactions[0]?.label, '[CARD NUMBER FILLED]');
});

test('TEST 4: OTP detection with contextual label', () => {
  const words = [
    { text: 'OTP', bbox: { x0: 10, y0: 10, x1: 40, y1: 25 }, confidence: 90 },
    { text: '839201', bbox: { x0: 50, y0: 10, x1: 100, y1: 25 }, confidence: 90 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'otp');
  assert.equal(redactions[0]?.label, '[OTP FILLED]');
});

test('TEST 5: Non-sensitive price text (Price ₹499) must NOT be redacted', () => {
  const words = [
    { text: 'Price', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 }, confidence: 90 },
    { text: '₹499', bbox: { x0: 60, y0: 10, x1: 100, y1: 25 }, confidence: 90 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 0);
});

test('TEST 6: Non-sensitive year text (Year 2026) must NOT be redacted', () => {
  const words = [
    { text: 'Year', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 }, confidence: 90 },
    { text: '2026', bbox: { x0: 60, y0: 10, x1: 100, y1: 25 }, confidence: 90 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 0);
});

test('TEST 7: CVV 318 redacted vs Room 318 NOT redacted', () => {
  const cvvWords = [
    { text: 'CVV', bbox: { x0: 10, y0: 10, x1: 40, y1: 25 }, confidence: 90 },
    { text: '318', bbox: { x0: 50, y0: 10, x1: 80, y1: 25 }, confidence: 90 },
  ];
  const cvvRedactions = detectPII(cvvWords, 800, 600);
  assert.equal(cvvRedactions.length, 1);
  assert.equal(cvvRedactions[0]?.category, 'cvv');

  const roomWords = [
    { text: 'Room', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 }, confidence: 90 },
    { text: '318', bbox: { x0: 60, y0: 10, x1: 90, y1: 25 }, confidence: 90 },
  ];
  const roomRedactions = detectPII(roomWords, 800, 600);
  assert.equal(roomRedactions.length, 0);
});

test('TEST 8: Email address detection', () => {
  const words = [
    { text: 'Email:', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 }, confidence: 90 },
    { text: 'test@example.com', bbox: { x0: 60, y0: 10, x1: 180, y1: 25 }, confidence: 90 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'email');
  assert.equal(redactions[0]?.label, '[EMAIL FILLED]');
});

test('TEST 9: Phone number detection', () => {
  const words = [
    { text: 'Phone', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 }, confidence: 90 },
    { text: '+91', bbox: { x0: 60, y0: 10, x1: 85, y1: 25 }, confidence: 90 },
    { text: '9876543210', bbox: { x0: 90, y0: 10, x1: 170, y1: 25 }, confidence: 90 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'phone');
  assert.equal(redactions[0]?.label, '[PHONE FILLED]');
});

test('TEST 10: Fail-closed boundary check', () => {
  // When sanitization fails, isSanitized must return false
  const failure = {
    __brand: 'SanitizationFailure',
    sanitized: false,
    error: 'OCR crashed',
  };
  assert.equal(isSanitized(failure), false);

  // A raw blob is NOT a SanitizedScreenshot
  assert.equal(isSanitized({ blob: new Blob([]), sanitized: false, error: '' }), false);
});

test('TEST 11: Realistic OCR token split for Aadhaar — label preserved', () => {
  const words = [
    { text: 'Aadhaar', bbox: { x0: 50, y0: 50, x1: 120, y1: 70 }, confidence: 95 },
    { text: 'Number:', bbox: { x0: 125, y0: 50, x1: 185, y1: 70 }, confidence: 95 },
    { text: '1234', bbox: { x0: 200, y0: 50, x1: 240, y1: 70 }, confidence: 95 },
    { text: '5678', bbox: { x0: 245, y0: 50, x1: 285, y1: 70 }, confidence: 95 },
    { text: '9012', bbox: { x0: 290, y0: 50, x1: 330, y1: 70 }, confidence: 95 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'aadhaar');
  assert.equal(redactions[0]?.label, '[AADHAAR FILLED]');
  // Redaction box must cover the number tokens (x >= 190), NOT the label "Aadhaar" (x=50)
  assert.ok(redactions[0]?.x >= 190);
  assert.ok(redactions[0]?.x + redactions[0]?.width >= 330);
});

test('TEST 12: Realistic OCR token split for Email across punctuation', () => {
  const words = [
    { text: 'Email:', bbox: { x0: 50, y0: 50, x1: 110, y1: 70 }, confidence: 95 },
    { text: 'test', bbox: { x0: 120, y0: 50, x1: 155, y1: 70 }, confidence: 95 },
    { text: '@', bbox: { x0: 157, y0: 50, x1: 168, y1: 70 }, confidence: 95 },
    { text: 'example', bbox: { x0: 170, y0: 50, x1: 235, y1: 70 }, confidence: 95 },
    { text: '.', bbox: { x0: 237, y0: 50, x1: 242, y1: 70 }, confidence: 95 },
    { text: 'com', bbox: { x0: 245, y0: 50, x1: 275, y1: 70 }, confidence: 95 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'email');
  assert.equal(redactions[0]?.label, '[EMAIL FILLED]');
  // Label "Email:" at x=50 must not be covered
  assert.ok(redactions[0]?.x >= 110);
  assert.ok(redactions[0]?.x + redactions[0]?.width >= 275);
});

test('TEST 13: Realistic OCR tokens for PAN — case-insensitive and punctuation-tolerant', () => {
  const words = [
    { text: 'PAN', bbox: { x0: 50, y0: 50, x1: 90, y1: 70 }, confidence: 95 },
    { text: 'Number:', bbox: { x0: 95, y0: 50, x1: 155, y1: 70 }, confidence: 95 },
    { text: 'ABCDE1234F,', bbox: { x0: 170, y0: 50, x1: 270, y1: 70 }, confidence: 95 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'pan');
  assert.equal(redactions[0]?.label, '[PAN FILLED]');
  assert.ok(redactions[0]?.x >= 160);

  // Lowercase
  const lowerWords = [
    { text: 'pan:', bbox: { x0: 50, y0: 50, x1: 90, y1: 70 }, confidence: 95 },
    { text: 'abcde1234f', bbox: { x0: 100, y0: 50, x1: 200, y1: 70 }, confidence: 95 },
  ];
  const lowerRedactions = detectPII(lowerWords, 800, 600);
  assert.equal(lowerRedactions.length, 1);
  assert.equal(lowerRedactions[0]?.category, 'pan');
});

test('TEST 14: Realistic OCR tokens for Phone with +91 split', () => {
  const words = [
    { text: 'Phone', bbox: { x0: 50, y0: 50, x1: 100, y1: 70 }, confidence: 95 },
    { text: 'Number:', bbox: { x0: 105, y0: 50, x1: 165, y1: 70 }, confidence: 95 },
    { text: '+91', bbox: { x0: 175, y0: 50, x1: 205, y1: 70 }, confidence: 95 },
    { text: '98765', bbox: { x0: 210, y0: 50, x1: 255, y1: 70 }, confidence: 95 },
    { text: '43210', bbox: { x0: 260, y0: 50, x1: 305, y1: 70 }, confidence: 95 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'phone');
  assert.equal(redactions[0]?.label, '[PHONE FILLED]');
  assert.ok(redactions[0]?.x >= 165);
  assert.ok(redactions[0]?.x + redactions[0]?.width >= 305);
});

test('TEST 15: Realistic OTP detection on same line', () => {
  const words = [
    { text: 'OTP:', bbox: { x0: 50, y0: 50, x1: 90, y1: 70 }, confidence: 95 },
    { text: '654321', bbox: { x0: 100, y0: 50, x1: 160, y1: 70 }, confidence: 95 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'otp');
  assert.equal(redactions[0]?.label, '[OTP FILLED]');
  assert.ok(redactions[0]?.x >= 95);
});

test('TEST 16: Realistic CVV detection on same line', () => {
  const words = [
    { text: 'CVV:', bbox: { x0: 50, y0: 50, x1: 90, y1: 70 }, confidence: 95 },
    { text: '318', bbox: { x0: 100, y0: 50, x1: 135, y1: 70 }, confidence: 95 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'cvv');
  assert.equal(redactions[0]?.label, '[CVV FILLED]');
  assert.ok(redactions[0]?.x >= 95);
});

test('TEST 17: Realistic Account Number detection with multi-word label', () => {
  const words = [
    { text: 'Account', bbox: { x0: 50, y0: 50, x1: 115, y1: 70 }, confidence: 95 },
    { text: 'Number:', bbox: { x0: 120, y0: 50, x1: 180, y1: 70 }, confidence: 95 },
    { text: '123456789012', bbox: { x0: 190, y0: 50, x1: 300, y1: 70 }, confidence: 95 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'account');
  assert.equal(redactions[0]?.label, '[ACCOUNT FILLED]');
  assert.ok(redactions[0]?.x >= 180);
});

test('TEST 18: IFSC code detection', () => {
  const words = [
    { text: 'IFSC:', bbox: { x0: 50, y0: 50, x1: 100, y1: 70 }, confidence: 95 },
    { text: 'ABCD0123456', bbox: { x0: 110, y0: 50, x1: 210, y1: 70 }, confidence: 95 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'ifsc');
  assert.equal(redactions[0]?.label, '[IFSC FILLED]');
});

test('TEST 19: Spatial proximity — value directly below label', () => {
  const words = [
    // Line 1: CVV label
    { text: 'CVV', bbox: { x0: 50, y0: 50, x1: 90, y1: 70 }, confidence: 95 },
    // Line 2: Input box with value below
    { text: '318', bbox: { x0: 50, y0: 80, x1: 85, y1: 100 }, confidence: 95 },
  ];
  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 1);
  assert.equal(redactions[0]?.category, 'cvv');
});

test('TEST 20: High-risk label with no exact value gets a conservative fallback mask', async () => {
  const { detectPIIWithDiagnostics } = await import('../lib/privacy/detector.ts');
  const words = [
    { text: 'Aadhaar', bbox: { x0: 50, y0: 50, x1: 120, y1: 70 }, confidence: 95 },
    { text: 'Number:', bbox: { x0: 125, y0: 50, x1: 185, y1: 70 }, confidence: 95 },
  ];
  const result = detectPIIWithDiagnostics(words, 800, 600);
  assert.equal(result.redactions.length, 1);
  assert.equal(result.highRiskLabelsCount, 1);
  assert.equal(result.exactRedactionsCount, 0);
  assert.equal(result.fallbackRedactionsCount, 1);
  assert.equal(result.redactions[0]?.label, '[AADHAAR PROTECTED]');
  assert.equal(result.reviewRequired, false);
});

test('TEST 21: Normal document does NOT trigger safety gate', async () => {
  const { detectPIIWithDiagnostics } = await import('../lib/privacy/detector.ts');
  const words = [
    { text: 'Welcome', bbox: { x0: 50, y0: 50, x1: 120, y1: 70 }, confidence: 95 },
    { text: 'to', bbox: { x0: 125, y0: 50, x1: 145, y1: 70 }, confidence: 95 },
    { text: 'our', bbox: { x0: 150, y0: 50, x1: 175, y1: 70 }, confidence: 95 },
    { text: 'service', bbox: { x0: 180, y0: 50, x1: 230, y1: 70 }, confidence: 95 },
  ];
  const result = detectPIIWithDiagnostics(words, 800, 600);
  assert.equal(result.redactions.length, 0);
  assert.equal(result.highRiskLabelsCount, 0);
  assert.equal(result.reviewRequired, false);
});

test('TEST 23: Aadhaar fallback masks a value on the same row despite wide spacing', async () => {
  const { detectPIIWithDiagnostics } = await import('../lib/privacy/detector.ts');
  const result = detectPIIWithDiagnostics([
    { text: 'Aadhaar', bbox: { x0: 50, y0: 50, x1: 120, y1: 70 }, confidence: 95 },
    { text: 'Number', bbox: { x0: 125, y0: 50, x1: 185, y1: 70 }, confidence: 95 },
    { text: 'unreadable', bbox: { x0: 520, y0: 50, x1: 620, y1: 70 }, confidence: 40 },
  ], 800, 600);
  assert.equal(result.exactRedactionsCount, 0);
  assert.equal(result.fallbackRedactionsCount, 1);
  assert.ok(result.redactions[0]?.x < 200);
  assert.ok((result.redactions[0]?.x ?? 0) + (result.redactions[0]?.width ?? 0) >= 620);
});

test('TEST 24: Aadhaar fallback masks the next OCR line', async () => {
  const { detectPIIWithDiagnostics } = await import('../lib/privacy/detector.ts');
  const result = detectPIIWithDiagnostics([
    { text: 'Aadhaar', bbox: { x0: 50, y0: 50, x1: 120, y1: 70 }, confidence: 95 },
    { text: 'Number', bbox: { x0: 125, y0: 50, x1: 185, y1: 70 }, confidence: 95 },
    { text: 'unreadable', bbox: { x0: 50, y0: 82, x1: 150, y1: 102 }, confidence: 40 },
  ], 800, 600);
  assert.equal(result.fallbackRedactionsCount, 1);
  assert.ok((result.redactions[0]?.y ?? 0) >= 79);
  assert.ok((result.redactions[0]?.y ?? 0) + (result.redactions[0]?.height ?? 0) >= 102);
});

test('TEST 25: Sensitive label without readable value gets a row mask', async () => {
  const { detectPIIWithDiagnostics } = await import('../lib/privacy/detector.ts');
  const result = detectPIIWithDiagnostics([
    { text: 'Aadhaar', bbox: { x0: 50, y0: 50, x1: 120, y1: 70 }, confidence: 95 },
    { text: 'Number', bbox: { x0: 125, y0: 50, x1: 185, y1: 70 }, confidence: 95 },
  ], 800, 600);
  assert.equal(result.fallbackRedactionsCount, 1);
  assert.ok((result.redactions[0]?.width ?? 0) > 500);
  assert.ok((result.redactions[0]?.height ?? 0) >= 50);
});

test('TEST 26: Unrelated privacy text and numbers remain unmasked', async () => {
  const { detectPIIWithDiagnostics } = await import('../lib/privacy/detector.ts');
  const result = detectPIIWithDiagnostics([
    { text: 'Our', bbox: { x0: 50, y0: 50, x1: 80, y1: 70 }, confidence: 95 },
    { text: 'privacy', bbox: { x0: 85, y0: 50, x1: 145, y1: 70 }, confidence: 95 },
    { text: 'policy', bbox: { x0: 150, y0: 50, x1: 200, y1: 70 }, confidence: 95 },
    { text: '2026', bbox: { x0: 210, y0: 50, x1: 250, y1: 70 }, confidence: 95 },
  ], 800, 600);
  assert.equal(result.redactions.length, 0);
  assert.equal(result.highRiskLabelsCount, 0);
});

test('TEST 22: FULL PRODUCTION TEST — all 8 sensitive values detected simultaneously', () => {
  const words = [
    // 1. Aadhaar
    { text: 'Aadhaar', bbox: { x0: 50, y0: 50, x1: 120, y1: 70 }, confidence: 95 },
    { text: 'Number:', bbox: { x0: 125, y0: 50, x1: 185, y1: 70 }, confidence: 95 },
    { text: '1234', bbox: { x0: 200, y0: 50, x1: 240, y1: 70 }, confidence: 95 },
    { text: '5678', bbox: { x0: 245, y0: 50, x1: 285, y1: 70 }, confidence: 95 },
    { text: '9012', bbox: { x0: 290, y0: 50, x1: 330, y1: 70 }, confidence: 95 },

    // 2. PAN
    { text: 'PAN', bbox: { x0: 50, y0: 90, x1: 90, y1: 110 }, confidence: 95 },
    { text: 'Number:', bbox: { x0: 95, y0: 90, x1: 155, y1: 110 }, confidence: 95 },
    { text: 'ABCDE1234F', bbox: { x0: 170, y0: 90, x1: 270, y1: 110 }, confidence: 95 },

    // 3. Phone
    { text: 'Phone', bbox: { x0: 50, y0: 130, x1: 100, y1: 150 }, confidence: 95 },
    { text: 'Number:', bbox: { x0: 105, y0: 130, x1: 165, y1: 150 }, confidence: 95 },
    { text: '9876543210', bbox: { x0: 180, y0: 130, x1: 270, y1: 150 }, confidence: 95 },

    // 4. Email
    { text: 'Email:', bbox: { x0: 50, y0: 170, x1: 110, y1: 190 }, confidence: 95 },
    { text: 'test@example.com', bbox: { x0: 120, y0: 170, x1: 250, y1: 190 }, confidence: 95 },

    // 5. OTP
    { text: 'OTP:', bbox: { x0: 50, y0: 210, x1: 90, y1: 230 }, confidence: 95 },
    { text: '654321', bbox: { x0: 100, y0: 210, x1: 160, y1: 230 }, confidence: 95 },

    // 6. CVV
    { text: 'CVV:', bbox: { x0: 50, y0: 250, x1: 90, y1: 270 }, confidence: 95 },
    { text: '318', bbox: { x0: 100, y0: 250, x1: 140, y1: 270 }, confidence: 95 },

    // 7. Account Number
    { text: 'Account', bbox: { x0: 50, y0: 290, x1: 115, y1: 310 }, confidence: 95 },
    { text: 'Number:', bbox: { x0: 120, y0: 290, x1: 180, y1: 310 }, confidence: 95 },
    { text: '123456789012', bbox: { x0: 190, y0: 290, x1: 300, y1: 310 }, confidence: 95 },

    // 8. IFSC
    { text: 'IFSC:', bbox: { x0: 50, y0: 330, x1: 100, y1: 350 }, confidence: 95 },
    { text: 'ABCD0123456', bbox: { x0: 110, y0: 330, x1: 210, y1: 350 }, confidence: 95 },
  ];

  const redactions = detectPII(words, 800, 600);
  assert.equal(redactions.length, 8);

  const categories = redactions.map(r => r.category);
  assert.ok(categories.includes('aadhaar'), 'Missing aadhaar redaction');
  assert.ok(categories.includes('pan'), 'Missing pan redaction');
  assert.ok(categories.includes('phone'), 'Missing phone redaction');
  assert.ok(categories.includes('email'), 'Missing email redaction');
  assert.ok(categories.includes('otp'), 'Missing otp redaction');
  assert.ok(categories.includes('cvv'), 'Missing cvv redaction');
  assert.ok(categories.includes('account'), 'Missing account redaction');
  assert.ok(categories.includes('ifsc'), 'Missing ifsc redaction');
});

