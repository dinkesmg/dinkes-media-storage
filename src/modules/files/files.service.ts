import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { File } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

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

  /**
   * Ambil buffer file dari memoryStorage atau diskStorage.
   */
  private async getFileBuffer(
    file: Express.Multer.File,
  ): Promise<Buffer> {
    if (file.buffer) {
      // memoryStorage
      return file.buffer;
    }

    const filePath =
      (file as any).path ||
      path.join(this.storageDir, 'images', file.filename);

    try {
      return await fs.promises.readFile(filePath);
    } catch {
      throw new BadRequestException(
        'File tidak dapat dibaca. Silakan coba unggah ulang.',
      );
    }
  }

  /**
   * Helper untuk load file-type secara dinamis (karena ESM).
   */
  private async detectFileTypeFromBuffer(buffer: Buffer) {
    const { fileTypeFromBuffer } = await import('file-type');
    return fileTypeFromBuffer(buffer);
  }

  /**
   * Validasi MIME asli (bukan cuma mimetype dari client).
   * Hanya mengizinkan image/jpeg dan image/png.
   */
  private async validateImageMime(buffer: Buffer): Promise<string> {
    const info = await this.detectFileTypeFromBuffer(buffer);

    if (!info || !['image/jpeg', 'image/png'].includes(info.mime)) {
      throw new BadRequestException(
        'File tidak valid. Hanya gambar JPG atau PNG yang diperbolehkan.',
      );
    }

    return info.mime;
  }

  /**
   * Proses gambar:
   * - auto-rotate (sesuai EXIF)
   * - strip metadata (EXIF, GPS, dll)
   * - resize max 1920x1920 (optional, bisa diubah)
   * - overwrite file di disk
   */
  private async processAndStripMetadata(
    file: Express.Multer.File,
    originalBuffer: Buffer,
    realMime: string,
  ): Promise<{ mime: string; size: number }> {
    const filePath =
      (file as any).path ||
      path.join(this.storageDir, 'images', file.filename);

    let sharpInstance = sharp(originalBuffer).rotate(); // auto-rotate

    if (realMime === 'image/jpeg') {
      sharpInstance = sharpInstance.jpeg({
        quality: 85,
        mozjpeg: true,
      });
    } else if (realMime === 'image/png') {
      sharpInstance = sharpInstance.png({
        compressionLevel: 9,
      });
    }

    // (opsional) batas resolusi maksimal
    sharpInstance = sharpInstance.resize(1920, 1920, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    const processedBuffer = await sharpInstance.toBuffer();

    // overwrite file di disk dengan versi yang sudah dibersihkan
    await fs.promises.writeFile(filePath, processedBuffer);

    return {
      mime: realMime,
      size: processedBuffer.length,
    };
  }

  // Simpan file metadata ke database
  async saveFile(
    file: Express.Multer.File,
    project = 'default',
    uploaded_by?: string,
  ): Promise<File> {
    // 1) ambil buffer file
    const buffer = await this.getFileBuffer(file);

    // 2) validasi MIME asli
    const realMime = await this.validateImageMime(buffer);

    // 3) proses gambar + hilangkan metadata sensitif
    const processed = await this.processAndStripMetadata(
      file,
      buffer,
      realMime,
    );

    const url = `${this.baseUrl}/images/${file.filename}`;

    return this.prisma.file.create({
      data: {
        project_name: project,
        filename_original: file.originalname,
        filename_server: file.filename,
        file_type: processed.mime,
        file_size: processed.size,
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
  async getFile(id: number, project?: string) {
    if (project) {
      return this.prisma.file.findFirst({
        where: { id, project_name: project },
      });
    }
    return this.prisma.file.findUnique({ where: { id } });
  }

  // Delete file fisik + metadata
  async deleteFile(id: number, project?: string) {
    const file = await this.getFile(id, project);
    if (!file) return false;

    const filePath = path.join(
      this.storageDir,
      'images',
      file.filename_server,
    );
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    await this.prisma.file.delete({ where: { id } });
    return true;
  }
}
