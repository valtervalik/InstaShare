import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/config/config.type';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService<AllConfigType>) => ({
        connection: {
          host: configService.getOrThrow('redis.host', { infer: true }),
          port: configService.getOrThrow('redis.port', { infer: true }),
          password: configService.getOrThrow('redis.password', { infer: true }),
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: true,
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class QueueModule {}
