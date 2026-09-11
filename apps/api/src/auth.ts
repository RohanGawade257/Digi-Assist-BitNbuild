import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { applicationDefault, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';
import { createPrivateKey } from 'node:crypto';
import { Configuration } from './config';
import { ApiError } from './errors';
import type { Request } from 'express';
export type Identity = { uid: string; emailVerified: boolean; authTime: number };
export type AuthRequest = Request & { identity: Identity };
@Injectable()
export class IdentityService {
  private app?: App;
  readonly configured: boolean;
  constructor(private readonly config: Configuration) {
    try {
      const credential = JSON.parse(readFileSync(config.credentialsPath, 'utf8'));
      this.configured = credential.type === 'service_account' && Boolean(config.projectId) && credential.project_id === config.projectId && Boolean(credential.client_email) && createPrivateKey(credential.private_key).asymmetricKeyType === 'rsa' && !config.env.FIREBASE_AUTH_EMULATOR_HOST;
      if (this.configured) this.app = initializeApp({ credential: applicationDefault(), projectId: config.projectId }, `guide-${Date.now()}`);
    } catch { this.configured = false; }
  }
  async verify(token: string): Promise<Identity> {
    if (!this.app) throw new ApiError('SERVICE_UNAVAILABLE', 503);
    try {
      const claims = await getAuth(this.app).verifyIdToken(token, true);
      return { uid: claims.uid, emailVerified: claims.email_verified === true, authTime: claims.auth_time };
    } catch { throw new ApiError('AUTH_REQUIRED', 401); }
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly identities: IdentityService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ') || authorization.length > 8192) throw new ApiError('AUTH_REQUIRED', 401);
    request.identity = await this.identities.verify(authorization.slice(7));
    return true;
  }
}
export function requireVerified(identity: Identity) { if (!identity.emailVerified) throw new ApiError('EMAIL_UNVERIFIED', 403); }
