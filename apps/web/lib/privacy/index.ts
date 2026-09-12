/**
 * Privacy module — public API.
 *
 * Usage:
 *   import { sanitizeScreenshot, isSanitized, preloadOCR } from '../lib/privacy';
 */

export { sanitizeScreenshot, preloadOCR, terminateOCR, isOCRReady } from './screenshotSanitizer';
export { detectPII } from './detector';
export { isSanitized } from './types';
export type { SanitizedScreenshot, SanitizationResult, SanitizationFailure, PIICategory, Redaction } from './types';
export type { OCRWord } from './detector';
