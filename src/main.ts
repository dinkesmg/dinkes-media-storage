import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import rateLimit from 'express-rate-limit';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  const config = new DocumentBuilder()
    .setTitle('Media Storage API')
    .setDescription('Daftar endpoint API')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    useGlobalPrefix: true,
  });

  // base path dinamis dari ENV atau fallback ke folder lokal
  const baseStorage =
    process.env.STORAGE_DIR || join(__dirname, '../storage_local');

  // Serve folder images agar bisa diakses via http://localhost:3001/images/xxx.jpg
  app.use('/images', express.static(join(baseStorage, 'images')));
  // app.use('/pdfs', express.static(join(baseStorage, 'pdfs')));
  app.use('/pdfs', express.static(join(baseStorage, 'pdfs_public')));

  console.log('Serving images from:', join(baseStorage, 'images'));
  console.log('Serving pdfs from:', join(baseStorage, 'pdfs_public'));

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://sayangbeta.dinkes.semarangkota.go.id/',
      'https://verrari.dinkes.semarangkota.go.id/',
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
    credentials: true,
  });

  app.use(
    ['/files', '/pdfs-api'],
    rateLimit({
      windowMs: 60 * 1000, // 1 menit
      max: 60, // maksimal 60 request per IP per menit
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  await app.listen(3001);
  console.log('CDN Service running on http://localhost:3001');
}
bootstrap();
