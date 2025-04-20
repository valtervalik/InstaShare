import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AllConfigType } from 'src/config/config.type';
import { MinioService } from 'src/minio/minio.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { UploadStatusService } from './upload-status.service';

describe('FilesController', () => {
  let controller: FilesController;
  let filesService: any;
  let minioService: any;
  let httpService: any;
  let configService: any;
  let uploadStatusService: any;

  beforeEach(async () => {
    const mockFilesService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;
    const mockMinioService = {
      createBucketIfNotExists: jest.fn(),
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getFileUrl: jest.fn(),
      updateFileName: jest.fn(),
      uploadBuffer: jest.fn().mockResolvedValue('refPath'),
    } as any;
    const mockHttpService = { get: jest.fn() } as any;
    const mockConfigService = {
      get: jest.fn().mockReturnValue('basePath/'),
    } as any;
    const mockUploadStatusService = {
      createJob: jest.fn().mockReturnValue('job-1'),
      getStatus: jest.fn().mockReturnValue({ status: 'pending', progress: 0 }),
      updateProgress: jest.fn(),
      complete: jest.fn(),
      fail: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: FilesService, useValue: mockFilesService },
        { provide: MinioService, useValue: mockMinioService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService<AllConfigType>, useValue: mockConfigService },
        { provide: UploadStatusService, useValue: mockUploadStatusService },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    filesService = module.get(FilesService) as any;
    minioService = module.get(MinioService) as any;
    httpService = module.get(HttpService) as any;
    configService = module.get(ConfigService) as any;
    uploadStatusService = module.get(UploadStatusService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    it('should throw BadRequestException if no file', async () => {
      const dto = { filename: 'f', category: '1' };
      await expect(
        controller.upload(dto as any, undefined as any, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should initiate upload job when file provided', async () => {
      const dto = { filename: 'f', category: 1 } as any;
      const file = {
        originalname: 'test.txt',
        buffer: Buffer.from(''),
        size: 10,
      } as any;
      const activeUser = {} as any;
      const res = await controller.upload(dto, file, activeUser);
      expect(uploadStatusService.createJob).toHaveBeenCalled();
      expect(res).toEqual({
        message: 'Upload initiated',
        statusCode: HttpStatus.ACCEPTED,
        data: { jobId: 'job-1' },
      });
    });
  });

  describe('findAllByCategory', () => {
    it('should call findAll with query params', async () => {
      filesService.findAll.mockReturnValue({
        elements: [],
        pagination: {},
      } as any);
      const res = await controller.findAllByCategory({
        page: 2,
        limit: 5,
        category: 3,
      } as any);
      expect(filesService.findAll).toHaveBeenCalledWith(
        { populate: ['category'], category: 3 },
        { page: 2, limit: 5 },
      );
    });
  });

  describe('remove', () => {
    it('should delete file and record', async () => {
      const fileRec = { ref: 'r' };
      filesService.findById.mockResolvedValue(fileRec as any);
      await expect(controller.remove('1')).resolves.toEqual({
        message: 'File deleted successfully',
        statusCode: HttpStatus.OK,
      });
      expect(minioService.deleteFile).toHaveBeenCalledWith('r');
      expect(filesService.remove).toHaveBeenCalledWith('1');
    });
    it('should propagate error when remove throws', async () => {
      filesService.findById.mockRejectedValue(new Error('fail'));
      await expect(controller.remove('1')).rejects.toThrow('fail');
    });
  });

  describe('update', () => {
    it('should initiate async replace when file provided', async () => {
      const file = { originalname: 'a.txt' } as any;
      const dto = { filename: 'new' } as any;
      const user = {} as any;
      const res = await controller.update('id', dto, file, user);
      expect(uploadStatusService.createJob).toHaveBeenCalled();
      expect(res.data).toEqual({ jobId: 'job-1' });
      expect(res.statusCode).toBe(HttpStatus.ACCEPTED);
    });

    it('should initiate async rename when only filename provided', async () => {
      const dto = { filename: 'renamed' } as any;
      const res = await controller.update(
        'id',
        dto,
        undefined as any,
        {} as any,
      );
      expect(uploadStatusService.createJob).toHaveBeenCalled();
      expect(res.data).toEqual({ jobId: 'job-1' });
      expect(res.statusCode).toBe(HttpStatus.ACCEPTED);
    });
  });

  describe('getUpdateStatus', () => {
    it('should return job status', async () => {
      uploadStatusService.getStatus.mockReturnValue({
        status: 'completed',
        progress: 100,
        result: { foo: 'bar' },
      });
      const res = await controller.getUpdateStatus('job-1');
      expect(uploadStatusService.getStatus).toHaveBeenCalledWith('job-1');
      expect(res.data).toEqual({
        status: 'completed',
        progress: 100,
        result: { foo: 'bar' },
      });
      expect(res.statusCode).toBe(HttpStatus.OK);
    });

    it('should throw NotFoundException for unknown job', async () => {
      uploadStatusService.getStatus.mockReturnValue(undefined);
      await expect(controller.getUpdateStatus('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUploadStatus', () => {
    it('should return job status for upload', async () => {
      uploadStatusService.getStatus.mockReturnValue({
        status: 'processing',
        progress: 50,
      });
      const res = await controller.getUploadStatus('job-1');
      expect(uploadStatusService.getStatus).toHaveBeenCalledWith('job-1');
      expect(res.data).toEqual({ status: 'processing', progress: 50 });
      expect(res.statusCode).toBe(HttpStatus.OK);
    });

    it('should throw NotFoundException if upload job not found', async () => {
      uploadStatusService.getStatus.mockReturnValue(undefined);
      await expect(controller.getUploadStatus('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
