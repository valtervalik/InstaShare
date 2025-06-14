import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { FilesQueueKeys } from '../constants/files-queue-keys.enum';
import { FileStatusEnum } from '../enums/file-status.enum';
import { FilesService } from '../files.service';

@Injectable()
export class FilesCompressionCron {
  private readonly logger = new Logger(FilesCompressionCron.name);

  constructor(
    @InjectQueue(FilesQueueKeys.COMPRESSION)
    private readonly filesCompressionQueue: Queue,
    private readonly filesService: FilesService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleFileCompression() {
    this.logger.debug('Starting file compression processing');

    const filesToCompress = await this.filesService.findAllWithoutPagination({
      status: FileStatusEnum.RAW,
    });

    if (!filesToCompress.total) {
      this.logger.debug('No files to compress');
      return;
    }

    await this.filesCompressionQueue.add(FilesQueueKeys.COMPRESSION, {
      files: filesToCompress.elements,
    });
  }
}
