import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Query,
  Get,
  Param,
  Delete,
  ParseFilePipe,
  ParseIntPipe,
  UseGuards,
  Request,
  FileTypeValidator,
  MaxFileSizeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import type { Express } from 'express';
import { ApiKeyGuard } from 'src/guards/api-key.guard';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { Body } from '@nestjs/common';
import { extname } from 'path';

@UseGuards(ApiKeyGuard) // ⬅️ semua route di controller ini wajib api key
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // Upload file
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Request() req: any,
    @Body('is_private') is_private?: string,
  ) {
    if (!file) throw new BadRequestException('File wajib dikirim (key: file).');

    const ext = extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      throw new BadRequestException('Hanya JPG/JPEG/PNG yang diperbolehkan.');
    }

    const isPrivate = ['1', 'true', 'on', 'yes'].includes(
      String(is_private ?? '').toLowerCase(),
    );

    const projectName = req.project;

    const result = await this.filesService.saveFile(
      file,
      projectName,
      undefined,
      isPrivate,
    );

    return {
      message: 'Upload berhasil',
      id: result.id,
      is_private: result.is_private,
      url: result.url,
      token: result.download_token,
    };
  }

  // List file -> HANYA file milik project ini
  @Get()
  async listFiles(@Request() req) {
    const projectName = req.project; // dari guard
    return this.filesService.listFiles(projectName);
  }

  // Detail file -> hanya boleh ambil file milik project ini
  @Get(':id')
  async getFile(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const projectName = req.project;
    const file = await this.filesService.getFile(id, projectName);

    if (!file) {
      return { message: 'File not found or not in this project' };
    }

    return file;
  }

  // Delete file -> hanya boleh hapus file milik project ini
  @Delete(':id')
  async deleteFile(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const projectName = req.project;
    const success = await this.filesService.deleteFile(id, projectName);

    return {
      success,
      message: success
        ? 'File deleted'
        : 'File not found or not in this project',
    };
  }
}
