'use client';
import { useEffect, useRef, useState } from 'react';
import { approvalPayload, containsSensitiveText, type Source } from '@guide/contracts';
import type { Catalog } from '../lib/locales';

export function SafeContext({ t, onChange, resetKey }: { t: Catalog; onChange: (source: Source | null) => void; resetKey: number }) {
  const [image, setImage] = useState<string | null>(null);
  const [lines, setLines] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [consent, setConsent] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(1);
  const capturedAt = useRef(new Date().toISOString());
  const fileRef = useRef<HTMLInputElement>(null);
  const labels = lines.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20).map((text, i) => ({ id: `label_${i + 1}`, text }));
  function invalidate() { version.current++; setApproved(false); setConsent(false); onChange(null); }
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  useEffect(() => { setImage(null); setLines(''); setSelected([]); setTarget(''); setConsent(false); setApproved(false); setError(''); version.current++; if (fileRef.current) fileRef.current.value = ''; }, [resetKey]);
  async function upload(file?: File) {
    invalidate(); setImage(null); setLines(''); setSelected([]); setTarget(''); setError('');
    if (!file) return;
    const currentVersion = version.current;
    try {
      if (file.size === 0 || file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error();
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const signature = header[0] === 137 && header[1] === 80 && header[2] === 78 && header[3] === 71 ? 'image/png' : header[0] === 255 && header[1] === 216 && header[2] === 255 ? 'image/jpeg' : String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP' ? 'image/webp' : '';
      if (signature !== file.type) throw new Error();
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 12_000_000 || !pixels) throw new Error();
      if (version.current !== currentVersion) return;
      capturedAt.current = new Date().toISOString();
      setImage(URL.createObjectURL(file));
    } catch { if (version.current === currentVersion) setError('Use a PNG, JPEG or WebP image under 5 MiB and 12 megapixels.'); }
  }
  async function approve() {
    const reviewedLabels = labels.filter(l => selected.includes(l.id));
    if (!consent || !reviewedLabels.length || reviewedLabels.some(l => l.text.length > 160 || containsSensitiveText(l.text))) { setError(t.consentError); return; }
    const source: Source = { kind: image ? 'screenshot' : 'description', version: version.current, capturedAt: capturedAt.current, contextMode: 'reviewed-labels', reviewedLabels, selectedTarget: target ? { labelId: target, sourceVersion: version.current } : null, userReviewed: true, sanitizedHash: '' };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(approvalPayload(source)));
    if (source.version !== version.current) return;
    source.sanitizedHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    onChange(source); setApproved(true); setError('');
  }
  return <section className="card context-card" aria-labelledby="context-title">
    <div className="section-heading"><span className="step-number" aria-hidden="true">02</span><h2 id="context-title">{t.review}</h2><span className="tag" lang="en">Optional</span></div>
    <p>{t.privacy}</p>
    <label className="upload" htmlFor="screenshot"><span aria-hidden="true">＋</span><strong>{t.preview}</strong><span lang="en">PNG, JPG, WebP · up to 5 MiB</span></label>
    <input ref={fileRef} id="screenshot" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void upload(e.target.files?.[0])}/>
    {image && <figure><img className="screenshot" src={image} alt="Local screenshot preview. Use the label list below for context selection."/><figcaption lang="en">Uploaded image only; later page changes are not visible.</figcaption></figure>}
    <label htmlFor="labels" lang="en">Public labels or instructions, one per line</label>
    <p className="hint" lang="en">Type only safe labels, such as “Compose” or “Attach files”. Do not include names, entered values or private messages. Nothing is extracted automatically.</p>
    <textarea id="labels" value={lines} maxLength={3200} rows={3} onChange={e => { invalidate(); setLines(e.target.value); setSelected([]); setTarget(''); }} />
    {labels.length > 0 && <fieldset><legend lang="en">Choose what to share</legend>{labels.map(label => <label className="check" key={label.id}><input type="checkbox" checked={selected.includes(label.id)} onChange={e => { invalidate(); setTarget(''); setSelected(e.target.checked ? [...selected, label.id] : selected.filter(id => id !== label.id)); }}/><bdi>{label.text}</bdi></label>)}</fieldset>}
    {selected.length > 0 && <><label htmlFor="target" lang="en">Which label do you mean?</label><select id="target" value={target} onChange={e => { invalidate(); setTarget(e.target.value); }}><option value="">No specific target</option>{labels.filter(l => selected.includes(l.id)).map(l => <option key={l.id} value={l.id}>{l.text}</option>)}</select><label className="check"><input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setApproved(false); onChange(null); }}/>{t.safe}</label><button type="button" className="secondary" onClick={() => void approve()} disabled={!consent}>{t.approve}</button></>}
    {approved && <p className="success" role="status" lang="en">Approved: {labels.filter(l => selected.includes(l.id)).map(l => l.text).join(' · ')}</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
