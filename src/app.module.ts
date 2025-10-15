import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProjectsModule } from './modules/projects/projects.module';
import { FilesModule } from './modules/files/files.module';

@Module({
  imports: [ProjectsModule, FilesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
