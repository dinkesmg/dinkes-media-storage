import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config'; // ✅ tambahkan ini
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';

import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeyGuard } from '../../guards/api-key.guard';

const baseStorage =
  process.env.STORAGE_DIR || path.join(process.cwd(), 'storage_local');

const MulterConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const dest = path.join(baseStorage, 'images');
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const unique = `file-${Date.now()}${ext}`;
      cb(null, unique);
    },
  }),
};

@Module({
  imports: [
    MulterModule.register(MulterConfig),
    ConfigModule, // ✅ ini yang bikin ConfigService tersedia di FilesService
  ],
  controllers: [FilesController],
  providers: [FilesService, PrismaService, ApiKeyGuard],
  exports: [FilesService],
})
export class FilesModule {}
