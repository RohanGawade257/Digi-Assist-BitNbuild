/**
 * Privacy module — public API.
 *
 * Usage:
 *   import { sanitizeScreenshot, isSanitized, preloadOCR } from '../lib/privacy';
 */

export { sanitizeScreenshot, preloadOCR, terminateOCR, isOCRReady } from './screenshotSanitizer';
export { detectPII, detectPIIWithDiagnostics, buildLines, normalizeText } from './detector';
export { isSanitized, isReviewRequired } from './types';
export type { SanitizedScreenshot, SanitizationResult, SanitizationFailure, SanitizationReviewRequired, PIICategory, Redaction } from './types';
export type { OCRWord, ReconstructedLine, WordSpan, DetectionResult } from './detector';
