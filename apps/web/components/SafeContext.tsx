'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { approvalPayload, containsSensitiveText, imageDimensions, type Source } from '@guide/contracts';
import type { Catalog } from '../lib/locales';
import { startCapture, type LocalCapture } from '../lib/capture';
import { useWords } from '../lib/messages';
import { ImageReview, type PreparedImage } from './ImageReview';
import { workspaceWords } from '../lib/workspace-copy';
import {captureWords} from '../lib/capture-copy';
import {captureSource} from '../lib/capture-image';

export type ContextState = { kind: 'none' | 'description' | 'screenshot' | 'desktop'; approved: boolean; captureMode?:'instant'|'review'; captureConsent?:boolean; surface?: string; mode?: Source['contextMode'] };
export type ReviewHandle = { takeFresh:(signal:AbortSignal)=>Promise<Source>; commitSent: (source: Source) => void; fresh: (source: Source | null) => Promise<Source | null>; share: () => void; chooseFile: () => void; clear: () => void; approveByVoice: () => Promise<void> };
export const SafeContext = forwardRef<ReviewHandle, { t: Catalog; onChange: (source: Source | null) => void; onState?: (state: ContextState) => void; resetKey: number; onExplainShare?: () => void; compact?:boolean; question?:string; onApproveAnswer?:(source:Source)=>Promise<void>; onShared?:()=>void; screenAllowed:boolean; screenMessage?:string; busy:boolean; onCapture:()=>void; onRevoke:()=>void; onExplainConsent:()=>void; onExplainPrivacy?: () => void }>(function SafeContext({ t, onChange, onState, resetKey, onExplainShare, compact=false,question='',onApproveAnswer,onShared,screenAllowed,screenMessage,busy,onCapture,onRevoke,onExplainConsent,onExplainPrivacy }, ref) {
  const { m, uiLocale } = useWords();
  const c=captureWords(uiLocale);
  const [sendMode,setSendMode]=useState<'instant'|'review'>('instant'),[sessionConsent,setSessionConsent]=useState(false);
  const screenConsent=useRef<Source['screenConsent']>(undefined),sourceId=useRef(crypto.randomUUID());
  const consentFingerprint=useRef('');
  function fingerprint(){const track=capture.current?.stream.getVideoTracks()[0];return track?JSON.stringify([track.id,track.label,track.getSettings().displaySurface,track.getSettings().deviceId]):'';}
  useEffect(()=>{if(!screenAllowed&&screenConsent.current)revoke();},[screenAllowed]); // eslint-disable-line react-hooks/exhaustive-deps
  const w=workspaceWords(uiLocale);const [changed,setChanged]=useState(false),[sending,setSending]=useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [lastSentScreenshot, setLastSentScreenshot] = useState<string | null>(null);
  const captureSequenceRef = useRef(0);
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
  useEffect(() => { onState?.({ kind: sharing ? 'desktop' : image ? 'screenshot' : lines.trim() ? 'description' : 'none', approved: sendMode==='instant'&&sharing?sessionConsent:approved, captureMode:sendMode,captureConsent:sessionConsent, mode: image ? mode : 'reviewed-labels', surface: capture.current?.stream.getVideoTracks()[0]?.getSettings().displaySurface }); }, [sharing, image, lines, approved, mode, onState,sendMode,sessionConsent]);
  function clear() { stopSharing(); setImage(null); setLastSentScreenshot(null); setPrepared(null); setLines(''); setSelected([]); setTarget(''); setRegion(undefined); setError(''); if (fileRef.current) fileRef.current.value = ''; }
  function invalidate() { version.current++; setApproved(false); setConsent(false); setImageConsent(false); onChange(null); }
  function revoke(){screenConsent.current=undefined;setSessionConsent(false);onRevoke();invalidate();}
  function stopSharing() { revoke();sourceId.current=crypto.randomUUID();captureGeneration.current++; captureAbort.current?.abort(); capture.current?.stop(); capture.current = null; frameHash.current = ''; setSharing(false); setChanged(false);setCaptureBusy(false); dirty.current = false; setLastSentScreenshot(null); invalidate(); }
  async function snapshot(current = capture.current) {
    if (!current) return;
    const marker = captureGeneration.current;
    const frame = await current.frame(); if (marker !== captureGeneration.current) return;
    invalidate(); setChanged(false);frameHash.current = frame.hash; dirty.current = false; capturedAt.current = new Date().toISOString(); setPrepared(null); setImage(URL.createObjectURL(frame.blob)); setLines(''); setSelected([]); setTarget(''); setRegion(undefined); setError('');
  }
  async function share() {
    onExplainShare?.();
    stopSharing(); setCaptureBusy(true); setError(''); const marker = captureGeneration.current;
    const controller = new AbortController(); captureAbort.current = controller;
    try {
      const current = await startCapture(controller.signal); if (marker !== captureGeneration.current) { current.stop(); return; }
      capture.current = current; setSharing(true); current.stream.getVideoTracks()[0]?.addEventListener('ended', () => { stopSharing(); setImage(null); setError(m("Sharing stopped. Review a screenshot or describe the page.")); }, { once: true });
      setImage(null);setPrepared(null);if(sendMode==='review')await snapshot(current);onShared?.();
    } catch { if (marker === captureGeneration.current) { stopSharing(); setError(m("Screen sharing was not started. You can upload a screenshot or describe a safe label.")); } }
    finally { if (marker === captureGeneration.current) setCaptureBusy(false); }
  }
  useImperativeHandle(ref, () => ({ takeFresh:async signal=>{
    const current=capture.current,consent=screenConsent.current,marker=captureGeneration.current;
    if(!current || !consent || !screenAllowed || sendMode!=='instant')throw new Error('CAPTURE_CONSENT_REQUIRED');
    if(fingerprint()!==consentFingerprint.current){revoke();throw new Error('CAPTURE_CONSENT_REQUIRED');}
    const captureSeq = ++captureSequenceRef.current;
    const source=await captureSource(current,++version.current,consent,signal);
    if(fingerprint()!==consentFingerprint.current){revoke();throw new Error('CAPTURE_CONSENT_REQUIRED');}
    if(marker!==captureGeneration.current || consent!==screenConsent.current || current!==capture.current || captureSeq !== captureSequenceRef.current)throw new DOMException('Canceled','AbortError');
    setPrepared(null);setChanged(false);setError('');
    return source;
  },commitSent:(source:Source)=>{
    if(source.approvedImage?.data){
      setLastSentScreenshot(`data:image/png;base64,${source.approvedImage.data}`);
      setError('');
    }
  },share: () => { void share(); }, chooseFile: () => fileRef.current?.click(), clear, approveByVoice: async () => {
    if (!image || mode !== 'approved-image' || !prepared) throw new Error('CONTEXT_REVIEW_REQUIRED');
    setImageConsent(true); if (!await approveImage(true)) throw new Error('CONTEXT_REVIEW_REQUIRED');
  }, fresh: async source => {
    if(sharing&&sendMode==='instant')throw new Error('CAPTURE_CONSENT_REQUIRED');
    if ((image || lines.trim() || sharing) && !approved) throw new Error('CONTEXT_REVIEW_REQUIRED');
    if (!source || source.kind !== 'desktop') return source;
    const current = capture.current;
    if (!current || dirty.current) throw new Error('CONTEXT_STALE');
    const frame = await current.frame();
    if (current !== capture.current || frame.hash !== frameHash.current || source.version !== version.current) { dirty.current = true; invalidate(); setError(m("The shared view changed. Refresh the preview and approve the safe labels again.")); throw new Error('CONTEXT_STALE'); }
    return { ...source, checkedAt: new Date().toISOString() };
  } }));
  useEffect(() => {
    if (!sharing || sendMode==='instant') return;
    let running = false;
    const timer = setInterval(() => { const current = capture.current; if (!current || dirty.current || running) return; running = true; void current.frame().then(frame => { if (capture.current === current && frame.hash !== frameHash.current) { dirty.current = true;setChanged(true); if(mode!=='approved-image'){invalidate();setError(m("The shared view changed. Refresh the preview and approve the safe labels again."));} } }).catch(() => { if (capture.current === current) { stopSharing(); } }).finally(() => { running = false; }); }, 1000);
    return () => clearInterval(timer);
  }, [sharing,mode,sendMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { captureGeneration.current++; captureAbort.current?.abort(); capture.current?.stop(); }, []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  useEffect(() => { stopSharing(); setSendMode('instant');setImage(null); setLastSentScreenshot(null); setLines(''); setSelected([]); setTarget(''); setRegion(undefined); setConsent(false); setApproved(false); setError(''); version.current++; if (fileRef.current) fileRef.current.value = ''; }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  async function upload(file?: File) {
    stopSharing(); setSendMode('review');setImage(null); setLines(''); setSelected([]); setTarget(''); setRegion(undefined); setError('');
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
    if (!prepared || (!imageConsent && !voiceConfirmation) || !image) { setError(m('Review the current image again before approving.')); return false; }
    const source: Source = { kind: 'screenshot', version: version.current, capturedAt: capturedAt.current, contextMode: 'approved-image', reviewedLabels: [], selectedTarget: null, approvedImage: { ...prepared, analysisConsent: true }, userReviewed: true, sanitizedHash: '' };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(approvalPayload(source)));
    if (source.version !== version.current) return false;
    source.sanitizedHash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    onChange(source); setApproved(true); setError(''); return source;
  }
  return <section className={`card context-card ${sendMode==='instant'?'instant-capture':'review-capture'}`} aria-labelledby="context-title">
    {sendMode==='instant'&&<><h2 id="context-title" tabIndex={-1}>{c.instant}</h2>
      <div className="privacy-trust-bar">
        <span className="privacy-trust-badge" title={m('Sensitive details are processed and masked in your browser before the protected screenshot is sent for AI assistance.')}>
          🛡️ {busy ? m('Protecting your private information…') : lastSentScreenshot ? m('Private details protected') : m('Browser Privacy Protected')}
        </span>
        {onExplainPrivacy && <button type="button" className="text-button privacy-learn-trigger" onClick={onExplainPrivacy}>{m('How privacy works')}</button>}
      </div>
      {!screenAllowed?<p className="hint">{screenMessage||c.blocked}</p>:sharing&&!sessionConsent?<div className="screen-consent-setup"><label className="check"><input type="checkbox" aria-label={c.consent} checked={sessionConsent} onChange={event=>{if(event.target.checked){consentFingerprint.current=fingerprint();screenConsent.current={mode:'on-demand',sourceId:sourceId.current,grantedAt:new Date().toISOString()};setSessionConsent(true);onExplainConsent();}else revoke();}}/>{c.consent}</label><button type="button" className="text-button" onClick={onExplainConsent}>{c.voice}</button></div>:sessionConsent?<p className="screen-enabled">{c.enabled} <button type="button" className="text-button" onClick={revoke}>{c.revoke}</button></p>:<p className="hint">{c.share}</p>}
      {!sharing&&<button type="button" className="primary share-primary" disabled={captureBusy} onClick={()=>void share()}>{m("Share screen")}</button>}<button type="button" hidden={!sharing} className="primary capture-send" disabled={!sharing||!sessionConsent||!screenAllowed||busy||captureBusy} onClick={onCapture}>{busy?c.processing:c.send}</button>
      {question&&<p className="queued-question" title={question}>{w.question}: {question}</p>}
      {lastSentScreenshot&&<details className="capture-thumbnail"><summary>{c.preview}</summary><img className="captured-image-preview" src={lastSentScreenshot} alt={c.preview}/></details>}
      {sharing&&<button type="button" className="text-button capture-stop" onClick={stopSharing}>{w.stopSharing}</button>}
    </>}
    {compact && sendMode==='review' && <><h2 id="context-title" tabIndex={-1}>{w.review}</h2><p className="snapshot-status" role="status">{changed?w.changed:approved?w.approved:w.needs}</p><p className="queued-question" title={question}>{w.question}: {question||w.noQuestion}</p></>}
    <details className="source-options" open={compact?undefined:true}><summary>{c.more}</summary><fieldset><legend>{c.instant}</legend><label><input type="radio" name="send-mode" checked={sendMode==='instant'} onChange={()=>{revoke();setSendMode('instant');}}/>{c.instant}</label><label><input type="radio" name="send-mode" checked={sendMode==='review'} onChange={()=>{revoke();setSendMode('review');if(sharing)void snapshot().catch(()=>setError(c.failed));}}/>{c.review}</label></fieldset><p>{c.risk}</p>
    {!compact && <div className="section-heading"><h2 id="context-title" tabIndex={-1}>{image && mode === 'approved-image' ? m('Review image privacy') : t.review}</h2><span className="tag" lang={uiLocale}>{m("Optional")}</span></div>}
    <p>{sendMode==='instant'?c.consent:w.privacy}</p>
    {(image || lines || sharing) && <button type="button" className="text-button" onClick={clear}>{m('Remove source and ask without a screen')}</button>}
    <div className="actions" lang={uiLocale}><button type="button" className="secondary" disabled={sharing || captureBusy} onClick={() => void share()}>{m("Share a desktop view")}</button>{sharing && <><button type="button" className="secondary" onClick={() => void snapshot().catch(() => setError(m("The shared view could not be refreshed.")))}>{m("Refresh shared preview")}</button><button type="button" className="stop" onClick={() => { stopSharing(); setImage(null); }}>{m("Stop sharing")}</button></>}</div><p className="hint" lang={uiLocale}>{m("Desktop browsers may offer screen sharing. On mobile, upload a screenshot. Choose image analysis or labels only below.")}</p>
    <label className="upload" htmlFor="screenshot"><span aria-hidden="true">＋</span><strong>{t.preview}</strong><span lang={uiLocale}>{m("PNG, JPG, WebP · up to 5 MiB")}</span><input className="sr-only" ref={fileRef} id="screenshot" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void upload(e.target.files?.[0])}/></label>
    {image && <fieldset><legend>{m('What should the assistant analyze?')}</legend><label className="check"><input type="radio" name="context-mode" checked={mode === 'approved-image'} onChange={() => { invalidate(); setMode('approved-image'); }}/>{m('Approved image')}</label><label className="check"><input type="radio" name="context-mode" checked={mode === 'reviewed-labels'} onChange={() => { revoke(); setSendMode('review'); setMode('reviewed-labels'); }}/>{m('Labels only (no image upload)')}</label></fieldset>}
    <p>{m('If visual review is difficult, choose labels only and type a public instruction instead. Do not approve an image you cannot review safely.')}</p><p>{w.occlusion}</p></details>
    {image && sendMode==='review' && mode === 'approved-image' && <>
      <div className="privacy-trust-bar">
        <span className="privacy-trust-badge" title={m('Sensitive details are processed and masked in your browser before the protected screenshot is sent for AI assistance.')}>
          🛡️ {busy ? m('Protecting your private information…') : m('Browser Privacy Protected')}
        </span>
        {onExplainPrivacy && <button type="button" className="text-button privacy-learn-trigger" onClick={onExplainPrivacy}>{m('How privacy works')}</button>}
      </div>
      <p className="snapshot-privacy">{w.privacy}</p>
      <ImageReview compact={compact} key={image} imageUrl={image} onEdit={() => { invalidate(); setPrepared(null); }} onPrepared={setPrepared}/>
      <label className="check"><input type="checkbox" checked={imageConsent} disabled={!prepared} onChange={event => { setImageConsent(event.target.checked); setApproved(false); onChange(null); }}/>{m('I reviewed this exact image and agree to send it to Gemini for AI analysis.')}</label>
      <button type="button" className="primary" disabled={!prepared || !imageConsent || sending} onClick={()=>{void(async()=>{setSending(true);try{const source=await approveImage();if(source && compact)await onApproveAnswer?.(source);}finally{setSending(false);}})();}}>{compact?w.approve:m('Approve this image')}</button>
      {compact && sharing && <div className="actions"><button type="button" className="secondary" onClick={()=>void snapshot().catch(()=>setError(w.changed))}>{w.refresh}</button><button type="button" className="stop" onClick={stopSharing}>{w.stopSharing}</button></div>}
      {approved && !compact && <p role="status" className="success">{m('Image approved. Send a question to analyze this snapshot.')}</p>}
    </>}
    <div hidden={sendMode==='instant' || Boolean(image && mode === 'approved-image')}>
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
