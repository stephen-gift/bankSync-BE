import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Add global request logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // CORS (needed for browser-based frontends calling this API).
  // Note: OAuth initiation should be done via browser navigation (window.location),
  // not via fetch, because it redirects to accounts.google.com (CORS will block that).
  const parsedCorsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  const allowedOrigins = Array.from(
    new Set([...(frontendUrl ? [frontendUrl] : []), ...parsedCorsOrigins]),
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow non-browser clients (curl, server-to-server) with no Origin header.
      if (!origin) return callback(null, true);

      // In dev, if nothing is configured, default to permissive to reduce friction.
      if (
        allowedOrigins.length === 0 &&
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const config = new DocumentBuilder()
    .setTitle('BankSync API')
    .setDescription('BankSync Backend API documentation')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Server is running on port ${process.env.PORT ?? 3000}`);
  console.log(
    `Swagger is running on port ${process.env.PORT ?? 3000}/api/docs`,
  );
  console.log(
    `Database is running on port ${process.env.NODE_ENV === 'production' ? process.env.DATABASE_URL : process.env.DATABASE_URL_DEV}`,
  );
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
