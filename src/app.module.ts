import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import googleConfig from './auth-google/config/google.config';
import { GoogleAuthModule } from './auth-google/google-auth.module';
import { AuthModule } from './auth/auth.module';
import authConfig from './auth/config/auth.config';
import cryptoConfig from './common/encrypting/config/crypto.config';
import { TypedEventEmitterModule } from './common/types/typed-event-emitter/typed-event-emitter.module';
import appConfig from './config/app.config';
import databaseConfig from './database/config/database.config';
import { DatabaseModule } from './database/database.module';
import eMailerConfig from './e-mailer/config/e-mailer.config';
import { EMailerModule } from './e-mailer/e-mailer.module';
import { FileCategoriesModule } from './file-categories/file-categories.module';
import filesConfig from './files/config/files.config';
import { FilesModule } from './files/files.module';
import minioConfig from './minio/config/minio.config';
import { QueueModule } from './queue/queue.module';
import redisConfig from './redis/config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        authConfig,
        appConfig,
        googleConfig,
        databaseConfig,
        eMailerConfig,
        redisConfig,
        cryptoConfig,
        minioConfig,
        filesConfig,
      ],
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    QueueModule,
    DatabaseModule,
    AuthModule,
    TypedEventEmitterModule,
    FileCategoriesModule,
    FilesModule,
    ...(process.env.EMAIL_USER ? [EMailerModule] : []),
    ...(process.env.GOOGLE_CLIENT_ID ? [GoogleAuthModule] : []),
  ],
})
export class AppModule {}
