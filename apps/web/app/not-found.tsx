import Link from 'next/link';
import { BackgroundLayer, GlassSurface } from '../components/Glass';
import { BrandMark } from '../components/BrandMark';
import { brand } from '../lib/brand';

export default function NotFound() {
  return (
    <div className="app">
      <BackgroundLayer />
      <GlassSurface as="header" className="topbar">
        <Link href="/" className="brand" aria-label={brand.name}>
          <BrandMark />
        </Link>
        <Link href="/" className="primary">
          Return Home
        </Link>
      </GlassSurface>

      <main id="main" className="not-found-main" style={{ display: 'grid', placeItems: 'center', minHeight: '65vh', padding: '2rem 4%' }}>
        <GlassSurface as="section" className="card not-found-card" style={{ maxWidth: 540, width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
          <div className="not-found-badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 90, height: 90, borderRadius: '50%', background: 'var(--tint)', color: 'var(--primary)', fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.9), 0 8px 24px rgba(21,94,80,0.12)' }}>
            404
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)', marginBottom: '0.8rem', letterSpacing: '-0.03em' }}>
            Page Not Found
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--muted)', marginBottom: '0.5rem', lineHeight: 1.6 }}>
            The page or digital action you are looking for does not exist or has been moved.
          </p>
          <p className="hint" style={{ fontSize: '0.9rem', marginBottom: '2rem' }}>
            यह पृष्ठ उपलब्ध नहीं है · এই পৃষ্ঠাটি পাওয়া যায়নি
          </p>

          <div className="actions" style={{ justifyContent: 'center', gap: '1rem' }}>
            <Link href="/" className="primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Return to Assistant</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </GlassSurface>
      </main>

      <footer className="footer">
        <span><strong>{brand.name}</strong> · Made for a more accessible everyday.</span>
        <Link href="/" className="text-button" style={{ textDecoration: 'none' }}>VaaniSetu Home</Link>
      </footer>
    </div>
  );
}
