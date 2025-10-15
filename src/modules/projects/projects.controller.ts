import { Controller, Post, Patch, Body, Get, Param } from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // API untuk membuat proyek baru
  @Post()
  async createProject(@Body('name') name: string) {
    const project = await this.projectsService.createProject(name);
    return { message: 'Project created', project };
  }

  // API untuk update API Key proyek
  @Patch(':name/api-key')
  async updateApiKey(@Param('name') name: string) {
    const project = await this.projectsService.updateApiKey(name);
    return { message: 'API Key updated', project };
  }

  // API untuk cek detail proyek
  @Get(':name')
  async getProject(@Param('name') name: string) {
    return this.projectsService.getProject(name);
  }
}
