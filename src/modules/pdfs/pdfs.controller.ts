import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  Param,
  Delete,
  ParseFilePipe,
  ParseIntPipe,
  UseGuards,
  Request,
  Body,
  MaxFileSizeValidator,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Response } from 'express';
import { ApiKeyGuard } from 'src/guards/api-key.guard';
import { PdfsService } from './pdfs.service';

@UseGuards(ApiKeyGuard)
@Controller('pdfs-api')
export class PdfsController {
  constructor(private readonly pdfsService: PdfsService) {}

  /**
   * UPLOAD PDF (private/public)
   * form-data:
   * - file: <pdf>
   * - is_private: "1" | "true" | "on" | "0" | "false"
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 3 * 1024 * 1024 })],
        exceptionFactory: () =>
          new BadRequestException({
            statusCode: 400,
            message: 'File tidak valid. Ukuran maksimal 10MB.',
          }),
      }),
    )
    file: Express.Multer.File,
    @Request() req: any,
    @Body('is_private') is_private?: string,
  ) {
    const projectName = req.project;

    const isPrivate = ['1', 'true', 'on', 'yes'].includes(
      String(is_private ?? '').toLowerCase(),
    );

    // ✅ token dibuat & disimpan oleh service/DB, bukan di controller
    const result = await this.pdfsService.savePdf(file, projectName, isPrivate);

    return {
      message: 'Upload PDF berhasil',
      id: result.id,
      is_private: result.is_private,
      // url hanya ada kalau public, kalau private -> null
      url: result.url,
      // ✅ download pakai token (tidak mudah ditebak)
      token: result.download_token,
      download_url: `${process.env.BASE_URL}/pdfs-api/download/${result.download_token}`,
    };
  }

  // LIST PDF (milik project ini)
  @Get()
  async listPdfs(@Request() req: any) {
    return this.pdfsService.listPdfs(req.project);
  }

  // DETAIL PDF by id (milik project ini)
  @Get(':id')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const pdf = await this.pdfsService.getPdf(id, req.project);
    if (!pdf) return { message: 'PDF not found or not in this project' };
    return pdf;
  }

  // DELETE PDF by id (milik project ini)
  @Delete(':id')
  async deletePdf(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const success = await this.pdfsService.deletePdf(id, req.project);
    return {
      success,
      message: success ? 'PDF deleted' : 'PDF not found or not in this project',
    };
  }

  /**
   * DOWNLOAD PDF by token (private/public)
   * Wajib x-api-key (karena controller pakai ApiKeyGuard)
   */
  @Get('download/:token')
  async downloadByToken(
    @Param('token') token: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    await this.pdfsService.downloadPdfByToken(token, req.project, res);
  }
}
