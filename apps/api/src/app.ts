import 'reflect-metadata';
import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Req, Res, UseGuards, UseInterceptors, UploadedFile, type INestApplication } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { json, type Response } from 'express';
import { enabledLocales as locales, speechOutputLocales, newSessionSchema } from '@guide/contracts';
import { Configuration, operationReady } from './config';
import { Database } from './database';
import { AuthGuard, IdentityService, requireVerified, type AuthRequest } from './auth';
import { ApiError, SafeErrors } from './errors';
import { Sessions } from './sessions';
import { Assistant } from './assistant';
import { Providers } from './providers';
import { Quota } from './quota';
import { Speech } from './speech';

@Controller()
export class HealthController {
  constructor(private readonly config: Configuration, private readonly db: Database, private readonly identity: IdentityService) {}
  @Get('health') health() { return { status: 'ok' }; }
  @Get('ready') async ready(@Res({ passthrough: true }) response: Response) {
    const database = await this.db.ping();
    const ready = database && this.identity.configured && operationReady(this.config, 'gemini', 'generate');
    response.status(ready ? 200 : 503);
    return { status: ready ? 'ready' : 'not_ready', database, identityConfigured: this.identity.configured, configurationValid: !this.config.problems.length, problems: this.config.problems, operations: { gemini: operationReady(this.config, 'gemini', 'generate'), translation: operationReady(this.config, 'sarvam', 'translate'), transcription: operationReady(this.config, 'sarvam', 'transcribe'), speechOutput: operationReady(this.config, 'sarvam', 'speak') }, pendingPolicies: this.config.pendingPolicies, providersLiveVerified: false };
  }
}
@Controller()
@UseGuards(AuthGuard)
export class ApiController {
  constructor(private readonly config: Configuration, private readonly sessions: Sessions, private readonly assistant: Assistant, private readonly speech: Speech, private readonly identity: IdentityService) {}
  @Get('capabilities') capabilities() { return { locales, typed: { configured: operationReady(this.config, 'gemini', 'generate'), translationConfigured: operationReady(this.config, 'sarvam', 'translate'), liveVerified: false }, screenshot: { modes: ['approved-image', 'reviewed-labels'], rawUpload: false, approvedImageUpload: true, onDemandCaptureAllowed: !this.config.strictPrivacy }, speech: { configured: operationReady(this.config, 'sarvam', 'transcribe'), outputConfigured: operationReady(this.config, 'sarvam', 'speak'), cloudInputAllowed: !this.config.strictPrivacy, outputLocales: speechOutputLocales, unavailableOutputLocales: ['ta-IN', 'ur-IN'], liveVerified: false }, history: { enabled: true, defaultEnabled: false, retentionDays: 30 }, desktopCapture: true }; }
  @Get('me') me(@Req() req: AuthRequest) { return this.sessions.preferences(req.identity.uid); }
  @Patch('me') preferences(@Req() req: AuthRequest, @Body() body: unknown) { return this.sessions.preferences(req.identity.uid, body); }
  @Post('sessions') create(@Req() req: AuthRequest, @Body() body: unknown) {
    requireVerified(req.identity);
    const parsed = newSessionSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('INVALID_INPUT');
    return this.sessions.create(req.identity.uid, parsed.data.historyEnabled);
  }
  @Get('sessions') list(@Req() req: AuthRequest) { return this.sessions.list(req.identity.uid); }
  @Get('sessions/:id/history') history(@Req() req: AuthRequest, @Param('id') id: string) { return this.sessions.history(req.identity.uid, id); }
  @Get('sessions/:id') async detail(@Req() req: AuthRequest, @Param('id') id: string) { const session = await this.sessions.owned(req.identity.uid, id); return { id, historyEnabled: session.historyEnabled, expiresAt: session.idleExpiresAt || session.expiresAt }; }
  @Delete('sessions/:id') @HttpCode(204) async remove(@Req() req: AuthRequest, @Param('id') id: string) { await this.sessions.close(req.identity.uid, id); this.assistant.cancel(req.identity.uid, id); this.speech.cancel(req.identity.uid, id); }
  @Post('sessions/:id/end') @HttpCode(204) async end(@Req() req: AuthRequest, @Param('id') id: string) { await this.sessions.end(req.identity.uid, id); this.assistant.cancel(req.identity.uid, id); this.speech.cancel(req.identity.uid, id); }
  @Post('feedback') @HttpCode(204) feedback(@Req() req: AuthRequest, @Body() body: unknown) { return this.sessions.feedback(req.identity.uid, body); }
  @Delete('me') @HttpCode(204) async deleteAccount(@Req() req: AuthRequest) {
    if (!Number.isFinite(req.identity.authTime) || Date.now() / 1000 - req.identity.authTime > 300 || req.identity.authTime > Date.now() / 1000 + 30) throw new ApiError('RECENT_LOGIN_REQUIRED', 401);
    this.assistant.cancelAll(req.identity.uid); this.speech.cancel(req.identity.uid);
    await this.sessions.eraseAccount(req.identity.uid); await this.identity.remove(req.identity.uid);
  }
  @Post('sessions/:id/speech/cancel') @HttpCode(204) async cancelSpeech(@Req() req: AuthRequest, @Param('id') id: string) { await this.sessions.owned(req.identity.uid, id); this.speech.cancel(req.identity.uid, id); }
  @Post('sessions/:id/transcriptions') @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 1, parts: 3, fieldSize: 1024 } }))
  async transcribe(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response, @Param('id') id: string, @Body() body: { metadata?: string }, @UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    console.info(`[VOICE API] request received: /sessions/${id}/transcriptions`);
    requireVerified(req.identity);
    console.info(`[VOICE API] auth ok: uid=${req.identity.uid}`);
    if (!file || file.mimetype !== 'audio/wav') throw new ApiError('INVALID_AUDIO');
    console.info(`[VOICE API] audio received: size=${file.buffer.length} bytes`);
    if (typeof body?.metadata !== 'string' || Object.keys(body).some(key => key !== 'metadata')) throw new ApiError('INVALID_INPUT');
    let metadata: unknown; try { metadata = JSON.parse(body.metadata || ''); } catch { throw new ApiError('INVALID_INPUT'); }
    const controller = new AbortController(), close = () => { if (!res.writableEnded) controller.abort(); }; res.on('close', close);
    console.info(`[VOICE API] transcription started`);
    try {
      const result = await this.speech.transcribe(req.identity.uid, id, metadata, file.buffer, controller.signal);
      console.info(`[VOICE API] transcription completed`);
      return result;
    }
    finally { res.off('close', close); file.buffer.fill(0); }
  }
  @Post('sessions/:id/turns/:requestId/audio') @HttpCode(200)
  async audio(@Req() req: AuthRequest, @Res() res: Response, @Param('id') id: string, @Param('requestId') requestId: string, @Body() body: unknown) {
    requireVerified(req.identity);
    const controller = new AbortController(), close = () => { if (!res.writableEnded) controller.abort(); }; res.on('close', close);
    try { const bytes = await this.speech.audio(req.identity.uid, id, requestId, body, controller.signal); res.type('audio/wav').send(Buffer.from(bytes)); }
    finally { res.off('close', close); }
  }
  @Post('sessions/:id/turns/:requestId/cancel') @HttpCode(204) async cancel(@Req() req: AuthRequest, @Param('id') id: string, @Param('requestId') requestId: string) { await this.sessions.owned(req.identity.uid, id); this.assistant.cancel(req.identity.uid, id, requestId); }
  @Post('sessions/:id/turns') @HttpCode(200) async turn(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response, @Param('id') id: string, @Body() body: unknown) {
    console.info(`[VOICE API] query started: /sessions/${id}/turns`);
    requireVerified(req.identity);
    const controller = new AbortController();
    const close = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', close);
    try {
      const result = await this.assistant.turn(req.identity.uid, id, body, controller.signal);
      console.info(`[VOICE API] query completed`);
      return result;
    }
    finally { res.off('close', close); }
  }
}
@Module({ controllers: [HealthController, ApiController], providers: [Configuration, Database, IdentityService, AuthGuard, Sessions, Assistant, Providers, Quota, Speech] })
export class AppModule {}
export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  return configureHttp(app);
}
export function configureHttp(app: INestApplication) {
  const config = app.get(Configuration);
  const smallJson = json({ limit: '32kb', strict: true, inflate: false });
  const imageJson = json({ limit: '3mb', strict: true, inflate: false });
  app.use(async (req: AuthRequest, res: Response, next: (error?: unknown) => void) => {
    if (req.method !== 'POST' || !/^\/api\/v1\/sessions\/[a-f0-9]{24}\/turns\/?$/.test(req.path)) return smallJson(req, res, next);
    // Authenticate before allocating the larger image request body. The controller
    // guard also enforces identity; no public image upload or file URL endpoint exists.
    try {
      const authorization = req.headers.authorization;
      if (!authorization?.startsWith('Bearer ') || authorization.length > 8192) throw new ApiError('AUTH_REQUIRED', 401);
      requireVerified(await app.get(IdentityService).verify(authorization.slice(7)));
      imageJson(req, res, next);
    } catch (error) { next(error); }
  });
  app.use((_req: unknown, res: Response, next: () => void) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (config.origins.includes(origin)) return callback(null, true);
      try {
        const u = new URL(origin);
        if ((u.protocol === 'https:' && u.hostname.endsWith('.vercel.app')) ||
            ((u.protocol === 'http:' || u.protocol === 'https:') && ['localhost', '127.0.0.1'].includes(u.hostname))) {
          return callback(null, true);
        }
      } catch {}
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new SafeErrors());
  app.enableShutdownHooks();
  return app;
}
