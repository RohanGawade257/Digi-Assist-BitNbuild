import type {CSSProperties,ReactNode} from 'react';
import {background} from '../lib/background';
export function BackgroundLayer(){
 const style={'--scene-desktop':background.desktop?`url("${background.desktop}")`:'none','--scene-mobile':background.mobile?`url("${background.mobile}")`:background.desktop?`url("${background.desktop}")`:'none','--scene-position':background.position,'--scene-mobile-position':background.mobilePosition,'--scene-tint':background.tint,'--scene-opacity':background.tintStrength,'--scene-fallback':background.fallback} as CSSProperties;
 return <div className="scene-background" style={style} aria-hidden="true"><div className="scene-image"/><div className="scene-tint"/></div>;
}
export function GlassSurface({as:Tag='div',className='',children}:{as?:'div'|'section'|'header';className?:string;children:ReactNode}){return <Tag className={`glass-surface ${className}`}>{children}</Tag>;}
