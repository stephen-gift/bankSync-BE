import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly sensitiveFields = [
    'password',
    'token',
    'secret',
    'authorization',
  ];

  private sanitizeObject(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized = { ...obj };
    for (const key in sanitized) {
      if (
        this.sensitiveFields.some((field) => key.toLowerCase().includes(field))
      ) {
        sanitized[key] = '***REDACTED***';
      }
    }
    return sanitized;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method;
    const url = request.url;
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = request.body;
    const query = request.query as Record<string, unknown> | undefined;
    const params = request.params as Record<string, unknown> | undefined;
    const userAgentHeader = request.get('user-agent');
    const userAgent =
      typeof userAgentHeader === 'string' ? userAgentHeader : '';
    const requestBody = body as Record<string, unknown> | undefined;
    const startTime = Date.now();

    // Build request log
    const requestLog: string[] = [
      `→ ${method} ${url}`,
      `IP: ${ip}`,
      `UA: ${userAgent}`,
    ];

    // Log query parameters if present
    if (query && typeof query === 'object' && Object.keys(query).length > 0) {
      const sanitizedQuery = this.sanitizeObject(query);
      requestLog.push(`Query: ${JSON.stringify(sanitizedQuery)}`);
    }

    // Log route parameters if present
    if (
      params &&
      typeof params === 'object' &&
      Object.keys(params).length > 0
    ) {
      requestLog.push(`Params: ${JSON.stringify(params)}`);
    }

    // Log request body for POST, PUT, PATCH requests
    if (
      ['POST', 'PUT', 'PATCH'].includes(method) &&
      requestBody &&
      typeof requestBody === 'object' &&
      !Array.isArray(requestBody) &&
      Object.keys(requestBody).length > 0
    ) {
      const sanitizedBody = this.sanitizeObject(requestBody);
      requestLog.push(`Body: ${JSON.stringify(sanitizedBody)}`);
    }

    // Log incoming request
    this.logger.log(requestLog.join(' | '));

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = response;
          const responseTime = Date.now() - startTime;

          // Log successful response
          this.logger.log(
            `← ${method} ${url} ${statusCode} - ${responseTime}ms`,
          );
        },
        error: (error: Error) => {
          const { statusCode } = response;
          const responseTime = Date.now() - startTime;

          // Log error response
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `✗ ${method} ${url} ${statusCode} - ${responseTime}ms - ${errorMessage}`,
          );
        },
      }),
    );
  }
}
