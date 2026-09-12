/**
 * Screenshot Privacy Sanitizer — client-side only.
 *
 * Flow:
 *   Raw screenshot (Blob/File/ImageBitmap)
 *   → Canvas rendering
 *   → Tesseract.js OCR (in-browser WebAssembly)
 *   → PII detection (regex + spatial proximity)
 *   → Irreversible Canvas redaction (opaque rectangles + semantic labels)
 *   → Sanitized Blob export
 *   → ONLY sanitized Blob may reach the network
 *
 * SECURITY INVARIANTS:
 *   • OCR text is NEVER logged, stored, or sent anywhere.
 *   • Raw screenshot is NEVER sent to any network endpoint.
 *   • On ANY failure the sanitizer returns SanitizationFailure — caller MUST NOT fall back to raw.
 *   • The returned SanitizedScreenshot has a branded type that upload functions require.
 */

import type { SanitizedScreenshot, SanitizationResult, PIICategory } from './types';
import { detectPIIWithDiagnostics, type OCRWord } from './detector';

const PRIVACY_VERSION = '1';

/** Singleton Tesseract worker — initialized once, reused across calls. */
let workerPromise: Promise<import('tesseract.js').Worker> | null = null;
let workerReady = false;

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    console.info('[PRIVACY] Initializing OCR engine…');
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng', undefined, {
      // Use CDN for language data — no user image data is sent
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js',
    });
    workerReady = true;
    console.info('[PRIVACY] OCR engine ready');
    return worker;
  })();
  return workerPromise;
}

/**
 * Pre-initialize the OCR worker.
 * Call this early (e.g. on page load) so the first sanitization is fast.
 */
export function preloadOCR(): void {
  if (typeof window === 'undefined') return; // SSR guard
  void getWorker();
}

/**
 * Draw redaction rectangles onto a canvas context.
 * This PERMANENTLY overwrites the sensitive pixels — irreversible.
 */
function applyRedactions(
  ctx: CanvasRenderingContext2D,
  redactions: { x: number; y: number; width: number; height: number; label: string; category: PIICategory }[],
  canvasWidth: number,
  canvasHeight: number
): void {
  const fontSize = Math.max(10, Math.round(Math.min(canvasWidth, canvasHeight) * 0.015));

  for (const r of redactions) {
    // 1. Solid opaque fill — destroys original pixels
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(r.x, r.y, r.width, r.height);

    // 2. Subtle border for visibility
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = Math.max(1, Math.round(canvasWidth * 0.002));
    ctx.strokeRect(r.x, r.y, r.width, r.height);

    // 3. Semantic label so Gemini understands the field was filled
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';
    const labelX = r.x + 4;
    const labelY = r.y + r.height / 2;
    // Only draw label if the box is large enough
    if (r.width > fontSize * 3 && r.height > fontSize * 0.8) {
      ctx.fillText(r.label, labelX, labelY, r.width - 8);
    }
  }
}

/**
 * Core sanitization function.
 *
 * @param input - Raw screenshot as Blob, File, or ImageBitmap
 * @returns SanitizedScreenshot on success, SanitizationFailure if anything goes wrong
 *
 * FAIL-CLOSED: Any error → SanitizationFailure. Never returns raw image.
 */
