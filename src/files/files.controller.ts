import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  MessageEvent,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { Auth } from 'src/auth/authentication/decorators/auth.decorator';
import { AuthType } from 'src/auth/authentication/enums/auth-type.enum';
import { ActiveUser } from 'src/auth/decorators/active-user.decorator';
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface';
import { EventPayloads } from 'src/common/interfaces/event-emitter/event-payloads.interface';
import { TypedEventEmitter } from 'src/common/types/typed-event-emitter/typed-event-emitter.class';
import { AllConfigType } from 'src/config/config.type';
import { MinioService } from 'src/minio/minio.service';
import { apiResponseHandler } from 'src/utils/ApiResponseHandler';
import { FilesQueueKeys } from './constants/files-queue-keys.enum';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  private readonly path: string;

  constructor(
    @InjectQueue(FilesQueueKeys.UPLOAD)
    private readonly filesUploadQueue: Queue,
    private readonly filesService: FilesService,
    private readonly minioService: MinioService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly eventEmitter: TypedEventEmitter,
  ) {
    this.path = this.configService.get('files.path', { infer: true });
  }

  @UseInterceptors(FileInterceptor('file'))
  @Post('upload')
  async upload(
    @Body() createFileDto: CreateFileDto,
    @UploadedFile() file: Express.Multer.File,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    if (!file) {
      throw new BadRequestException('Please upload a file');
    }
    // Convert buffer to base64 string for queue serialization
    const fileForQueue = {
      ...file,
      buffer: file.buffer.toString('base64'),
    };

    await this.filesUploadQueue.add(FilesQueueKeys.UPLOAD, {
      body: createFileDto,
      file: fileForQueue,
      activeUser,
    });

    return apiResponseHandler('Upload initiated', HttpStatus.OK);
  }

  @Get()
  async findAllByCategory(
    @Query()
    {
      page = 1,
      limit = 10,
      category,
    }: {
      page: number;
      limit: number;
      category?: number;
    },
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.filesService.findAll(
      {
        populate: ['category'],
        ...(category && { category }),
        createdBy: activeUser.sub,
      },
      { page, limit },
    );
  }

  @Get('download/:id')
  async download(
    @Param('id', ParseObjectIdPipe) id: string,
    @Res() res: Response,
  ) {
    const { ref } = await this.filesService.findById(id).catch((err) => {
      throw new NotFoundException(`File not found`);
    });

    const stringArray = ref.split('/');
    const filename = stringArray[stringArray.length - 1];

    const url = await this.minioService.getFileUrl(ref);

    this.httpService.get(url, { responseType: 'stream' }).subscribe({
      next: (response) => {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=${filename}`,
        );
        response.data.pipe(res);
      },
      error: (err) => {
        throw new BadRequestException(err.message);
      },
    });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateFileDto: UpdateFileDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    const file = await this.filesService.findById(id);

    const newObject = await this.minioService.updateFileName(
      file.ref,
      this.path + updateFileDto.filename,
      'zip',
    );

    const updatedFile = this.filesService.update(
      id,
      {
        filename: newObject.filename.split('/').pop(),
        ref: newObject.filename,
      },
      { new: true },
      activeUser,
    );

    return apiResponseHandler(
      'File updated successfully',
      HttpStatus.OK,
      updatedFile,
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    const file = await this.filesService.findById(id);

    await this.minioService.deleteFile(file.ref);

    await this.filesService.remove(id);

    return apiResponseHandler('File deleted successfully', HttpStatus.OK);
  }

  @Auth(AuthType.None)
  @Sse('sse')
  sse(): Observable<MessageEvent> {
    return new Observable((observer) => {
      const compressionListener = (
        payload: EventPayloads['files.compressed'],
      ) => {
        observer.next({ data: payload });
      };

      const uploadListener = (payload: EventPayloads['files.uploaded']) => {
        observer.next({ data: payload });
      };

      const heartbeat = setInterval(() => {
        observer.next({
          data: { type: 'heartbeat', timestamp: Date.now() },
          type: 'heartbeat',
        });
      }, 1000);

      this.eventEmitter.on('files.compressed', compressionListener);
      this.eventEmitter.on('files.uploaded', uploadListener);

      return () => {
        clearInterval(heartbeat);
        this.eventEmitter.off('files.compressed', compressionListener);
        this.eventEmitter.off('files.uploaded', uploadListener);
      };
    });
  }
}
