import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'Digital Assistant — One step at a time', description: 'Understand unfamiliar websites and prepare drafts in your language.' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
