import { HttpService } from '@nestjs/axios';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AllConfigType } from 'src/config/config.type';
import { MinioService } from 'src/minio/minio.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

describe('FilesController', () => {
  let controller: FilesController;
  let filesService: any;
  let minioService: any;
  let httpService: any;
  let configService: any;

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
    } as any;
    const mockHttpService = { get: jest.fn() } as any;
    const mockConfigService = {
      get: jest.fn().mockReturnValue('basePath/'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: FilesService, useValue: mockFilesService },
        { provide: MinioService, useValue: mockMinioService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService<AllConfigType>, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    filesService = module.get(FilesService) as any;
    minioService = module.get(MinioService) as any;
    httpService = module.get(HttpService) as any;
    configService = module.get(ConfigService) as any;
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

    it('should upload file and create record', async () => {
      const dto = { filename: 'f', category: 1 } as any;
      const file = {
        originalname: 'test.txt',
        buffer: Buffer.from(''),
        size: 10,
      } as any;
      const activeUser = {
        sub: 'u',
        email: 'e',
        role: {} as any,
        permission: {} as any,
      };
      minioService.uploadFile.mockResolvedValue('refPath');
      filesService.create.mockResolvedValue({ id: '1' } as any);

      const result = await controller.upload(dto, file, activeUser);
      expect(minioService.createBucketIfNotExists).toHaveBeenCalled();
      expect(minioService.uploadFile).toHaveBeenCalledWith(file, 'basePath/f');
      expect(filesService.create).toHaveBeenCalledWith(
        { filename: 'f', category: 1, ref: 'refPath' },
        activeUser,
      );
      expect(result).toEqual({
        message: 'File uploaded successfully',
        statusCode: HttpStatus.CREATED,
        data: { id: '1' },
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
});
