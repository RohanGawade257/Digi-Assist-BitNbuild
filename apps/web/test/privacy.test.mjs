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
