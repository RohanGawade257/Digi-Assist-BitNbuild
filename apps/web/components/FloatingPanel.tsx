'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {brand} from '../lib/brand';
import {BrandMark} from './BrandMark';
import {Dialog} from './Dialog';
import {designWords} from '../lib/design-copy';
import type { Locale } from '@guide/contracts';
import { workspaceWords } from '../lib/workspace-copy';
import voiceCopy from '../lib/voice-copy.json';
import {voiceStates,type VoiceState} from '../lib/use-voice-assistant';
type PipApi={requestWindow:(options:{width:number;height:number})=>Promise<Window>};
export type FloatingHandle={afterShare:()=>void;review:()=>void};
function Icon({kind}:{kind:'pin'|'minimize'|'mic'|'stop'|'end'}){const paths={pin:'M8 3h8l-1 7 4 4H5l4-4-1-7M12 14v7',minimize:'M5 12h14',mic:'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8',stop:'M5 8h4l5-4v16l-5-4H5V8M18 9l4 6m0-6-4 6',end:'M6 6l12 12M6 18 18 6'};return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;}
type Props={children:ReactNode;review:ReactNode;controls?:ReactNode;open:boolean;locale:Locale;large:boolean;highContrast:boolean;onOpen:()=>void;onCloseChat:()=>void;onClosedReturn:()=>void;needsReview:boolean;question:string;error:string;caption:string;recovery:ReactNode;ended:boolean;onPause:()=>void;onStopSpeaking:()=>void;onEnd:()=>void;onShare:()=>void;sourceStatus:string;voiceState:VoiceState};
export const FloatingPanel=forwardRef<FloatingHandle,Props>(function FloatingPanel({children,review,controls,open,locale,large,highContrast,onOpen,onCloseChat,onClosedReturn,needsReview,question,error,caption,recovery,ended,onPause,onStopSpeaking,onEnd,onShare,sourceStatus,voiceState},ref){
 const d=designWords(locale),[settings,setSettings]=useState(false),[showCaption,setShowCaption]=useState(false);
 const w=workspaceWords(locale),place=useRef<HTMLDivElement>(null),floating=useRef<Window|null>(null),opening=useRef(false);
 const [host,setHost]=useState<HTMLDivElement|null>(null),[supported,setSupported]=useState(false),[outside,setOutside]=useState(false),[notice,setNotice]=useState('');
 const [pin,setPin]=useState(false),[minimized,setMinimized]=useState(false),[left,setLeft]=useState(false),[opaque,setOpaque]=useState(false),[tab,setTab]=useState<'review'|'chat'>('review'),[focused,setFocused]=useState(false);
 const latest=useRef({ended,onClosedReturn});latest.current={ended,onClosedReturn};
 const [editing,setEditing]=useState(false);
 const protectedView=pin||focused||editing||needsReview||Boolean(question.trim())||Boolean(error)||settings||showCaption||opaque||highContrast;
 const [idle,setIdle]=useState(false),[hovered,setHovered]=useState(false),[activity,setActivity]=useState(0);
 useEffect(()=>{setIdle(false);if(!outside||protectedView||hovered)return;const timer=setTimeout(()=>setIdle(true),1500);return()=>clearTimeout(timer);},[outside,protectedView,hovered,activity]);
 useEffect(()=>{if(!host)return;const observer=new MutationObserver(()=>setEditing(Boolean(host.querySelector('.image-review[data-editing="true"]'))));observer.observe(host,{subtree:true,attributes:true,attributeFilter:['data-editing'],childList:true});return()=>observer.disconnect();},[host]);
 useEffect(()=>{const element=document.createElement('div');place.current?.append(element);setHost(element);setSupported('documentPictureInPicture' in window);return()=>{floating.current?.close();element.remove();};},[]);
 useEffect(()=>{if(host){host.lang=locale;host.className=`app assistant-portal ${large?'large':''} ${outside?'in-pip':''}`;host.ownerDocument.documentElement.lang=locale;}},[host,locale,large,outside]);
 useEffect(()=>{if(ended)floating.current?.close();},[ended]);
 useEffect(()=>{if(pin||needsReview||question||error)setMinimized(false);},[pin,needsReview,question,error]);
 function restore(){if(host)place.current?.append(host);floating.current=null;setOutside(false);setMinimized(false);setSettings(false);setShowCaption(false);if(!latest.current.ended)setNotice(w.closed);latest.current.onClosedReturn();}
 /** Called ONCE right after the PiP window is created. Never called again. */
 function positionWindowOnce(win: Window, targetWidth: number, targetHeight: number) {
  try {
   const s = win.screen || window.screen;
   const availW = s.availWidth;
   const availH = s.availHeight;
   const availLeft = (s as unknown as { availLeft?: number }).availLeft ?? 0;
   const availTop = (s as unknown as { availTop?: number }).availTop ?? 0;
   const targetX = Math.max(availLeft, availLeft + availW - targetWidth - 20);
   const targetY = Math.max(availTop, availTop + availH - targetHeight - 32);
   win.resizeTo(targetWidth, targetHeight);
   win.moveTo(targetX, targetY);
   console.info('[FLOATING] window positioned', { targetWidth, targetHeight, targetX, targetY, screenAvailHeight: availH });
  } catch {/* Browser may restrict coordinates */}
 }
 async function openWindow(){
  if(floating.current){floating.current.focus();console.info('[FLOATING] existing window reused');return;}
  if(opening.current||!host)return;
  opening.current=true;setNotice('');
  try{
   const pipWidth = 390;
   const s = window.screen;
   const availH = s.availHeight;
   const topOffset = 40;  // approx distance from top of screen to desired top of panel
   const bottomGap = 16;
   const pipHeight = Math.max(500, availH - topOffset - bottomGap);
   console.info('[FLOATING] opening assistant', { pipWidth, pipHeight, screenAvailHeight: availH });
   const next=await (window as unknown as {documentPictureInPicture:PipApi}).documentPictureInPicture.requestWindow({width:pipWidth,height:pipHeight});
   floating.current=next;next.document.title=brand.title;next.document.documentElement.lang=locale;
   const base=next.document.createElement('base');base.href=document.baseURI;next.document.head.append(base);
   for(const sheet of Array.from(document.styleSheets)){
    try{const style=next.document.createElement('style');style.textContent=Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n');next.document.head.append(style);}
    catch{if(sheet.href){const link=next.document.createElement('link');link.rel='stylesheet';link.href=sheet.href;next.document.head.append(link);}}
   }
   next.document.documentElement.classList.add('pip-document');
   next.document.documentElement.style.cssText='width:100%;height:100%;margin:0;overflow:hidden;';
   next.document.body.style.cssText='width:100%;height:100%;margin:0;overflow:hidden;';
   next.document.body.append(host);setOutside(true);setTab('review');onCloseChat();
   // Position once after browser has created the window — never again
   setTimeout(()=>positionWindowOnce(next, pipWidth, pipHeight), 60);
   next.addEventListener('pagehide',restore,{once:true});
   console.info('[FLOATING] window created');
  }catch{setNotice(w.fallback);}finally{opening.current=false;}
 }
 useImperativeHandle(ref,()=>({afterShare:()=>{setTab('review');setMinimized(false);if(supported&&!floating.current){setNotice(w.open);if(navigator.userActivation?.isActive)void openWindow();}},review:()=>{setTab('review');setMinimized(false);setTimeout(()=>host?.querySelector<HTMLElement>('#context-title')?.focus(),0);}}));
 // NOTE: NO useEffect that calls resizeTo/moveTo on state changes.
 // NOTE: NO ResizeObserver that resizes the outer window.
 // The outer PiP window size is set ONCE in openWindow() and then left entirely
 // to the browser/user. Internal content scrolls via CSS instead.
 function toggleChat(){
  if(open){
   onCloseChat();
   setTab('review');
   // Content change only — outer window is NOT resized
  }else{
   onOpen();
   setTab('chat');
   // Content change only — outer window is NOT resized
  }
 }
 return <><div className="floating-toolbar">{controls}{supported?<button id="open-floating-assistant" type="button" className="primary" onClick={()=>void openWindow()}>{w.open}</button>:<p>{w.fallback}</p>}{notice&&<p role="status">{notice}</p>}</div><div ref={place}/>{host&&createPortal(
  <section className={`approval-workspace ${open?'chat-expanded':''} ${left?'review-left':''} ${opaque||highContrast?'opaque':''} ${protectedView?'protected':''} ${idle&&!protectedView?'pip-idle':''}`} data-outside={outside} onPointerEnter={event=>{if(event.pointerType!=='touch')setHovered(true);}} onPointerLeave={()=>setHovered(false)} onPointerMove={()=>setActivity(value=>value+1)} onPointerDown={()=>{setActivity(value=>value+1);setIdle(false);}} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setFocused(false);}}>
   <header className="workspace-header"><span className="workspace-source"><BrandMark compact/><span className="source-label">{sourceStatus}</span><small role="status" data-state={voiceState}>{voiceState==='idle'?voiceCopy[locale].start:voiceCopy[locale].states[voiceStates.indexOf(voiceState)]}</small></span><button type="button" className="text-button" onClick={()=>setSettings(true)}>{d.settings}</button><button type="button" title={voiceCopy[locale].stop} aria-label={voiceCopy[locale].stop} onClick={onStopSpeaking}><Icon kind="stop"/></button></header>
   {minimized&&<button type="button" className="primary" onClick={()=>setMinimized(false)}>{w.expand} · {sourceStatus}</button>}<div className="pip-content" hidden={minimized}>
    <nav className="workspace-controls"><button type="button" aria-expanded={open} onClick={toggleChat}>{open?w.closeChat:w.chat}</button><button type="button" title={['idle','paused','error'].includes(voiceState)?voiceCopy[locale].resume:w.pause} aria-label={['idle','paused','error'].includes(voiceState)?voiceCopy[locale].resume:w.pause} onClick={onPause}><Icon kind="mic"/><span>{['idle','paused','error'].includes(voiceState)?voiceCopy[locale].resume:w.pause}</span></button><button type="button" className="stop" title={w.end} aria-label={w.end} onClick={onEnd}><Icon kind="end"/></button></nav>
    {!open&&error&&<div className="capture-error"><p role="alert" className="error">{error}</p>{recovery}</div>}
    {(!outside||open)&&<nav className="workspace-tabs"><button type="button" aria-pressed={tab==='chat'} onClick={()=>{setTab('chat');onOpen();}}>{d.conversation}</button><button type="button" aria-pressed={tab==='review'} onClick={()=>setTab('review')}>{d.screen}</button></nav>}
    <div className="workspace-columns" data-tab={tab}><div className="workspace-review" id="source-panel"><h2 className="screen-heading">{d.screen}</h2>{review}</div><div className="workspace-chat" hidden={outside&&!open}>{children}</div></div>
    {outside&&!open&&!needsReview&&caption&&<button type="button" className="caption-preview" onClick={()=>setShowCaption(true)}><span>{d.caption}</span><strong>{caption}</strong></button>}
    <Dialog open={showCaption} title={d.caption} closeLabel={d.close} onClose={()=>setShowCaption(false)}><p>{caption}</p></Dialog>
    <Dialog open={settings} title={d.settings+' / '+d.help} closeLabel={d.close} onClose={()=>setSettings(false)}><div className="workspace-options"><button type="button" aria-pressed={pin} onClick={()=>setPin(value=>!value)}>{locale==='en-IN'?'Keep visible':w.pin}</button><button type="button" disabled={pin||editing||needsReview||Boolean(question)||Boolean(error)} onClick={()=>{setMinimized(true);setSettings(false);}}>{w.minimize}</button><button type="button" onClick={()=>setLeft(value=>!value)}>{w.layout}</button><label className="check"><input type="checkbox" checked={opaque} onChange={e=>setOpaque(e.target.checked)}/>{w.opaque}</label><p>{w.occlusion}</p><p>{w.echo}</p></div></Dialog>
   </div>
  </section>,host)}</>;
});
