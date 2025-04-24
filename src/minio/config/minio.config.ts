import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import validateConfig from 'src/utils/validate-config';
import { MinioConfig } from './minio-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  MINIO_ENDPOINT: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  MINIO_API_PORT: number;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  MINIO_WEBUI_PORT: number;

  @IsString()
  MINIO_ACCESS_KEY: string;

  @IsString()
  MINIO_SECRET_KEY: string;

  @IsString()
  MINIO_USE_SSL: string;

  @IsString()
  MINIO_BUCKET_NAME: string;
}

export default registerAs<MinioConfig>('minio', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    endpoint: process.env.MINIO_ENDPOINT,
    api_port: process.env.MINIO_API_PORT
      ? parseInt(process.env.MINIO_API_PORT, 10)
      : 9000,
    webui_port: process.env.MINIO_WEBUI_PORT
      ? parseInt(process.env.MINIO_WEBUI_PORT, 10)
      : 9001,
    ssl: process.env.MINIO_USE_SSL,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secret: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET_NAME,
  };
});