export async function sanitizeScreenshot(
  input: Blob | File | ImageBitmap
): Promise<SanitizationResult> {
  // SSR guard
  if (typeof window === 'undefined') {
    return { __brand: 'SanitizationFailure', sanitized: false, error: 'Cannot sanitize on server' };
  }

  console.info('[PRIVACY] Sanitization started');

  try {
    // ─── Step 1: Render raw image to Canvas ──────────────────────────

    let bitmap: ImageBitmap;
    if (input instanceof ImageBitmap) {
      bitmap = input;
    } else {
      bitmap = await createImageBitmap(input);
    }

    const width = bitmap.width;
    const height = bitmap.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return { __brand: 'SanitizationFailure', sanitized: false, error: 'Canvas unavailable' };
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    // We're done with the bitmap — release it
    if (!(input instanceof ImageBitmap)) bitmap.close();

    // ─── Step 2: Run local OCR via Tesseract.js ──────────────────────

    console.info('[PRIVACY] OCR started');
    const worker = await getWorker();

    // Extract the canvas data as an image for Tesseract
    const imageData = ctx.getImageData(0, 0, width, height);
    const result = await worker.recognize(canvas);
    console.info('[PRIVACY] OCR completed');

    // ─── Step 3: Extract word bounding boxes ──────────────────────────

    const ocrWords: OCRWord[] = [];
    if (result.data?.words) {
      for (const word of result.data.words) {
        if (word.text.trim().length === 0) continue;
        ocrWords.push({
          text: word.text.trim(),
          bbox: word.bbox,
          confidence: word.confidence,
        });
      }
    }

    console.info(`[PRIVACY] OCR words extracted: ${ocrWords.length}`);

    // ─── Step 4: Detect PII regions ──────────────────────────────────

    const detection = detectPIIWithDiagnostics(ocrWords, width, height);
    const redactions = detection.redactions;

    console.info(`[PRIVACY] OCR lines reconstructed: ${detection.linesReconstructed}`);
    console.info(`[PRIVACY] high-risk labels detected: ${detection.highRiskLabelsCount}`);
    console.info(`[PRIVACY] Candidate regions: ${redactions.length}`);

    // ─── Safety Gate ─────────────────────────────────────────────────
    if (detection.reviewRequired) {
      console.warn('[PRIVACY] High-risk form labels detected with 0 redactions — safety review required');
      return {
        __brand: 'SanitizationFailure',
        sanitized: false,
        reviewRequired: true,
        error: "PRIVACY_REVIEW_REQUIRED: We found a sensitive form but couldn't safely verify all private details. Please review the screenshot before sending.",
      };
    }

    // ─── Step 5: Apply irreversible Canvas redaction ─────────────────

    if (redactions.length > 0) {
      applyRedactions(ctx, redactions, width, height);
      console.info(`[PRIVACY] Redactions applied: ${redactions.length}`);
    } else {
      console.info('[PRIVACY] Redactions applied: 0');
    }

    // ─── Step 6: Export sanitized image ──────────────────────────────

    const sanitizedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Canvas export failed')),
        'image/png'
      );
    });

    // ─── Step 7: Cleanup Canvas ──────────────────────────────────────

    canvas.width = 0;
    canvas.height = 0;

    // ─── Step 8: Collect categories ──────────────────────────────────

    const categories = [...new Set(redactions.map(r => r.category))];

    const sanitized: SanitizedScreenshot = {
      __brand: 'SanitizedScreenshot',
      blob: sanitizedBlob,
      sanitized: true,
      redactionCount: redactions.length,
      categories,
      width,
      height,
      privacyVersion: PRIVACY_VERSION,
    };

    console.info(`[PRIVACY] Sanitization complete — ${redactions.length} redaction(s), categories: [${categories.join(', ')}]`);

    return sanitized;

  } catch (error) {
    // FAIL CLOSED — never return the raw image
    const message = error instanceof Error ? error.message : 'Unknown sanitization error';
    console.error(`[PRIVACY] Sanitization FAILED: ${message}`);
    return {
      __brand: 'SanitizationFailure',
      sanitized: false,
      error: `Privacy sanitization failed: ${message}`,
    };
  }
}

/**
 * Terminate the OCR worker and release resources.
 * Call on page unmount if desired.
 */
export async function terminateOCR(): Promise<void> {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch { /* ignore */ }
  workerPromise = null;
  workerReady = false;
  console.info('[PRIVACY] OCR engine terminated');
}

/** Check whether the OCR engine is already initialized. */
export function isOCRReady(): boolean {
  return workerReady;
}
