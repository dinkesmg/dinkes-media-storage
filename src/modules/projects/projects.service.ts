import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private generateApiKey(): string {
    return randomBytes(16).toString('hex');
  }

  async createProject(name: string) {
    const apiKey = this.generateApiKey();
    return this.prisma['project'].create({ data: { name, api_key: apiKey } });
  }

  async updateApiKey(name: string) {
    const apiKey = this.generateApiKey();
    return this.prisma['project'].update({
      where: { name },
      data: { api_key: apiKey },
    });
  }

  async getProject(name: string) {
    return this.prisma['project'].findUnique({ where: { name } });
  }

  async getProjectByApiKey(apiKey: string) {
    return this.prisma['project'].findUnique({ where: { api_key: apiKey } });
  }
}
