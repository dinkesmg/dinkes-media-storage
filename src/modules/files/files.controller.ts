import { Controller, Post, UploadedFile, UseInterceptors, Query, Get, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import type { Express } from 'express';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // Upload file
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Query('project') project?: string) {
    const result = await this.filesService.saveFile(file, project);
    return { message: 'Upload successful', url: result.url };
  }

  // List file (dapat filter per project)
  @Get()
  async listFiles(@Query('project') project?: string) {
    return this.filesService.listFiles(project);
  }

  // Detail file
  @Get(':id')
  async getFile(@Param('id', ParseIntPipe) id: number) {
    const file = await this.filesService.getFile(id);
    if (!file) return { message: 'File not found' };
    return file;
  }

  // Delete file
  @Delete(':id')
  async deleteFile(@Param('id', ParseIntPipe) id: number) {
    const success = await this.filesService.deleteFile(id);
    return { success };
  }
}
