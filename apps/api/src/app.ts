import 'reflect-metadata';
import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, type Response } from 'express';
import { locales } from '@guide/contracts';
import { Configuration } from './config';
import { Database } from './database';
import { AuthGuard, IdentityService, requireVerified, type AuthRequest } from './auth';
import { ApiError, SafeErrors } from './errors';
import { Sessions } from './sessions';
import { Assistant } from './assistant';
import { Providers } from './providers';
import { Quota } from './quota';

@Controller()
export class HealthController {
  constructor(private readonly config: Configuration, private readonly db: Database, private readonly identity: IdentityService) {}
  @Get('health') health() { return { status: 'ok' }; }
  @Get('ready') async ready(@Res({ passthrough: true }) response: Response) {
    const database = await this.db.ping();
    const ready = database && this.identity.configured && this.config.problems.length === 0;
    response.status(ready ? 200 : 503);
    return { status: ready ? 'ready' : 'not_ready', database, identityConfigured: this.identity.configured, configurationValid: !this.config.problems.length, providersLiveVerified: false };
  }
}
@Controller()
@UseGuards(AuthGuard)
export class ApiController {
  constructor(private readonly config: Configuration, private readonly sessions: Sessions, private readonly assistant: Assistant) {}
  @Get('capabilities') capabilities() { return { locales, typed: { configured: !this.config.problems.length, liveVerified: false }, screenshot: { mode: 'local-preview-reviewed-labels', rawUpload: false }, speech: { configured: false, liveVerified: false, reasonCode: 'NOT_IMPLEMENTED' }, history: { enabled: false }, desktopCapture: false }; }
  @Get('me') me(@Req() req: AuthRequest) { return this.sessions.preferences(req.identity.uid); }
  @Patch('me') preferences(@Req() req: AuthRequest, @Body() body: unknown) { return this.sessions.preferences(req.identity.uid, body); }
  @Post('sessions') create(@Req() req: AuthRequest, @Body() body: unknown) {
    requireVerified(req.identity);
    if (!body || typeof body !== 'object' || Object.keys(body).some(k => k !== 'historyEnabled') || (body as { historyEnabled?: unknown }).historyEnabled !== false) throw new ApiError('INVALID_INPUT');
    return this.sessions.create(req.identity.uid);
  }
  @Get('sessions') list() { return { items: [], historyEnabled: false }; }
  @Get('sessions/:id') async detail(@Req() req: AuthRequest, @Param('id') id: string) { const session = await this.sessions.owned(req.identity.uid, id); return { id, historyEnabled: false, expiresAt: session.expiresAt }; }
  @Delete('sessions/:id') @HttpCode(204) async remove(@Req() req: AuthRequest, @Param('id') id: string) { await this.sessions.close(req.identity.uid, id); this.assistant.cancel(req.identity.uid, id); }
  @Post('sessions/:id/turns/:requestId/cancel') @HttpCode(204) async cancel(@Req() req: AuthRequest, @Param('id') id: string, @Param('requestId') requestId: string) { await this.sessions.owned(req.identity.uid, id); this.assistant.cancel(req.identity.uid, id, requestId); }
  @Post('sessions/:id/turns') @HttpCode(200) async turn(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response, @Param('id') id: string, @Body() body: unknown) {
    requireVerified(req.identity);
    const controller = new AbortController();
    const close = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', close);
    try { return await this.assistant.turn(req.identity.uid, id, body, controller.signal); }
    finally { res.off('close', close); }
  }
}
@Module({ controllers: [HealthController, ApiController], providers: [Configuration, Database, IdentityService, AuthGuard, Sessions, Assistant, Providers, Quota] })
export class AppModule {}
export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  const config = app.get(Configuration);
  app.use(json({ limit: '32kb', strict: true }));
  app.use((_req: unknown, res: Response, next: () => void) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.enableCors({ origin: config.problems.includes('API_ALLOWED_ORIGINS') ? [] : config.origins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Authorization', 'Content-Type'], credentials: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new SafeErrors());
  app.enableShutdownHooks();
  return app;
}
