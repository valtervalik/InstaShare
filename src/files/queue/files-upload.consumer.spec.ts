import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface';
import { TypedEventEmitter } from 'src/common/types/typed-event-emitter/typed-event-emitter.class';
import { MinioService } from 'src/minio/minio.service';
import { CreateFileDto } from '../dto/create-file.dto';
import { FilesService } from '../files.service';
import { FilesUploadProcessor } from './files-upload.consumer';

describe('FilesUploadProcessor', () => {
  let processor: FilesUploadProcessor;
  let filesService: jest.Mocked<FilesService>;
  let minioService: jest.Mocked<MinioService>;
  let configService: jest.Mocked<ConfigService>;
  let eventEmitter: jest.Mocked<TypedEventEmitter>;

  const mockPath = 'test-files/';
  const mockRef = 'test-ref-123';
  const mockCategoryId = new Types.ObjectId();
  const mockUserId = 'user-123';

  const mockActiveUser: ActiveUserData = {
    sub: mockUserId,
    email: 'test@example.com',
    role: {
      _id: '1',
      name: 'user',
      deleted: false,
    } as any,
    permission: {
      _id: '1',
      create_user: false,
      update_user: false,
      delete_user: false,
      deleted: false,
    } as any,
  };

  const mockCreateFileDto: CreateFileDto = {
    filename: 'test-document',
    category: mockCategoryId.toString(),
  };

  const mockFile: Express.Multer.File & { buffer: string } = {
    fieldname: 'file',
    originalname: 'test-document.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test file content').toString('base64') as any,
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  const mockJobData = {
    body: mockCreateFileDto,
    file: mockFile,
    activeUser: mockActiveUser,
  };

  beforeEach(async () => {
    const mockFilesService = {
      create: jest.fn(),
    };

    const mockMinioService = {
      createBucketIfNotExists: jest.fn(),
      uploadFile: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(mockPath),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesUploadProcessor,
        { provide: FilesService, useValue: mockFilesService },
        { provide: MinioService, useValue: mockMinioService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TypedEventEmitter, useValue: mockEventEmitter },
      ],
    }).compile();

    processor = module.get<FilesUploadProcessor>(FilesUploadProcessor);
    filesService = module.get(FilesService);
    minioService = module.get(MinioService);
    configService = module.get(ConfigService);
    eventEmitter = module.get(TypedEventEmitter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(processor).toBeDefined();
    });

    it('should set path from config service', () => {
      expect(configService.get).toHaveBeenCalledWith('files.path', {
        infer: true,
      });
    });
  });

  describe('process', () => {
    const mockJob: Partial<Job<typeof mockJobData>> = {
      data: mockJobData,
    };

    beforeEach(() => {
      minioService.createBucketIfNotExists.mockResolvedValue(undefined);
      minioService.uploadFile.mockResolvedValue(mockRef);
      filesService.create.mockResolvedValue({} as any);
      eventEmitter.emit.mockResolvedValue([]);
    });

    it('should process upload job successfully', async () => {
      await processor.process(mockJob as Job<typeof mockJobData>);

      expect(minioService.createBucketIfNotExists).toHaveBeenCalledTimes(1);
      expect(minioService.uploadFile).toHaveBeenCalledTimes(1);
      expect(filesService.create).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    });

    it('should convert base64 buffer back to Buffer', async () => {
      await processor.process(mockJob as Job<typeof mockJobData>);

      const uploadCall = minioService.uploadFile.mock.calls[0];
      const fileWithBuffer = uploadCall[0];

      expect(fileWithBuffer.buffer).toBeInstanceOf(Buffer);
      expect(fileWithBuffer.buffer.toString()).toBe('test file content');
    });

    it('should ensure bucket exists before uploading', async () => {
      await processor.process(mockJob as Job<typeof mockJobData>);

      expect(minioService.createBucketIfNotExists).toHaveBeenCalled();
      expect(minioService.uploadFile).toHaveBeenCalled();
    });

    it('should upload file with correct path and filename', async () => {
      await processor.process(mockJob as Job<typeof mockJobData>);

      expect(minioService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          originalname: mockFile.originalname,
          buffer: expect.any(Buffer),
        }),
        `${mockPath}${mockCreateFileDto.filename}`,
      );
    });

    it('should create file record with correct data', async () => {
      await processor.process(mockJob as Job<typeof mockJobData>);

      expect(filesService.create).toHaveBeenCalledWith(
        {
          filename: 'test-document.pdf',
          category: mockCreateFileDto.category,
          ref: mockRef,
          size: mockFile.size,
        },
        mockActiveUser,
      );
    });

    it('should emit upload success event', async () => {
      await processor.process(mockJob as Job<typeof mockJobData>);

      expect(eventEmitter.emit).toHaveBeenCalledWith('files.uploaded', {
        message: 'File uploaded successfully: test-document.pdf',
        clientId: mockActiveUser.sub,
      });
    });

    it('should handle files with different extensions correctly', async () => {
      const fileWithMultipleDots: Express.Multer.File & { buffer: string } = {
        ...mockFile,
        originalname: 'test.backup.file.tar.gz',
      };

      const jobWithMultipleDots: Partial<Job<typeof mockJobData>> = {
        data: {
          ...mockJobData,
          file: fileWithMultipleDots,
        },
      };

      await processor.process(jobWithMultipleDots as Job<typeof mockJobData>);

      expect(filesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'test-document.gz',
        }),
        mockActiveUser,
      );
    });

    it('should handle files without extensions', async () => {
      const fileWithoutExtension: Express.Multer.File & { buffer: string } = {
        ...mockFile,
        originalname: 'testfile',
      };

      const jobWithoutExt: Partial<Job<typeof mockJobData>> = {
        data: {
          ...mockJobData,
          file: fileWithoutExtension,
        },
      };

      await processor.process(jobWithoutExt as Job<typeof mockJobData>);

      expect(filesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'test-document.testfile',
        }),
        mockActiveUser,
      );
    });

    it('should handle error when bucket creation fails', async () => {
      const error = new Error('Failed to create bucket');
      minioService.createBucketIfNotExists.mockRejectedValueOnce(error);

      await expect(
        processor.process(mockJob as Job<typeof mockJobData>),
      ).rejects.toThrow('Failed to create bucket');
    });

    it('should handle error when file upload fails', async () => {
      const error = new Error('Failed to upload file');
      minioService.uploadFile.mockRejectedValueOnce(error);

      await expect(
        processor.process(mockJob as Job<typeof mockJobData>),
      ).rejects.toThrow('Failed to upload file');
    });

    it('should handle error when file creation fails', async () => {
      const error = new Error('Failed to create file record');
      filesService.create.mockRejectedValueOnce(error);

      await expect(
        processor.process(mockJob as Job<typeof mockJobData>),
      ).rejects.toThrow('Failed to create file record');
    });

    it('should handle token parameter', async () => {
      const token = 'test-token';
      await processor.process(mockJob as Job<typeof mockJobData>, token);

      // Should still process normally regardless of token
      expect(minioService.uploadFile).toHaveBeenCalledTimes(1);
    });
  });
});
