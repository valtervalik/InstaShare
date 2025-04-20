import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MinioModule } from 'src/minio/minio.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { File, FileSchema } from './schemas/file.schema';
import { UploadStatusService } from './upload-status.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: File.name, schema: FileSchema }]),
    MinioModule,
    HttpModule,
  ],
  controllers: [FilesController],
  providers: [FilesService, UploadStatusService],
  exports: [MongooseModule],
})
export class FilesModule {}
