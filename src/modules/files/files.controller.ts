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

@UseGuards(ApiKeyGuard)          // ⬅️ semua route di controller ini wajib api key
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // Upload file
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({
            fileType: /^image\/(jpe?g|png)$/i,
          }),
          new MaxFileSizeValidator({
            maxSize: 2 * 1024 * 1024,
          }),
        ],
        exceptionFactory: (errors) => {
          // Kustom pesan error dalam Bahasa Indonesia
          return new BadRequestException({
            statusCode: 400,
            message:
              'File tidak valid. Hanya gambar JPG, JPEG, atau PNG dengan ukuran maksimal 5MB yang diperbolehkan.',
          });
        },
      }),
    )
    file: Express.Multer.File,
    @Request() req,
  ) {
    const projectName = req.project;
    const result = await this.filesService.saveFile(file, projectName);
    return { message: 'Upload berhasil', url: result.url };
  }


  // List file -> HANYA file milik project ini
  @Get()
  async listFiles(@Request() req) {
    const projectName = req.project; // dari guard
    return this.filesService.listFiles(projectName);
  }

  // Detail file -> hanya boleh ambil file milik project ini
  @Get(':id')
  async getFile(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const projectName = req.project;
    const file = await this.filesService.getFile(id, projectName);

    if (!file) {
      return { message: 'File not found or not in this project' };
    }

    return file;
  }

  // Delete file -> hanya boleh hapus file milik project ini
  @Delete(':id')
  async deleteFile(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
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
