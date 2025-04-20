import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Auth } from 'src/auth/authentication/decorators/auth.decorator';
import { AuthType } from 'src/auth/authentication/enums/auth-type.enum';
import { ActiveUser } from 'src/auth/decorators/active-user.decorator';
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface';
import { AllConfigType } from 'src/config/config.type';
import { MinioService } from 'src/minio/minio.service';
import { apiResponseHandler } from 'src/utils/ApiResponseHandler';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { FilesService } from './files.service';
import { UploadStatusService } from './upload-status.service';
const AdmZip = require('adm-zip');

@Controller('files')
export class FilesController {
  private readonly path: string;

  constructor(
    private readonly filesService: FilesService,
    private readonly minioService: MinioService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly uploadStatusService: UploadStatusService,
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
    const jobId = this.uploadStatusService.createJob();

    if (!file) {
      this.uploadStatusService.fail(jobId, 'Please upload a file');
      throw new BadRequestException('Please upload a file');
    }

    // start async processing
    setImmediate(() => {
      this.handleUpload(jobId, createFileDto, file, activeUser);
    });

    return apiResponseHandler('Upload initiated', HttpStatus.ACCEPTED, {
      jobId,
    });
  }

  @Get('upload/status/:jobId')
  async getUploadStatus(@Param('jobId') jobId: string) {
    const status = this.uploadStatusService.getStatus(jobId);
    if (!status) throw new NotFoundException('Upload job not found');
    return apiResponseHandler('Upload status fetched', HttpStatus.OK, status);
  }

  private async handleUpload(
    jobId: string,
    createFileDto: CreateFileDto,
    file: Express.Multer.File,
    activeUser: ActiveUserData,
  ) {
    try {
      this.uploadStatusService.updateProgress(jobId, 10);
      await this.minioService.createBucketIfNotExists();

      this.uploadStatusService.updateProgress(jobId, 30);
      const zip = new AdmZip();
      const stringArray = file.originalname.split('.');
      const format = stringArray[stringArray.length - 1];
      const fileName = `${createFileDto.filename}.${format}`;
      zip.addFile(fileName, file.buffer);
      const zipBuffer = zip.toBuffer();
      const zipName = `${createFileDto.filename}.zip`;

      this.uploadStatusService.updateProgress(jobId, 60);
      const ref = await this.minioService.uploadBuffer(
        zipBuffer,
        this.path + zipName,
      );

      this.uploadStatusService.updateProgress(jobId, 80);
      const newFile = await this.filesService.create(
        {
          filename: fileName,
          category: createFileDto.category,
          ref,
          size: file.size,
          compressedSize: zipBuffer.length,
        },
        activeUser,
      );

      this.uploadStatusService.complete(jobId, newFile);
    } catch (error) {
      this.uploadStatusService.fail(jobId, error.message);
    }
  }

