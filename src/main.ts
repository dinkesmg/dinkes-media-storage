import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Serve public/images sebagai static
  app.use('/images', express.static(join(__dirname, '../public/images')));

  await app.listen(3000);
  console.log('CDN Service running on http://localhost:3000');
}
bootstrap();
