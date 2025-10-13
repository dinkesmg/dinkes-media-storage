import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { File } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  // Simpan file metadata ke database
  async saveFile(file: Express.Multer.File, project = 'default', uploaded_by?: string): Promise<File> {
    const url = `http://localhost:3000/images/${file.filename}`;
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

    const filePath = path.join(__dirname, '../../../public/images', file.filename_server);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await this.prisma.file.delete({ where: { id } });
    return true;
  }
}
