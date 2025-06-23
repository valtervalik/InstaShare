import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { TypedEventEmitter } from 'src/common/types/typed-event-emitter/typed-event-emitter.class';
import { MinioService } from 'src/minio/minio.service';
import { FileStatusEnum } from '../enums/file-status.enum';
import { FilesService } from '../files.service';
import { File } from '../schemas/file.schema';
import { FilesCompressionProcessor } from './files-compression.consumer';

// Mock AdmZip at the module level
const mockAddFile = jest.fn();
const mockToBuffer = jest.fn();

jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    addFile: mockAddFile,
    toBuffer: mockToBuffer,
  }));
});

describe('FilesCompressionProcessor', () => {
  let processor: FilesCompressionProcessor;
  let minioService: jest.Mocked<MinioService>;
  let filesService: jest.Mocked<FilesService>;
  let configService: jest.Mocked<ConfigService>;
  let eventEmitter: jest.Mocked<TypedEventEmitter>;

  const mockFileBuffer = Buffer.from('test file content');
  const mockZipBuffer = Buffer.from('compressed content');
  const mockPath = 'test-files/';
  const mockRef = 'test-ref-123';
  const mockNewRef = 'test-ref-456';

  beforeEach(async () => {
    const mockMinioService = {
      getFileBuffer: jest.fn(),
      uploadBuffer: jest.fn(),
      deleteFile: jest.fn(),
    };

    const mockFilesService = {
      update: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(mockPath),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesCompressionProcessor,
        { provide: MinioService, useValue: mockMinioService },
        { provide: FilesService, useValue: mockFilesService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TypedEventEmitter, useValue: mockEventEmitter },
      ],
    }).compile();

    processor = module.get<FilesCompressionProcessor>(
      FilesCompressionProcessor,
    );
    minioService = module.get(MinioService);
    filesService = module.get(FilesService);
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
    const mockUserId1 = new Types.ObjectId();
    const mockUserId2 = new Types.ObjectId();
    const mockFileId1 = new Types.ObjectId();
    const mockFileId2 = new Types.ObjectId();

    const mockFile1: Partial<File> = {
      _id: mockFileId1,
      filename: 'test-file-1.txt',
      ref: 'old-ref-1',
      createdBy: mockUserId1 as any,
    };

    const mockFile2: Partial<File> = {
      _id: mockFileId2,
      filename: 'test-file-2.pdf',
      ref: 'old-ref-2',
      createdBy: mockUserId2 as any,
    };

    const mockJob: Partial<Job<{ files: File[] }>> = {
      data: {
        files: [mockFile1 as File, mockFile2 as File],
      },
    };

    beforeEach(() => {
      minioService.getFileBuffer.mockResolvedValue(mockFileBuffer);
      minioService.uploadBuffer.mockResolvedValue(mockNewRef);
      minioService.deleteFile.mockResolvedValue(undefined);
      filesService.update.mockResolvedValue({} as any);

      // Setup AdmZip mocks
      mockToBuffer.mockReturnValue(mockZipBuffer);
      mockAddFile.mockClear();
      mockToBuffer.mockClear();
    });

    it('should process compression job successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await processor.process(mockJob as Job<{ files: File[] }>);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing file compression job:',
        mockJob.data,
      );

      consoleSpy.mockRestore();
    });

    it('should get file buffers for all files', async () => {
      await processor.process(mockJob as Job<{ files: File[] }>);

      expect(minioService.getFileBuffer).toHaveBeenCalledTimes(2);
      expect(minioService.getFileBuffer).toHaveBeenCalledWith('old-ref-1');
      expect(minioService.getFileBuffer).toHaveBeenCalledWith('old-ref-2');
    });

    it('should create zip files with correct file contents', async () => {
      await processor.process(mockJob as Job<{ files: File[] }>);

      expect(mockAddFile).toHaveBeenCalledTimes(2);
      expect(mockAddFile).toHaveBeenCalledWith(
        'test-file-1.txt',
        mockFileBuffer,
      );
      expect(mockAddFile).toHaveBeenCalledWith(
        'test-file-2.pdf',
        mockFileBuffer,
      );
    });

    it('should upload compressed files with correct paths', async () => {
      await processor.process(mockJob as Job<{ files: File[] }>);

      expect(minioService.uploadBuffer).toHaveBeenCalledTimes(2);
      expect(minioService.uploadBuffer).toHaveBeenCalledWith(
        mockZipBuffer,
        `${mockPath}test-file-1.zip`,
      );
      expect(minioService.uploadBuffer).toHaveBeenCalledWith(
        mockZipBuffer,
        `${mockPath}test-file-2.zip`,
      );
    });

    it('should update file records with compressed status and new ref', async () => {
      await processor.process(mockJob as Job<{ files: File[] }>);

      expect(filesService.update).toHaveBeenCalledTimes(2);

      // Get the actual calls to verify correct parameters
      const updateCalls = filesService.update.mock.calls;

      // Check that the update was called with the correct structure
      // We verify that it receives the file ID (as ObjectId), update object, and options
      expect(updateCalls[0][0]).toEqual(mockFile1._id);
      expect(updateCalls[0][1]).toEqual({
        ref: mockNewRef,
        status: FileStatusEnum.COMPRESSED,
        compressedSize: mockZipBuffer.length,
      });
      expect(updateCalls[0][2]).toEqual({ new: true });

      expect(updateCalls[1][0]).toEqual(mockFile2._id);
      expect(updateCalls[1][1]).toEqual({
        ref: mockNewRef,
        status: FileStatusEnum.COMPRESSED,
        compressedSize: mockZipBuffer.length,
      });
      expect(updateCalls[1][2]).toEqual({ new: true });
    });

    it('should delete original files after compression', async () => {
      await processor.process(mockJob as Job<{ files: File[] }>);

      expect(minioService.deleteFile).toHaveBeenCalledTimes(2);
      expect(minioService.deleteFile).toHaveBeenCalledWith('old-ref-1');
      expect(minioService.deleteFile).toHaveBeenCalledWith('old-ref-2');
    });

    it('should emit events for unique client IDs', async () => {
      await processor.process(mockJob as Job<{ files: File[] }>);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith('files.compressed', {
        message: 'Files compressed successfully',
        clientId: mockUserId1.toString(),
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('files.compressed', {
        message: 'Files compressed successfully',
        clientId: mockUserId2.toString(),
      });
    });

    it('should emit only one event when files have same client ID', async () => {
      const mockJobSameClient: Partial<Job<{ files: File[] }>> = {
        data: {
          files: [
            { ...mockFile1, createdBy: mockUserId1 as any } as File,
            { ...mockFile2, createdBy: mockUserId1 as any } as File,
          ],
        },
      };

      await processor.process(mockJobSameClient as Job<{ files: File[] }>);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith('files.compressed', {
        message: 'Files compressed successfully',
        clientId: mockUserId1.toString(),
      });
    });

    it('should handle files with extensions correctly', async () => {
      const fileWithMultipleDots: Partial<File> = {
        _id: mockFileId1,
        filename: 'test.file.name.txt',
        ref: 'old-ref-1',
        createdBy: mockUserId1 as any,
      };

      const mockJobWithDots: Partial<Job<{ files: File[] }>> = {
        data: {
          files: [fileWithMultipleDots as File],
        },
      };

      await processor.process(mockJobWithDots as Job<{ files: File[] }>);

      expect(minioService.uploadBuffer).toHaveBeenCalledWith(
        mockZipBuffer,
        `${mockPath}test.zip`,
      );
    });

    it('should handle files without extensions', async () => {
      const fileWithoutExtension: Partial<File> = {
        _id: mockFileId1,
        filename: 'testfile',
        ref: 'old-ref-1',
        createdBy: mockUserId1 as any,
      };

      const mockJobNoExt: Partial<Job<{ files: File[] }>> = {
        data: {
          files: [fileWithoutExtension as File],
        },
      };

      await processor.process(mockJobNoExt as Job<{ files: File[] }>);

      expect(minioService.uploadBuffer).toHaveBeenCalledWith(
        mockZipBuffer,
        `${mockPath}testfile.zip`,
      );
    });

    it('should handle error when getting file buffer fails', async () => {
      const error = new Error('Failed to get file buffer');
      minioService.getFileBuffer.mockRejectedValueOnce(error);

      await expect(
        processor.process(mockJob as Job<{ files: File[] }>),
      ).rejects.toThrow('Failed to get file buffer');
    });

    it('should handle error when uploading compressed file fails', async () => {
      const error = new Error('Failed to upload file');
      minioService.uploadBuffer.mockRejectedValueOnce(error);

      await expect(
        processor.process(mockJob as Job<{ files: File[] }>),
      ).rejects.toThrow('Failed to upload file');
    });

    it('should handle error when updating file record fails', async () => {
      const error = new Error('Failed to update file');
      filesService.update.mockRejectedValueOnce(error);

      await expect(
        processor.process(mockJob as Job<{ files: File[] }>),
      ).rejects.toThrow('Failed to update file');
    });

    it('should handle error when deleting original file fails', async () => {
      const error = new Error('Failed to delete file');
      minioService.deleteFile.mockRejectedValueOnce(error);

      await expect(
        processor.process(mockJob as Job<{ files: File[] }>),
      ).rejects.toThrow('Failed to delete file');
    });

    it('should process empty files array', async () => {
      const emptyJob: Partial<Job<{ files: File[] }>> = {
        data: {
          files: [],
        },
      };

      await processor.process(emptyJob as Job<{ files: File[] }>);

      expect(minioService.getFileBuffer).not.toHaveBeenCalled();
      expect(minioService.uploadBuffer).not.toHaveBeenCalled();
      expect(filesService.update).not.toHaveBeenCalled();
      expect(minioService.deleteFile).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should handle token parameter', async () => {
      const token = 'test-token';
      await processor.process(mockJob as Job<{ files: File[] }>, token);

      // Should still process normally regardless of token
      expect(minioService.getFileBuffer).toHaveBeenCalledTimes(2);
    });
  });
});
