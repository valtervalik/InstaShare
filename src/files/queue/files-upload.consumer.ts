import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface';
import { TypedEventEmitter } from 'src/common/types/typed-event-emitter/typed-event-emitter.class';
import { AllConfigType } from 'src/config/config.type';
import { MinioService } from 'src/minio/minio.service';
import { FilesQueueKeys } from '../constants/files-queue-keys.enum';
import { CreateFileDto } from '../dto/create-file.dto';
import { FilesService } from '../files.service';

interface UploadJobData {
  body: CreateFileDto;
  file: Express.Multer.File & { buffer: string }; // buffer is base64 string from queue
  activeUser: ActiveUserData;
}

@Processor({ name: FilesQueueKeys.UPLOAD })
export class FilesUploadProcessor extends WorkerHost {
  private readonly path: string;

  constructor(
    private readonly filesService: FilesService,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly eventEmitter: TypedEventEmitter,
  ) {
    super();
    this.path = this.configService.get('files.path', { infer: true });
  }

  async process(job: Job<UploadJobData>, token?: string): Promise<any> {
    const { body, file, activeUser } = job.data;

    // Convert base64 string back to Buffer
    const fileWithBuffer = {
      ...file,
      buffer: Buffer.from(file.buffer as string, 'base64'),
    };

    await this.minioService.createBucketIfNotExists();

    const stringArray = fileWithBuffer.originalname.split('.');
    const format = stringArray[stringArray.length - 1];
    const fileName = `${body.filename}.${format}`;

    const ref = await this.minioService.uploadFile(
      fileWithBuffer,
      this.path + body.filename,
    );

    await this.filesService.create(
      {
        filename: fileName,
        category: body.category,
        ref,
        size: fileWithBuffer.size,
      },
      activeUser,
    );

    this.eventEmitter.emit('files.uploaded', {
      message: `File uploaded successfully: ${fileName}`,
      clientId: activeUser.sub,
    });
  }
}
