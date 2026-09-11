import type { NextConfig } from 'next';
import { loadEnvFile } from 'node:process';
import path from 'node:path';
try { loadEnvFile(path.resolve(process.cwd(), '../../.env')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const config: NextConfig = { transpilePackages: ['@guide/contracts'], poweredByHeader: false,
  async headers() { return [{ source: '/:path*', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'Permissions-Policy', value: 'camera=(), geolocation=()' },
    { key: 'X-Frame-Options', value: 'DENY' }
  ] }]; }
};
export default config;
