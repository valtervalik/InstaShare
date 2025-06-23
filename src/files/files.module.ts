import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import authConfig from 'src/auth/config/auth.config';
import { MinioModule } from 'src/minio/minio.module';
import { FilesQueueKeys } from './constants/files-queue-keys.enum';
import { FilesCompressionCron } from './cron/files-compression.cron';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesCompressionProcessor } from './queue/files-compression.consumer';
import { FilesUploadProcessor } from './queue/files-upload.consumer';
import { File, FileSchema } from './schemas/file.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: File.name, schema: FileSchema }]),
    MinioModule,
    HttpModule,
    BullModule.registerQueue(
      { name: FilesQueueKeys.UPLOAD },
      { name: FilesQueueKeys.COMPRESSION },
    ),
    JwtModule.registerAsync(authConfig.asProvider()),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    FilesUploadProcessor,
    FilesCompressionProcessor,
    FilesCompressionCron,
  ],
  exports: [MongooseModule, FilesService],
})
export class FilesModule {}
