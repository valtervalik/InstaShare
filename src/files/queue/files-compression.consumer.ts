import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import * as AdmZip from 'adm-zip';
import { Job } from 'bullmq';
import { TypedEventEmitter } from 'src/common/types/typed-event-emitter/typed-event-emitter.class';
import { AllConfigType } from 'src/config/config.type';
import { MinioService } from 'src/minio/minio.service';
import { FilesQueueKeys } from '../constants/files-queue-keys.enum';
import { FileStatusEnum } from '../enums/file-status.enum';
import { FilesService } from '../files.service';
import { File } from '../schemas/file.schema';

interface CompressionJobData {
  files: File[];
}

@Processor({ name: FilesQueueKeys.COMPRESSION })
export class FilesCompressionProcessor extends WorkerHost {
  private readonly path: string;

  constructor(
    private readonly minioService: MinioService,
    private readonly filesService: FilesService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly eventEmitter: TypedEventEmitter,
  ) {
    super();
    this.path = this.configService.get('files.path', { infer: true });
  }

  async process(job: Job<CompressionJobData>, token?: string): Promise<any> {
    console.log('Processing file compression job:', job.data);

    const { files } = job.data;

    for (const file of files) {
      const zip = new AdmZip();
      const fileBuffer = await this.minioService.getFileBuffer(file.ref);
      zip.addFile(file.filename, fileBuffer);
      const zipBuffer = zip.toBuffer();

      const stringArray = file.filename.split('.');
      const zipName = `${stringArray[0]}.zip`;

      const ref = await this.minioService.uploadBuffer(
        zipBuffer,
        this.path + zipName,
      );

      await this.filesService.update(
        file._id as string,
        {
          ref,
          status: FileStatusEnum.COMPRESSED,
          compressedSize: zipBuffer.length,
        },
        { new: true },
      );

      await this.minioService.deleteFile(file.ref);
    }

    this.eventEmitter.emit('files.compressed', {
      message: 'Files compressed successfully',
    });
  }
}
