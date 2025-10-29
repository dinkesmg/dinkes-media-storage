import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { File } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FilesService {
  private readonly baseUrl: string;
  private readonly storageDir: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const baseUrl = this.configService.get<string>('BASE_URL');
    if (!baseUrl) {
      throw new Error('BASE_URL environment variable is not set');
    }
    this.baseUrl = baseUrl;

    // isi storageDir dari ENV atau fallback ke folder lokal
    this.storageDir =
      this.configService.get<string>('STORAGE_DIR') ||
      path.join(process.cwd(), 'storage_local');
  }

  // Simpan file metadata ke database
  async saveFile(
    file: Express.Multer.File,
    project = 'default',
    uploaded_by?: string,
  ): Promise<File> {
    const url = `${this.baseUrl}/images/${file.filename}`;
    return this.prisma.file.create({
      data: {
        project_name: project,
        filename_original: file.originalname,
        filename_server: file.filename,
        file_type: file.mimetype,
        file_size: file.size,
        url,
        uploaded_by,
      },
    });
  }

  // List semua file, bisa filter per project
  async listFiles(project?: string) {
    return this.prisma.file.findMany({
      where: project ? { project_name: project } : {},
      orderBy: { created_at: 'desc' },
    });
  }

  // Detail file
  async getFile(id: number) {
    return this.prisma.file.findUnique({ where: { id } });
  }

  // Delete file fisik + metadata
  async deleteFile(id: number) {
    const file = await this.getFile(id);
    if (!file) return false;

    const filePath = path.join(this.storageDir, 'images', file.filename_server);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await this.prisma.file.delete({ where: { id } });
    return true;
  }
}
