'use client';
import { useEffect, useRef, useState } from 'react';
import { MAX_APPROVED_IMAGE_BYTES, type ApprovedImage } from '@guide/contracts';
import { useWords } from '../lib/messages';
import { workspaceWords } from '../lib/workspace-copy';
import {designWords} from '../lib/design-copy';

export type PreparedImage = Omit<ApprovedImage, 'analysisConsent'>;
export function ImageReview({ imageUrl, onEdit, onPrepared, compact=false }: { imageUrl: string; onEdit: () => void; onPrepared: (image: PreparedImage) => void; compact?:boolean }) {
  const { m,uiLocale } = useWords();const w=workspaceWords(uiLocale);const [expanded,setExpanded]=useState(!compact),[editing,setEditing]=useState(!compact);
  const canvas = useRef<HTMLCanvasElement>(null), generation = useRef(0);
  const [preview, setPreview] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [area, setArea] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  async function publish(marker: number) {
    const element = canvas.current!;
    const blob = await new Promise<Blob>((resolve, reject) => element.toBlob(value => value ? resolve(value) : reject(new Error()), 'image/png'));
    if (blob.size > MAX_APPROVED_IMAGE_BYTES) throw new Error();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sha = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    if (marker !== generation.current) return;
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const data = btoa(binary); setPreview(`data:image/png;base64,${data}`);
    onPrepared({ mimeType: 'image/png', data, width: element.width, height: element.height, sha256: Array.from(sha, value => value.toString(16).padStart(2, '0')).join('') });
  }
  async function reset() {
    const marker = ++generation.current; onEdit(); setPreview(''); setBusy(true); setError('');
    try {
      const image = new Image(); image.src = imageUrl; await image.decode();
      if (marker !== generation.current) return;
      const element = canvas.current!, scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      element.width = Math.max(1, Math.round(image.naturalWidth * scale)); element.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = element.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, element.width, element.height); context.drawImage(image, 0, 0, element.width, element.height);
      setArea({ x: 0, y: 0, width: 100, height: 100 }); await publish(marker);
    } catch { if (marker === generation.current) setError(m('The edited image is too large or could not be prepared. Use a smaller screenshot.')); }
    finally { if (marker === generation.current) setBusy(false); }
  }
  useEffect(() => { void reset(); return () => { generation.current++; }; }, [imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  function select(next: typeof area) { onEdit(); setArea(next); }
  async function edit(kind: 'crop' | 'mask') {
    const marker = ++generation.current; onEdit(); setBusy(true); setError('');
    try {
      const element = canvas.current!, context = element.getContext('2d')!;
      if (!element.width || area.width <= 0 || area.height <= 0 || area.x + area.width > 100 || area.y + area.height > 100) throw new Error();
      const x = Math.floor(area.x * element.width / 100), y = Math.floor(area.y * element.height / 100);
      const width = Math.max(1, Math.min(element.width - x, Math.ceil(area.width * element.width / 100))), height = Math.max(1, Math.min(element.height - y, Math.ceil(area.height * element.height / 100)));
      if (kind === 'mask') { context.fillStyle = '#000'; context.fillRect(x, y, width, height); }
      else { const pixels = context.getImageData(x, y, width, height); element.width = width; element.height = height; element.getContext('2d')!.putImageData(pixels, 0, 0); }
      setArea({ x: 0, y: 0, width: 100, height: 100 }); await publish(marker);
    } catch { if (marker === generation.current) setError(m('The edited image is too large or could not be prepared. Use a smaller screenshot.')); }
    finally { if (marker === generation.current) setBusy(false); }
  }
  return <div className="image-review" data-editing={editing}>
    {compact && <div className="actions"><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{w.inspect}</button><button type="button" aria-expanded={editing} onClick={()=>{setEditing(value=>!value);setExpanded(true);}}>{designWords(uiLocale).edit}</button></div>}
    <div hidden={compact&&!editing}><h3>{m('Prepare an image for AI analysis')}</h3>
    <p>{m('Crop out unrelated content and cover private areas with solid masks. Masking does not guarantee privacy. Inspect the final image yourself.')}</p>
    <p>{m('Drag to select an area, or enter percentages below. Cropping and masking happen only on this device.')}</p>
    </div><canvas ref={canvas} hidden/>
    {preview && <div className={expanded?'image-edit-preview':'image-edit-preview thumbnail'} onPointerDown={event => {
      if (busy || !editing) return; const box = event.currentTarget.getBoundingClientRect();
      pointerStart.current = { x: 100 * (event.clientX - box.left) / box.width, y: 100 * (event.clientY - box.top) / box.height }; event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      if (!pointerStart.current) return; const box = event.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, 100 * (event.clientX - box.left) / box.width)), y = Math.max(0, Math.min(100, 100 * (event.clientY - box.top) / box.height));
      const start = pointerStart.current; select({ x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(start.x - x), height: Math.abs(start.y - y) });
    }} onPointerUp={() => { pointerStart.current = null; }} onPointerCancel={() => { pointerStart.current = null; }}>
      <img className="approved-image-preview" src={preview} alt={m('Exact image to be sent after approval. Review every visible area.')}/>
      {editing && <span aria-hidden="true" className="edit-area" style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.width}%`, height: `${area.height}%` }}/>}
    </div>}
    <div hidden={!editing}><fieldset disabled={busy}><legend>{m('Area to crop or mask (percent)')}</legend><div className="image-coordinates">{(['x', 'y', 'width', 'height'] as const).map(key => <label key={key}>{key === 'x' ? m('Left') : key === 'y' ? m('Top') : key === 'width' ? m('Width') : m('Height')}<input type="number" min={key === 'x' || key === 'y' ? 0 : 1} max={100} step="1" value={Math.round(area[key] * 100) / 100} onChange={event => select({ ...area, [key]: Math.max(0, Math.min(100, Number(event.target.value))) })}/></label>)}</div></fieldset>
    <div className="actions"><button type="button" className="secondary" disabled={busy || !preview} onClick={() => void edit('crop')}>{m('Crop to area')}</button><button type="button" className="secondary" disabled={busy || !preview} onClick={() => void edit('mask')}>{m('Mask area')}</button><button type="button" className="text-button" disabled={busy} onClick={() => void reset()}>{m('Reset image edits')}</button></div>
    </div>{busy && <p role="status">{m('Preparing image locally...')}</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
