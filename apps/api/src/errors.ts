import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
export class ApiError extends HttpException {
  constructor(public readonly code: string, status = 400, public readonly retryAfterMs?: number) { super(code, status); }
}
@Catch()
export class SafeErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const code = error instanceof ApiError ? error.code : status === 404 ? 'NOT_FOUND' : status === 413 ? 'INPUT_TOO_LARGE' : status === 400 ? 'INVALID_INPUT' : 'INTERNAL_ERROR';
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json({ code, messageKey: code, requestId: randomUUID(), ...(error instanceof ApiError && error.retryAfterMs ? { retryAfterMs: error.retryAfterMs } : {}) });
  }
}
