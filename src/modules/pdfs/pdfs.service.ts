import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
// import { File } from '@prisma/client';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import type { Response } from 'express';

type FileModel = Prisma.FileGetPayload<{}>;
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfsService {
  private readonly baseUrl: string;
  private readonly storageDir: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const baseUrl = this.configService.get<string>('BASE_URL');
    if (!baseUrl) throw new Error('BASE_URL environment variable is not set');
    this.baseUrl = baseUrl;

    this.storageDir =
      this.configService.get<string>('STORAGE_DIR') ||
      path.join(process.cwd(), 'storage_local');
  }

  private async detectFileTypeFromBuffer(buffer: Buffer) {
    const { fileTypeFromBuffer } = await import('file-type');
    return fileTypeFromBuffer(buffer);
  }

  private async getFileBuffer(file: Express.Multer.File): Promise<Buffer> {
    if (file.buffer) return file.buffer;
    if ((file as any).path) return fs.promises.readFile((file as any).path);

    throw new BadRequestException(
      'File tidak dapat dibaca. Silakan unggah ulang.',
    );
  }

  private async validatePdfMime(buffer: Buffer): Promise<string> {
    const info = await this.detectFileTypeFromBuffer(buffer);
    if (!info || info.mime !== 'application/pdf') {
      throw new BadRequestException(
        'File tidak valid. Hanya PDF yang diperbolehkan.',
      );
    }
    return info.mime;
  }

  private async saveBufferToDisk(buffer: Buffer, destPath: string) {
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.writeFile(destPath, buffer);
  }

  async savePdf(
    file: Express.Multer.File,
    project = 'default',
    isPrivate = true,
    uploaded_by?: string,
  ): Promise<FileModel> {
    const buffer = await this.getFileBuffer(file);
    const realMime = await this.validatePdfMime(buffer);

    // ✅ tentukan folder berdasarkan private/public
    const folder = isPrivate ? 'pdfs_private' : 'pdfs_public';

    // ✅ bikin nama file server sendiri (jangan percaya filename dari multer)
    const filenameServer = `pdf-${Date.now()}.pdf`;
    const diskPath = path.join(this.storageDir, folder, filenameServer);

    // ✅ tulis ke disk
    await this.saveBufferToDisk(buffer, diskPath);

    // ✅ url public hanya untuk yang public
    const url = isPrivate ? null : `${this.baseUrl}/pdfs/${filenameServer}`;
    const download_token = crypto.randomUUID();

    return this.prisma.file.create({
      data: {
        project_name: project,
        filename_original: file.originalname,
        filename_server: filenameServer,
        file_type: realMime,
        file_size: buffer.length,
        url,
        download_token,
        is_private: isPrivate,
        uploaded_by,
      },
    });
  }

  async listPdfs(project: string) {
    return this.prisma.file.findMany({
      where: { project_name: project, file_type: 'application/pdf' },
      orderBy: { created_at: 'desc' },
    });
  }

  async getPdf(id: number, project: string) {
    return this.prisma.file.findFirst({
      where: { id, project_name: project, file_type: 'application/pdf' },
    });
  }

  async deletePdf(id: number, project: string) {
    const pdf = await this.getPdf(id, project);
    if (!pdf) return false;

    const folder = pdf.is_private ? 'pdfs_private' : 'pdfs_public';
    const filePath = path.join(this.storageDir, folder, pdf.filename_server);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    await this.prisma.file.delete({ where: { id } });
    return true;
  }

  async downloadPdfByToken(token: string, project: string, res: Response) {
    const pdf = await this.prisma.file.findFirst({
      where: {
        download_token: token,
        project_name: project,
        file_type: 'application/pdf',
      },
    });

    if (!pdf) {
      throw new BadRequestException(
        'PDF tidak ditemukan / bukan milik project ini',
      );
    }

    const folder = pdf.is_private ? 'pdfs_private' : 'pdfs_public';
    const filePath = path.join(this.storageDir, folder, pdf.filename_server);

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('File fisik tidak ditemukan di server');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(pdf.filename_original)}"`,
    );

    fs.createReadStream(filePath).pipe(res);
  }
}
