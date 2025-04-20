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
import { fileFilter } from './utils/fileFilter';
const AdmZip = require('adm-zip');

@Controller('files')
export class FilesController {
  private readonly path: string;

  constructor(
    private readonly filesService: FilesService,
    private readonly minioService: MinioService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {
    this.path = this.configService.get('files.path', { infer: true });
  }

  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter,
    }),
  )
  @Post('upload')
  async upload(
    @Body() createFileDto: CreateFileDto,
    @UploadedFile() file: Express.Multer.File,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    if (!file) {
      throw new BadRequestException('Please upload a file');
    }

    await this.minioService.createBucketIfNotExists();

    // compress incoming file to zip using its original name as entry
    const zip = new AdmZip();
    const stringArray = file.originalname.split('.');
    const format = stringArray[stringArray.length - 1];
    const fileName = `${createFileDto.filename}.${format}`;

    zip.addFile(fileName, file.buffer);
    const zipBuffer = zip.toBuffer();
    const zipName = `${createFileDto.filename}.zip`;

    const ref = await this.minioService.uploadBuffer(
      zipBuffer,
      this.path + zipName,
    );

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

    return apiResponseHandler(
      `File uploaded successfully`,
      HttpStatus.CREATED,
      newFile,
    );
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

  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter,
    }),
  )
  @Patch(':id')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateFileDto: UpdateFileDto,
    @UploadedFile() file: Express.Multer.File,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    const foundFile = await this.filesService.findOne({
      _id: id,
      populate: ['category'],
    });

    if (foundFile.filename === updateFileDto.filename) {
      delete updateFileDto.filename;
    }

    if (file) {
      await this.minioService.deleteFile(foundFile.ref);

      if (!updateFileDto.filename) {
        throw new BadRequestException('Please provide a filename');
      }

      // compress updated file to zip
      const zip = new AdmZip();
      const stringArray = file.originalname.split('.');
      const format = stringArray[stringArray.length - 1];
      const fileName = `${updateFileDto.filename}.${format}`;

      zip.addFile(fileName, file.buffer);
      const zipBuffer = zip.toBuffer();
      const zipName = `${updateFileDto.filename}.zip`;

      const ref = await this.minioService.uploadBuffer(
        zipBuffer,
        this.path + zipName,
      );

      const updatedFile = await this.filesService.update(
        id,
        {
          filename: fileName,
          category: updateFileDto.category || foundFile.category.id,
          ref,
          size: file.size,
          compressedSize: zipBuffer.length,
        },
        { new: true },
        activeUser,
      );

      return apiResponseHandler(
        'File updated successfully',
        HttpStatus.OK,
        updatedFile,
      );
    } else {
      const stringArray = foundFile.filename.split('.');
      const format = stringArray[stringArray.length - 1];

      if (updateFileDto.filename) {
        const fileName = `${updateFileDto.filename}.${format}`;
        // rename ZIP entry and archive name
        const oldRef = foundFile.ref;
        const oldBuffer = await this.minioService.getFileBuffer(oldRef);
        const AdmZip = require('adm-zip');
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
        // upload renamed zip and remove old
        const newRef = await this.minioService.uploadBuffer(
          newZipBuffer,
          this.path + newZipName,
        );
        await this.minioService.deleteFile(oldRef);
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

        return apiResponseHandler(
          'File updated successfully',
          HttpStatus.OK,
          updatedFile,
        );
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
  }

  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    const file = await this.filesService.findById(id);

    await this.minioService.deleteFile(file.ref);

    await this.filesService.remove(id);

    return apiResponseHandler('File deleted successfully', HttpStatus.OK);
  }
}
