import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Query,
  Get,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import type { Express } from 'express';
import { ApiKeyGuard } from 'src/guards/api-key.guard';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // Upload file
  @Post('upload')
  @UseGuards(ApiKeyGuard)
  @UseInterceptors(FileInterceptor('file'))
  // async uploadFile(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Query('project') project?: string,
  // ) {
  //   const result = await this.filesService.saveFile(file, project);
  //   return { message: 'Upload successful', url: result.url };
  // }
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Request() req) {
    const projectName = req.project; // didapat dari Guard
    const result = await this.filesService.saveFile(file, projectName);
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
