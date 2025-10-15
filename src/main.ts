import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Serve public/images sebagai static
  app.use('/images', express.static(join(__dirname, '../public/images')));

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://sayangbeta.dinkes.semarangkota.go.id/',
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
    credentials: true,
  });

  app.use(
    '/files',
    rateLimit({
      windowMs: 60 * 1000, // 1 menit
      max: 60, // maksimal 60 request per IP per menit
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  await app.listen(3000);
  console.log('CDN Service running on http://localhost:3000');
}
bootstrap();
