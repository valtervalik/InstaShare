import { GoogleConfig } from 'src/auth-google/config/google-config.type';
import { CryptoConfig } from 'src/common/encrypting/config/crypto-config.type';
import { DatabaseConfig } from 'src/database/config/database-config.type';
import { EMailerConfig } from 'src/e-mailer/config/e-mailer-config.type';
import { FilesConfig } from 'src/files/config/files-config.type';
import { MinioConfig } from 'src/minio/config/minio-config.type';
import { RedisConfig } from 'src/redis/config/redis-config.type';
import { AuthConfig } from '../auth/config/auth-config.type';
import { AppConfig } from './app-config.type';

export type AllConfigType = {
  app: AppConfig;
  auth: AuthConfig;
  google: GoogleConfig;
  database: DatabaseConfig;
  emailer: EMailerConfig;
  redis: RedisConfig;
  crypto: CryptoConfig;
  minio: MinioConfig;
  files: FilesConfig;
};
