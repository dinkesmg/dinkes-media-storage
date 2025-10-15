import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    if (!apiKey) throw new UnauthorizedException('API Key is required');

    const project = await this.prisma['project'].findUnique({
      where: { api_key: apiKey },
    });
    if (!project) throw new UnauthorizedException('Invalid API Key');

    request.project = project.name;
    return true;
  }
}
