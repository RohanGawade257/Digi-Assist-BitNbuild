/**
 * Privacy module types — the branded SanitizedScreenshot type
 * enforces a compile-time boundary: only sanitized images may
 * reach network upload code.
 */

/** Categories of personally identifiable information we detect. */
export type PIICategory =
  | 'aadhaar'
  | 'pan'
  | 'card'
  | 'cvv'
  | 'otp'
  | 'phone'
  | 'email'
  | 'account'
  | 'ifsc'
  | 'password';

/** Metadata about a single redaction applied to the image. */
export interface Redaction {
  category: PIICategory;
  /** Bounding box on the canvas (px, after scaling). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Label drawn on the redacted region, e.g. "[AADHAAR FILLED]". */
  label: string;
}

/**
 * Branded type — only produced by the sanitizer.
 * Upload functions MUST accept this type, not raw Blob/File.
 */
export interface SanitizedScreenshot {
  readonly __brand: 'SanitizedScreenshot';
  /** The sanitized image blob — pixels permanently redacted. */
  blob: Blob;
  /** True by construction; exists as a runtime marker. */
  sanitized: true;
  /** Number of PII regions redacted. */
  redactionCount: number;
  /** Which PII categories were found. */
  categories: PIICategory[];
  /** Canvas dimensions after sanitization. */
  width: number;
  height: number;
  /** Privacy module version for defense-in-depth metadata. */
  privacyVersion: string;
}

/** Result when sanitization fails — the raw image MUST NOT be sent. */
export interface SanitizationFailure {
  readonly __brand: 'SanitizationFailure';
  sanitized: false;
  error: string;
}

export type SanitizationResult = SanitizedScreenshot | SanitizationFailure;

export function isSanitized(result: SanitizationResult): result is SanitizedScreenshot {
  return result.sanitized === true;
}
