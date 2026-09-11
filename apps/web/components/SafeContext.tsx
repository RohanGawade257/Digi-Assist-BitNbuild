'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { approvalPayload, containsSensitiveText, imageDimensions, type Source } from '@guide/contracts';
import type { Catalog } from '../lib/locales';
import { startCapture, type LocalCapture } from '../lib/capture';
import { useWords } from '../lib/messages';
import { ImageReview, type PreparedImage } from './ImageReview';

export type ContextState = { kind: 'none' | 'description' | 'screenshot' | 'desktop'; approved: boolean; surface?: string; mode?: Source['contextMode'] };
export type ReviewHandle = { fresh: (source: Source | null) => Promise<Source | null>; share: () => void; chooseFile: () => void; clear: () => void; approveByVoice: () => Promise<void> };
export const SafeContext = forwardRef<ReviewHandle, { t: Catalog; onChange: (source: Source | null) => void; onState?: (state: ContextState) => void; resetKey: number; onExplainShare?: () => void }>(function SafeContext({ t, onChange, onState, resetKey, onExplainShare }, ref) {
  const { m, uiLocale } = useWords();
  const [image, setImage] = useState<string | null>(null);
  const [lines, setLines] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [consent, setConsent] = useState(false);
  const [approved, setApproved] = useState(false);
  const [mode, setMode] = useState<Source['contextMode']>('approved-image');
  const [prepared, setPrepared] = useState<PreparedImage | null>(null), [imageConsent, setImageConsent] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(1);
  const capturedAt = useRef(new Date().toISOString());
  const fileRef = useRef<HTMLInputElement>(null);
  const capture = useRef<LocalCapture | null>(null), frameHash = useRef(''), dirty = useRef(false), captureGeneration = useRef(0);
  const captureAbort = useRef<AbortController | null>(null);
  const [sharing, setSharing] = useState(false), [captureBusy, setCaptureBusy] = useState(false), [region, setRegion] = useState<NonNullable<Source['selectedTarget']>['normalizedRegion']>();
  const labels = lines.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20).map((text, i) => ({ id: `label_${i + 1}`, text }));
  useEffect(() => { onState?.({ kind: sharing ? 'desktop' : image ? 'screenshot' : lines.trim() ? 'description' : 'none', approved, mode: image ? mode : 'reviewed-labels', surface: capture.current?.stream.getVideoTracks()[0]?.getSettings().displaySurface }); }, [sharing, image, lines, approved, mode, onState]);
  function clear() { stopSharing(); setImage(null); setPrepared(null); setLines(''); setSelected([]); setTarget(''); setRegion(undefined); setError(''); if (fileRef.current) fileRef.current.value = ''; }
  function invalidate() { version.current++; setApproved(false); setConsent(false); setImageConsent(false); onChange(null); }
  function stopSharing() { captureGeneration.current++; captureAbort.current?.abort(); capture.current?.stop(); capture.current = null; frameHash.current = ''; setSharing(false); setCaptureBusy(false); dirty.current = false; invalidate(); }
  async function snapshot(current = capture.current) {
    if (!current) return;
    const marker = captureGeneration.current;
    const frame = await current.frame(); if (marker !== captureGeneration.current) return;
    invalidate(); frameHash.current = frame.hash; dirty.current = false; capturedAt.current = new Date().toISOString(); setPrepared(null); setImage(URL.createObjectURL(frame.blob)); setLines(''); setSelected([]); setTarget(''); setRegion(undefined); setError('');
  }
  async function share() {
    onExplainShare?.();
    stopSharing(); setCaptureBusy(true); setError(''); const marker = captureGeneration.current;
    const controller = new AbortController(); captureAbort.current = controller;
    try {
      const current = await startCapture(controller.signal); if (marker !== captureGeneration.current) { current.stop(); return; }
      capture.current = current; setSharing(true); current.stream.getVideoTracks()[0]?.addEventListener('ended', () => { stopSharing(); setImage(null); setError(m("Sharing stopped. Review a screenshot or describe the page.")); }, { once: true });
      await snapshot(current);
    } catch { if (marker === captureGeneration.current) { stopSharing(); setError(m("Screen sharing was not started. You can upload a screenshot or describe a safe label.")); } }
    finally { if (marker === captureGeneration.current) setCaptureBusy(false); }
  }
  useImperativeHandle(ref, () => ({ share: () => { void share(); }, chooseFile: () => fileRef.current?.click(), clear, approveByVoice: async () => {
    if (!image || mode !== 'approved-image' || !prepared || (sharing && dirty.current)) throw new Error('CONTEXT_REVIEW_REQUIRED');
    setImageConsent(true); if (!await approveImage(true)) throw new Error('CONTEXT_REVIEW_REQUIRED');
  }, fresh: async source => {
    if ((image || lines.trim() || sharing) && !approved) throw new Error('CONTEXT_REVIEW_REQUIRED');
    if (!source || source.kind !== 'desktop') return source;
    const current = capture.current;
    if (!current || dirty.current) throw new Error('CONTEXT_STALE');
    const frame = await current.frame();
    if (current !== capture.current || frame.hash !== frameHash.current || source.version !== version.current) { dirty.current = true; invalidate(); setError(m("The shared view changed. Refresh the preview and approve the safe labels again.")); throw new Error('CONTEXT_STALE'); }
    return { ...source, checkedAt: new Date().toISOString() };
  } }));
  useEffect(() => {
    if (!sharing) return;
    let running = false;
    const timer = setInterval(() => { const current = capture.current; if (!current || dirty.current || running) return; running = true; void current.frame().then(frame => { if (capture.current === current && frame.hash !== frameHash.current) { dirty.current = true; invalidate(); setError(m("The shared view changed. Refresh the preview and approve the safe labels again.")); } }).catch(() => { if (capture.current === current) { stopSharing(); setImage(null); } }).finally(() => { running = false; }); }, 1000);
    return () => clearInterval(timer);
  }, [sharing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { captureGeneration.current++; captureAbort.current?.abort(); capture.current?.stop(); }, []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  useEffect(() => { stopSharing(); setImage(null); setLines(''); setSelected([]); setTarget(''); setRegion(undefined); setConsent(false); setApproved(false); setError(''); version.current++; if (fileRef.current) fileRef.current.value = ''; }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  async function upload(file?: File) {
    stopSharing(); setImage(null); setLines(''); setSelected([]); setTarget(''); setRegion(undefined); setError('');
    if (!file) return;
    const currentVersion = version.current;
    try {
      if (file.size === 0 || file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error();
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const signature = header[0] === 137 && header[1] === 80 && header[2] === 78 && header[3] === 71 ? 'image/png' : header[0] === 255 && header[1] === 216 && header[2] === 255 ? 'image/jpeg' : String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP' ? 'image/webp' : '';
      if (signature !== file.type) throw new Error();
      const dimensions = imageDimensions(new Uint8Array(await file.arrayBuffer()), file.type);
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height, matchesHeader = bitmap.width === dimensions.width && bitmap.height === dimensions.height || bitmap.height === dimensions.width && bitmap.width === dimensions.height;
      bitmap.close();
      if (pixels > 12_000_000 || !pixels || !matchesHeader) throw new Error();
      if (version.current !== currentVersion) return;
      capturedAt.current = new Date().toISOString();
      setPrepared(null); setImage(URL.createObjectURL(file));
    } catch { if (version.current === currentVersion) setError(m("Use a PNG, JPEG or WebP image under 5 MiB and 12 megapixels.")); }
  }
  async function approve() {
    const reviewedLabels = labels.filter(l => selected.includes(l.id));
    if (!consent || !reviewedLabels.length || reviewedLabels.some(l => l.text.length > 160 || containsSensitiveText(l.text))) { setError(t.consentError); return; }
    if (sharing && dirty.current) { setError(m("Refresh the changed shared view before approving.")); return; }
    const source: Source = { kind: sharing ? 'desktop' : image ? 'screenshot' : 'description', version: version.current, capturedAt: capturedAt.current, ...(sharing ? { checkedAt: new Date().toISOString() } : {}), contextMode: 'reviewed-labels', reviewedLabels, selectedTarget: target ? { labelId: target, sourceVersion: version.current, ...(region ? { normalizedRegion: region } : {}) } : null, userReviewed: true, sanitizedHash: '' };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(approvalPayload(source)));
    if (source.version !== version.current) return;
    source.sanitizedHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    onChange(source); setApproved(true); setError('');
  }
  async function approveImage(voiceConfirmation = false) {
    if (!prepared || (!imageConsent && !voiceConfirmation) || !image || (sharing && dirty.current)) { setError(m('Review the current image again before approving.')); return false; }
    const source: Source = { kind: sharing ? 'desktop' : 'screenshot', version: version.current, capturedAt: capturedAt.current, ...(sharing ? { checkedAt: new Date().toISOString() } : {}), contextMode: 'approved-image', reviewedLabels: [], selectedTarget: null, approvedImage: { ...prepared, analysisConsent: true }, userReviewed: true, sanitizedHash: '' };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(approvalPayload(source)));
    if (source.version !== version.current) return false;
    source.sanitizedHash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    onChange(source); setApproved(true); setError(''); return true;
  }
  return <section className="card context-card" aria-labelledby="context-title">
    <div className="section-heading"><h2 id="context-title" tabIndex={-1}>{image && mode === 'approved-image' ? m('Review image privacy') : t.review}</h2><span className="tag" lang={uiLocale}>{m("Optional")}</span></div>
    <p>{m('Images are previewed locally first. Nothing is sent until you approve a source and send a question.')}</p>
    {(image || lines || sharing) && <button type="button" className="text-button" onClick={clear}>{m('Remove source and ask without a screen')}</button>}
    <div className="actions" lang={uiLocale}><button type="button" className="secondary" disabled={sharing || captureBusy} onClick={() => void share()}>{m("Share a desktop view")}</button>{sharing && <><button type="button" className="secondary" onClick={() => void snapshot().catch(() => setError(m("The shared view could not be refreshed.")))}>{m("Refresh shared preview")}</button><button type="button" className="stop" onClick={() => { stopSharing(); setImage(null); }}>{m("Stop sharing")}</button></>}</div><p className="hint" lang={uiLocale}>{m("Desktop browsers may offer screen sharing. On mobile, upload a screenshot. Choose image analysis or labels only below.")}</p>
    <label className="upload" htmlFor="screenshot"><span aria-hidden="true">＋</span><strong>{t.preview}</strong><span lang={uiLocale}>{m("PNG, JPG, WebP · up to 5 MiB")}</span><input className="sr-only" ref={fileRef} id="screenshot" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void upload(e.target.files?.[0])}/></label>
    {image && <fieldset><legend>{m('What should the assistant analyze?')}</legend><label className="check"><input type="radio" name="context-mode" checked={mode === 'approved-image'} onChange={() => { invalidate(); setMode('approved-image'); }}/>{m('Approved image')}</label><label className="check"><input type="radio" name="context-mode" checked={mode === 'reviewed-labels'} onChange={() => { invalidate(); setMode('reviewed-labels'); }}/>{m('Labels only (no image upload)')}</label></fieldset>}
    {image && mode === 'approved-image' && <>
      <p className="notice">{m('This is a snapshot, not a live screen. The exact approved image will be sent to Gemini for AI analysis with your question. It is not saved by this app.')}</p>
      <ImageReview key={image} imageUrl={image} onEdit={() => { invalidate(); setPrepared(null); }} onPrepared={setPrepared}/>
      <p>{m('If visual review is difficult, choose labels only and type a public instruction instead. Do not approve an image you cannot review safely.')}</p>
      <label className="check"><input type="checkbox" checked={imageConsent} disabled={!prepared} onChange={event => { setImageConsent(event.target.checked); setApproved(false); onChange(null); }}/>{m('I reviewed this exact image and agree to send it to Gemini for AI analysis.')}</label>
      <button type="button" className="primary" disabled={!prepared || !imageConsent} onClick={() => void approveImage()}>{m('Approve this image')}</button>
      {approved && <p role="status" className="success">{m('Image approved. Send a question to analyze this snapshot.')}</p>}
    </>}
    <div hidden={Boolean(image && mode === 'approved-image')}>
    {image && <figure><button type="button" className="preview-target" disabled={!target} aria-label={m("Mark the chosen label in this preview (optional)")} onClick={e => { const box = e.currentTarget.getBoundingClientRect(); const x = e.detail ? Math.max(0, Math.min(0.95, (e.clientX - box.left) / box.width - 0.025)) : 0.475; const y = e.detail ? Math.max(0, Math.min(0.95, (e.clientY - box.top) / box.height - 0.025)) : 0.475; invalidate(); setRegion({ x, y, width: 0.05, height: 0.05 }); }}><img className="screenshot" src={image} alt={m("Local screenshot preview. Use the label list below for context selection.")}/>{region && <span className="target-region" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: '5%', height: '5%' }}/>}</button><figcaption lang={uiLocale}>{sharing ? m("Local shared view. Changes invalidate approval.") : m("Uploaded image only; later page changes are not visible.")}{' '}{m("Choose a label below; optionally mark its position in the preview. The label list works without pointing.")}</figcaption></figure>}
    <label htmlFor="labels" lang={uiLocale}>{m("Public labels or instructions, one per line")}</label>
    <p className="hint" lang={uiLocale}>{m("Type only safe labels, such as “Compose” or “Attach files”. Do not include names, entered values or private messages. Nothing is extracted automatically.")}</p>
    <textarea id="labels" value={lines} maxLength={3200} rows={3} onChange={e => { invalidate(); setLines(e.target.value); setSelected([]); setTarget(''); setRegion(undefined); }} />
    {labels.length > 0 && <fieldset><legend lang={uiLocale}>{m("Choose what to share")}</legend>{labels.map(label => <label className="check" key={label.id}><input type="checkbox" checked={selected.includes(label.id)} onChange={e => { invalidate(); setTarget(''); setRegion(undefined); setSelected(e.target.checked ? [...selected, label.id] : selected.filter(id => id !== label.id)); }}/><bdi>{label.text}</bdi></label>)}</fieldset>}
    {selected.length > 0 && <><label htmlFor="target" lang={uiLocale}>{m("Which label do you mean?")}</label><select id="target" value={target} onChange={e => { invalidate(); setTarget(e.target.value); setRegion(undefined); }}><option value="">{m("No specific target")}</option>{labels.filter(l => selected.includes(l.id)).map(l => <option key={l.id} value={l.id}>{l.text}</option>)}</select><label className="check"><input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setApproved(false); onChange(null); }}/>{t.safe}</label><button type="button" className="secondary" onClick={() => void approve()} disabled={!consent}>{t.approve}</button></>}
    {approved && <p className="success" role="status" lang={uiLocale}>{m("Approved:")}{' '}{labels.filter(l => selected.includes(l.id)).map(l => l.text).join(' · ')}</p>}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
});
