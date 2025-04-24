import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestMinioModule } from 'nestjs-minio';
import { AllConfigType } from 'src/config/config.type';
import { MinioService } from './minio.service';

@Module({
  imports: [
    NestMinioModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        endPoint: configService.get('minio.endpoint', { infer: true }),
        port: configService.get('minio.api_port', { infer: true }),
        useSSL: configService.get('minio.ssl', { infer: true }) === 'true',
        accessKey: configService.get('minio.accessKey', { infer: true }),
        secretKey: configService.get('minio.secret', { infer: true }),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MinioService],
  exports: [MinioService],
})
export class MinioModule {}
