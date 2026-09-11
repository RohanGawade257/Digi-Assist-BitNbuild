import type { Metadata } from 'next';
import './styles.css';
import './redesign.css';
import './glass.css';
import './pip.css';
import {brand} from '../lib/brand';
export const metadata: Metadata = { title: brand.title, description: brand.description, applicationName:brand.name, manifest:'/manifest.webmanifest', icons:{icon:'/vaanisetu.svg',apple:'/vaanisetu.svg'} };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
