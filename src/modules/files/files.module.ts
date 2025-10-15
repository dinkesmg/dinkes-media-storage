import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(__dirname, '../../../public/images');

          // buat folder kalau belum ada
          if (!fs.existsSync(uploadPath))
            fs.mkdirSync(uploadPath, { recursive: true });

          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const slug = req.body.slug || 'file'; // bisa dari frontend atau generate backend
          const timestamp = Date.now();
          const ext = path.extname(file.originalname);
          cb(null, `${slug}-${timestamp}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invalid file type'), false);
      },
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, PrismaService],
})
export class FilesModule {}
