import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: any;
}

@Injectable()
export class UploadStatusService {
  private readonly statuses = new Map<string, JobStatus>();

  createJob(): string {
    const jobId = randomUUID();
    this.statuses.set(jobId, { status: 'pending', progress: 0 });
    return jobId;
  }

  updateProgress(jobId: string, progress: number) {
    const status = this.statuses.get(jobId);
    if (!status) throw new NotFoundException('Upload job not found');
    status.status = 'processing';
    status.progress = progress;
  }

  complete(jobId: string, result: any) {
    this.statuses.set(jobId, { status: 'completed', progress: 100, result });
  }

  fail(jobId: string, error: string) {
    this.statuses.set(jobId, { status: 'failed', result: error });
  }

  getStatus(jobId: string): JobStatus | undefined {
    return this.statuses.get(jobId);
  }
}
