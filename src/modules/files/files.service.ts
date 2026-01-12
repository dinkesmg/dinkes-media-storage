import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { File } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';

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
   * Helper path root untuk image public/private
   * (tanpa subfolder project)
   */
  private getImagesRoot(isPrivate: boolean) {
    return path.join(
      this.storageDir,
      isPrivate ? 'images_private' : 'images_public',
    );
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
   * - resize max 1920x1920
   * Return buffer hasil proses (belum ditulis ke disk)
   */
  private async processAndStripMetadataToBuffer(
    originalBuffer: Buffer,
    realMime: string,
  ): Promise<Buffer> {
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

    sharpInstance = sharpInstance.resize(1920, 1920, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    return sharpInstance.toBuffer();
  }

  /**
   * Ambil buffer file dari memoryStorage atau diskStorage.
   * (kalau dari controller pakai FileInterceptor default, biasanya file.buffer ada)
   */
  private async getFileBuffer(file: Express.Multer.File): Promise<Buffer> {
    if (file?.buffer) return file.buffer;

    const filePath = (file as any)?.path;
    if (!filePath) {
      throw new BadRequestException(
        'File tidak terbaca (buffer/path kosong). Pastikan upload multipart/form-data dengan key "file".',
      );
    }

    try {
      return await fs.promises.readFile(filePath);
    } catch {
      throw new BadRequestException(
        'File tidak dapat dibaca. Silakan coba unggah ulang.',
      );
    }
  }

  /**
   * Simpan file metadata ke database + simpan fisik ke disk.
   * image disimpan ke:
   * - storage_local/images_public/<filename>
   * - storage_local/images_private/<filename>
   *
   * NOTE: Tanpa subfolder project.
   */
  async saveFile(
    file: Express.Multer.File,
    project = 'default',
    uploaded_by?: string,
    isPrivate = false, // ✅ tambahan param (opsional)
  ): Promise<File> {
    // 1) ambil buffer file
    const originalBuffer = await this.getFileBuffer(file);

    // 2) validasi MIME asli
    const realMime = await this.validateImageMime(originalBuffer);

    // 3) proses gambar + hilangkan metadata sensitif
    const processedBuffer = await this.processAndStripMetadataToBuffer(
      originalBuffer,
      realMime,
    );

    // 4) tentukan filename server sendiri (JANGAN pakai file.filename)
    const ext = realMime === 'image/png' ? '.png' : '.jpg';
    const filenameServer = `img-${Date.now()}${ext}`;

    // 5) tentukan folder public/private dan pastikan ada
    const imagesRoot = this.getImagesRoot(isPrivate);
    await fs.promises.mkdir(imagesRoot, { recursive: true });

    const filePath = path.join(imagesRoot, filenameServer);

    // 6) tulis ke disk
    await fs.promises.writeFile(filePath, processedBuffer);

    // 7) url (public saja). private -> null (kalau kamu ingin strict)
    const url = isPrivate ? null : `${this.baseUrl}/images/${filenameServer}`;

    const downloadToken = crypto.randomUUID();

    // 8) simpan ke DB
    return this.prisma.file.create({
      data: {
        project_name: project,
        filename_original: file.originalname,
        filename_server: filenameServer,
        file_type: realMime,
        file_size: processedBuffer.length,
        url, // null kalau private (kalau kolom kamu mengizinkan null)
        download_token: downloadToken,
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

    // Karena DB kamu belum menyimpan flag is_private, kita coba hapus dari public & private.
    const publicPath = path.join(
      this.getImagesRoot(false),
      file.filename_server,
    );
    const privatePath = path.join(
      this.getImagesRoot(true),
      file.filename_server,
    );

    if (fs.existsSync(publicPath)) {
      await fs.promises.unlink(publicPath);
    } else if (fs.existsSync(privatePath)) {
      await fs.promises.unlink(privatePath);
    }

    await this.prisma.file.delete({ where: { id } });
    return true;
  }
}