  @Auth(AuthType.None)
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
  ) {
    return this.filesService.findAll(
      {
        populate: ['category'],
        ...(category && { category }),
      },
      { page, limit },
    );
  }

  @Auth(AuthType.None)
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

  @Get('update/status/:jobId')
  async getUpdateStatus(@Param('jobId') jobId: string) {
    const status = this.uploadStatusService.getStatus(jobId);
    if (!status) throw new NotFoundException('Update job not found');
    return apiResponseHandler('Update status fetched', HttpStatus.OK, status);
  }

  @UseInterceptors(FileInterceptor('file'))
  @Patch(':id')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateFileDto: UpdateFileDto,
    @UploadedFile() file: Express.Multer.File,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    if (file) {
      const jobId = this.uploadStatusService.createJob();
      setImmediate(() =>
        this.handleFileReplace({ jobId, id, updateFileDto, file, activeUser }),
      );
      return apiResponseHandler('Update initiated', HttpStatus.ACCEPTED, {
        jobId,
      });
    } else if (updateFileDto.filename) {
      const jobId = this.uploadStatusService.createJob();
      setImmediate(() =>
        this.handleFilenameReplace({ jobId, id, updateFileDto, activeUser }),
      );
      return apiResponseHandler('Update initiated', HttpStatus.ACCEPTED, {
        jobId,
      });
    } else {
      const updatedFile = await this.filesService.update(
        id,
        {
          ...updateFileDto,
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
  }

  private async handleFileReplace({
    jobId,
    id,
    updateFileDto,
    file,
    activeUser,
  }: {
    jobId: string;
    id: string;
    updateFileDto: UpdateFileDto;
    file: Express.Multer.File;
    activeUser: ActiveUserData;
  }) {
    try {
      this.uploadStatusService.updateProgress(jobId, 10);
      const foundFile = await this.filesService.findById(id);
      await this.minioService.deleteFile(foundFile.ref);

      this.uploadStatusService.updateProgress(jobId, 30);
      const zip = new AdmZip();
      const ext = file.originalname.split('.').pop();
      const filename = `${updateFileDto.filename}.${ext}`;
      zip.addFile(filename, file.buffer);
      const buffer = zip.toBuffer();
      const zipName = `${updateFileDto.filename}.zip`;

      this.uploadStatusService.updateProgress(jobId, 60);
      const ref = await this.minioService.uploadBuffer(
        buffer,
        this.path + zipName,
      );

      this.uploadStatusService.updateProgress(jobId, 80);
      const updated = await this.filesService.update(
        id,
        {
          filename,
          ref,
          size: file.size,
          compressedSize: buffer.length,
          category: updateFileDto.category || foundFile.category._id,
        },
        { new: true },
        activeUser,
      );

      this.uploadStatusService.complete(jobId, updated);
    } catch (err) {
      this.uploadStatusService.fail(jobId, err.message);
    }
  }

  private async handleFilenameReplace({
    jobId,
    id,
    updateFileDto,
    activeUser,
  }: {
    jobId: string;
    id: string;
    updateFileDto: UpdateFileDto;
    activeUser: ActiveUserData;
  }) {
    try {
      this.uploadStatusService.updateProgress(jobId, 10);
      const foundFile = await this.filesService.findOne({
        _id: id,
        populate: ['category'],
      });

      const stringArray = foundFile.filename.split('.');
      const format = stringArray[stringArray.length - 1];
      const fileName = `${updateFileDto.filename}.${format}`;

      this.uploadStatusService.updateProgress(jobId, 30);
      const oldRef = foundFile.ref;
      const oldBuffer = await this.minioService.getFileBuffer(oldRef);
      const zip = new AdmZip(oldBuffer);
      const entries = zip.getEntries();

      if (!entries.length) {
        throw new BadRequestException('ZIP archive is empty');
      }

      const oldEntryName = entries[0].entryName;
      const content = zip.readFile(entries[0]);
      zip.deleteFile(oldEntryName);
      zip.addFile(fileName, content);
      const newZipBuffer = zip.toBuffer();
      const newZipName = `${updateFileDto.filename}.zip`;

      this.uploadStatusService.updateProgress(jobId, 60);
      const newRef = await this.minioService.uploadBuffer(
        newZipBuffer,
        this.path + newZipName,
      );
      await this.minioService.deleteFile(oldRef);

      this.uploadStatusService.updateProgress(jobId, 80);
      const updatedFile = await this.filesService.update(
        id,
        {
          filename: fileName,
          category: updateFileDto.category || foundFile.category.id,
          ref: newRef,
          compressedSize: newZipBuffer.length,
        },
        { new: true },
        activeUser,
      );

      this.uploadStatusService.complete(jobId, updatedFile);
    } catch (err) {
      this.uploadStatusService.fail(jobId, err.message);
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    const file = await this.filesService.findById(id);

    await this.minioService.deleteFile(file.ref);

    await this.filesService.remove(id);

    return apiResponseHandler('File deleted successfully', HttpStatus.OK);
  }
}
