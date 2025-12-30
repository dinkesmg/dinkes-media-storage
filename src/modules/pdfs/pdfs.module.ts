// src/modules/pdfs/pdfs.module.ts
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { diskStorage, memoryStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';

import { PdfsController } from './pdfs.controller';
import { PdfsService } from './pdfs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeyGuard } from '../../guards/api-key.guard';

const baseStorage =
  process.env.STORAGE_DIR || path.join(process.cwd(), 'storage_local');

const PdfMulterConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const dest = path.join(baseStorage, 'pdfs');
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      const unique = `pdf-${Date.now()}.pdf`; // paksa .pdf
      cb(null, unique);
    },
  }),
};

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(), // ✅ biar service yang menentukan folder
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    ConfigModule,
  ],
  controllers: [PdfsController],
  providers: [PdfsService, PrismaService, ApiKeyGuard],
  exports: [PdfsService],
})
export class PdfsModule {}
