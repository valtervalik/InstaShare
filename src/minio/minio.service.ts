import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, CopyConditions } from 'minio';
import { InjectMinio } from 'nestjs-minio';
import { AllConfigType } from 'src/config/config.type';

@Injectable()
export class MinioService {
  private bucketName: string;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    @InjectMinio() private readonly minioClient: Client,
  ) {
    this.bucketName = this.configService.get('minio.bucket', { infer: true });
  }

  async createBucketIfNotExists() {
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.bucketName, 'eu-west-1');
      }
    } catch (error) {
      throw new Error(`Failed to create or access bucket: ${error}`);
    }
  }

  async uploadFile(file: Express.Multer.File, filename: string) {
    const stringArray = file.originalname.split('.');
    const format = stringArray[stringArray.length - 1];

    const fileName = `${filename}.${format}`;
    try {
      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        file.buffer,
        file.size,
      );
      return fileName;
    } catch (error) {
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  async uploadBuffer(buffer: Buffer, filename: string) {
    try {
      await this.minioClient.putObject(
        this.bucketName,
        filename,
        buffer,
        buffer.length,
      );
      return filename;
    } catch (error) {
      throw new Error(`Failed to upload buffer: ${error}`);
    }
  }

  async getFileUrl(fileName: string) {
    try {
      return await this.minioClient.presignedUrl(
        'GET',
        this.bucketName,
        fileName,
      );
    } catch (error) {
      throw new Error(`Failed to get file URL: ${error}`);
    }
  }

  async getFileBuffer(fileName: string): Promise<Buffer> {
    try {
      const stream = await this.minioClient.getObject(
        this.bucketName,
        fileName,
      );
      const chunks: Buffer[] = [];
      return new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to get file buffer: ${error}`);
    }
  }

  async updateFileName(
    oldFileName: string,
    newFileName: string,
    format: string,
  ) {
    try {
      await this.minioClient.copyObject(
        this.bucketName,
        `${newFileName}.${format}`,
        `/${this.bucketName}/${oldFileName}`,
        new CopyConditions(),
      );

      await this.deleteFile(oldFileName);

      return {
        filename: `${newFileName}.${format}`,
        url: await this.getFileUrl(`${newFileName}.${format}`),
      };
    } catch (error) {
      throw new Error(`Failed to update file name: ${error}`);
    }
  }

  async deleteFile(fileName: string) {
    try {
      await this.minioClient.removeObject(this.bucketName, fileName);
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }
}
