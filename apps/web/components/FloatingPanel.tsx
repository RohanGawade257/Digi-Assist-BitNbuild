'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '@guide/contracts';
import { workspaceWords } from '../lib/workspace-copy';
import voiceCopy from '../lib/voice-copy.json';
import {voiceStates,type VoiceState} from '../lib/use-voice-assistant';
type PipApi={requestWindow:(options:{width:number;height:number})=>Promise<Window>};
export type FloatingHandle={afterShare:()=>void;review:()=>void};
function Icon({kind}:{kind:'pin'|'minimize'|'mic'|'stop'|'end'}){const paths={pin:'M8 3h8l-1 7 4 4H5l4-4-1-7M12 14v7',minimize:'M5 12h14',mic:'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8',stop:'M5 8h4l5-4v16l-5-4H5V8M18 9l4 6m0-6-4 6',end:'M6 6l12 12M6 18 18 6'};return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;}
type Props={children:ReactNode;review:ReactNode;controls?:ReactNode;open:boolean;locale:Locale;large:boolean;onOpen:()=>void;onCloseChat:()=>void;onClosedReturn:()=>void;needsReview:boolean;question:string;error:string;caption:string;recovery:ReactNode;ended:boolean;onPause:()=>void;onStopSpeaking:()=>void;onEnd:()=>void;sourceStatus:string;voiceState:VoiceState};
export const FloatingPanel=forwardRef<FloatingHandle,Props>(function FloatingPanel({children,review,controls,open,locale,large,onOpen,onCloseChat,onClosedReturn,needsReview,question,error,caption,recovery,ended,onPause,onStopSpeaking,onEnd,sourceStatus,voiceState},ref){
 const w=workspaceWords(locale),place=useRef<HTMLDivElement>(null),floating=useRef<Window|null>(null),opening=useRef(false);
 const [host,setHost]=useState<HTMLDivElement|null>(null),[supported,setSupported]=useState(false),[outside,setOutside]=useState(false),[notice,setNotice]=useState('');
 const [pin,setPin]=useState(false),[minimized,setMinimized]=useState(false),[left,setLeft]=useState(false),[opaque,setOpaque]=useState(false),[tab,setTab]=useState<'review'|'chat'>('review'),[focused,setFocused]=useState(false);
 const latest=useRef({ended,onClosedReturn});latest.current={ended,onClosedReturn};
 const [editing,setEditing]=useState(false);
 const protectedView=pin||focused||editing||needsReview||Boolean(question.trim())||error;
 useEffect(()=>{if(!host)return;const observer=new MutationObserver(()=>setEditing(Boolean(host.querySelector('.image-review[data-editing="true"]'))));observer.observe(host,{subtree:true,attributes:true,attributeFilter:['data-editing'],childList:true});return()=>observer.disconnect();},[host]);
 const [touched,setTouched]=useState(false);
 useEffect(()=>{if(!touched)return;const timer=setTimeout(()=>setTouched(false),8000);return()=>clearTimeout(timer);},[touched]);
 useEffect(()=>{const element=document.createElement('div');place.current?.append(element);setHost(element);setSupported('documentPictureInPicture' in window);return()=>{floating.current?.close();element.remove();};},[]);
 useEffect(()=>{if(host){host.lang=locale;host.className=`app assistant-portal ${large?'large':''} ${outside?'in-pip':''}`;host.ownerDocument.documentElement.lang=locale;}},[host,locale,large,outside]);
 useEffect(()=>{if(ended)floating.current?.close();},[ended]);
 useEffect(()=>{if(pin||needsReview||question||error)setMinimized(false);},[pin,needsReview,question,error]);
 function restore(){if(host)place.current?.append(host);floating.current=null;setOutside(false);setMinimized(false);if(!latest.current.ended)setNotice(w.closed);latest.current.onClosedReturn();}
 async function openWindow(){
  if(floating.current){floating.current.focus();return;}if(opening.current||!host)return;
  opening.current=true;setNotice('');
  try{
   const next=await (window as unknown as {documentPictureInPicture:PipApi}).documentPictureInPicture.requestWindow({width:360,height:340});
   floating.current=next;next.document.title='Digital Assistant';next.document.documentElement.lang=locale;
   const base=next.document.createElement('base');base.href=document.baseURI;next.document.head.append(base);
   for(const sheet of Array.from(document.styleSheets)){
    try{const style=next.document.createElement('style');style.textContent=Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n');next.document.head.append(style);}
    catch{if(sheet.href){const link=next.document.createElement('link');link.rel='stylesheet';link.href=sheet.href;next.document.head.append(link);}}
   }
   next.document.body.style.margin='0';next.document.body.append(host);setOutside(true);setTab('review');onCloseChat();
   next.addEventListener('pagehide',restore,{once:true});
  }catch{setNotice(w.fallback);}finally{opening.current=false;}
 }
 useImperativeHandle(ref,()=>({afterShare:()=>{setTab('review');setMinimized(false);if(supported&&!floating.current){setNotice(w.open);if(navigator.userActivation?.isActive)void openWindow();}},review:()=>{setTab('review');setMinimized(false);setTimeout(()=>host?.querySelector<HTMLElement>('#context-title')?.focus(),0);}}));
 function toggleChat(){if(open){onCloseChat();setTab('review');}else{onOpen();setTab('chat');}try{floating.current?.resizeTo(open?360:740,open?340:600);}catch{/* Browser may clamp resizing; narrow tabs remain usable. */}}
 return <><div className="floating-toolbar">{controls}{supported?<button id="open-floating-assistant" type="button" className="primary" onClick={()=>void openWindow()}>{w.open}</button>:<p>{w.fallback}</p>}{notice&&<p role="status">{notice}</p>}</div><div ref={place}/>{host&&createPortal(
  <section className={`approval-workspace ${open?'chat-expanded':''} ${left?'review-left':''} ${opaque?'opaque':''} ${protectedView||touched?'protected':''}`} data-outside={outside} onPointerDown={()=>setTouched(true)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setFocused(false);}}>
   <header className="workspace-header"><span className="workspace-source">{sourceStatus} / <small role="status">{voiceCopy[locale].states[voiceStates.indexOf(voiceState)]}</small></span></header>
   {minimized&&<button type="button" className="primary" onClick={()=>setMinimized(false)}>{w.expand} · {sourceStatus}</button>}<div hidden={minimized}>
    <nav className="workspace-controls"><button type="button" aria-expanded={open} onClick={toggleChat}>{open?w.closeChat:w.chat}</button><button type="button" title={voiceState==='paused'?voiceCopy[locale].resume:w.pause} aria-label={voiceState==='paused'?voiceCopy[locale].resume:w.pause} onClick={onPause}><Icon kind="mic"/></button><button type="button" title={voiceCopy[locale].stop} aria-label={voiceCopy[locale].stop} onClick={onStopSpeaking}><Icon kind="stop"/></button><button type="button" className="stop" title={w.end} aria-label={w.end} onClick={onEnd}><Icon kind="end"/></button></nav>
    {!open&&error&&<div className="capture-error"><p role="alert" className="error">{error}</p>{recovery}</div>}
    {open&&<nav className="workspace-tabs"><button type="button" aria-pressed={tab==='review'} onClick={()=>setTab('review')}>{w.review}</button><button type="button" aria-pressed={tab==='chat'} onClick={()=>setTab('chat')}>{w.chat}</button></nav>}
    <div className="workspace-columns" data-tab={tab}><div className="workspace-review" id="source-panel">{review}</div><div className="workspace-chat" hidden={!open}>{children}</div></div>
    {!open&&caption&&<details className="compact-caption"><summary>{caption}</summary><p>{caption}</p></details>}<details className="workspace-options"><summary aria-label={w.options}>⋯</summary><button type="button" title={w.pin} aria-label={w.pin} aria-pressed={pin} onClick={()=>setPin(value=>!value)}><Icon kind="pin"/></button><button type="button" title={w.minimize} aria-label={w.minimize} disabled={pin||editing||needsReview||Boolean(question)||Boolean(error)} onClick={()=>setMinimized(true)}><Icon kind="minimize"/></button><button type="button" onClick={()=>setLeft(value=>!value)}>{w.layout}</button><label><input type="checkbox" checked={opaque} onChange={e=>setOpaque(e.target.checked)}/>{w.opaque}</label><p>{w.occlusion}</p></details>
   </div>
  </section>,host)}</>;
});
