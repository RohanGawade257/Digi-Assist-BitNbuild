'use client';
import {useEffect,useId,useRef,type ReactNode} from 'react';
export function Dialog({open,title,closeLabel,onClose,children}:{open:boolean;title:string;closeLabel:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),id=useId(),callback=useRef(onClose);callback.current=onClose;
 useEffect(()=>{const dialog=ref.current!;if(!open){if(dialog.open)dialog.close();return;}const previous=dialog.ownerDocument.activeElement as HTMLElement|null;dialog.showModal();return()=>{dialog.close();if(previous?.isConnected)previous.focus();};},[open]);
 return <dialog ref={ref} className="app-dialog" aria-labelledby={id} onCancel={event=>{event.preventDefault();callback.current();}}><header><h2 id={id}>{title}</h2><button type="button" className="secondary" onClick={onClose}>{closeLabel}</button></header><div className="dialog-content">{children}</div></dialog>;
}
