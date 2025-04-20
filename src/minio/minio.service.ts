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
    const bucketExists = await this.minioClient.bucketExists(this.bucketName);
    if (!bucketExists) {
      await this.minioClient.makeBucket(this.bucketName, 'eu-west-1');
    }
  }

  async uploadFile(file: Express.Multer.File, filename: string) {
    const stringArray = file.originalname.split('.');
    const format = stringArray[stringArray.length - 1];

    const fileName = `${filename}.${format}`;
    await this.minioClient.putObject(
      this.bucketName,
      fileName,
      file.buffer,
      file.size,
    );
    return fileName;
  }

  async uploadBuffer(buffer: Buffer, filename: string) {
    await this.minioClient.putObject(
      this.bucketName,
      filename,
      buffer,
      buffer.length,
    );
    return filename;
  }

  async getFileUrl(fileName: string) {
    return await this.minioClient.presignedUrl(
      'GET',
      this.bucketName,
      fileName,
    );
  }

  async getFileBuffer(fileName: string): Promise<Buffer> {
    const stream = await this.minioClient.getObject(this.bucketName, fileName);
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async updateFileName(
    oldFileName: string,
    newFileName: string,
    format: string,
  ) {
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
  }

  async deleteFile(fileName: string) {
    await this.minioClient.removeObject(this.bucketName, fileName);
  }
}
