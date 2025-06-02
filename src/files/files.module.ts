import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MinioModule } from 'src/minio/minio.module';
import { FilesQueueKeys } from './constants/files-queue-keys.enum';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesUploadProcessor } from './queue/files-upload.consumer';
import { File, FileSchema } from './schemas/file.schema';
import { UploadStatusService } from './upload-status.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: File.name, schema: FileSchema }]),
    MinioModule,
    HttpModule,
    BullModule.registerQueue(
      { name: FilesQueueKeys.UPLOAD },
      { name: FilesQueueKeys.COMPRESSION },
    ),
  ],
  controllers: [FilesController],
  providers: [FilesService, UploadStatusService, FilesUploadProcessor],
  exports: [MongooseModule, FilesService],
})
export class FilesModule {}
