import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MinioService } from './minio.service';

describe('MinioService', () => {
  let mockConfigService: any;
  let mockMinioClient: any;
  let service: MinioService;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('test-bucket'),
    } as any;
    mockMinioClient = {
      bucketExists: jest.fn(),
      makeBucket: jest.fn(),
      putObject: jest.fn(),
      presignedUrl: jest.fn(),
      copyObject: jest.fn(),
      removeObject: jest.fn(),
    } as any;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: 'MINIO_CONNECTION', useValue: mockMinioClient },
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Tests for createBucketIfNotExists
  describe('createBucketIfNotExists', () => {
    it('does not create bucket when it exists', async () => {
      (mockMinioClient.bucketExists as jest.Mock).mockResolvedValue(true);
      await service.createBucketIfNotExists();
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('creates bucket when it does not exist', async () => {
      (mockMinioClient.bucketExists as jest.Mock).mockResolvedValue(false);
      await service.createBucketIfNotExists();
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith(
        'test-bucket',
        'eu-west-1',
      );
    });
  });

  // Tests for uploadFile
  describe('uploadFile', () => {
    it('uploads file and returns filename with correct extension', async () => {
      const file = {
        originalname: 'image.png',
        buffer: Buffer.from('data'),
        size: 4,
      } as Express.Multer.File;
      const result = await service.uploadFile(file, 'newName');
      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'test-bucket',
        'newName.png',
        file.buffer,
        file.size,
      );
      expect(result).toBe('newName.png');
    });

    it('handles filenames with multiple dots', async () => {
      const file = {
        originalname: 'archive.tar.gz',
        buffer: Buffer.alloc(0),
        size: 0,
      } as Express.Multer.File;
      const result = await service.uploadFile(file, 'file');
      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'test-bucket',
        'file.gz',
        file.buffer,
        file.size,
      );
      expect(result).toBe('file.gz');
    });
  });

  // Tests for getFileUrl
  describe('getFileUrl', () => {
    it('returns presigned URL', async () => {
      (mockMinioClient.presignedUrl as jest.Mock).mockResolvedValue(
        'http://url',
      );
      const url = await service.getFileUrl('some.txt');
      expect(mockMinioClient.presignedUrl).toHaveBeenCalledWith(
        'GET',
        'test-bucket',
        'some.txt',
      );
      expect(url).toBe('http://url');
    });
  });

  // Tests for updateFileName
  describe('updateFileName', () => {
    it('copies, deletes old file, and returns new filename and url', async () => {
      (mockMinioClient.presignedUrl as jest.Mock).mockResolvedValue(
        'http://url/new.txt',
      );
      const result = await service.updateFileName('old.txt', 'new', 'txt');
      expect(mockMinioClient.copyObject).toHaveBeenCalledWith(
        'test-bucket',
        'new.txt',
        '/test-bucket/old.txt',
        expect.any(Object),
      );
      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'test-bucket',
        'old.txt',
      );
      expect(mockMinioClient.presignedUrl).toHaveBeenCalledWith(
        'GET',
        'test-bucket',
        'new.txt',
      );
      expect(result).toEqual({
        filename: 'new.txt',
        url: 'http://url/new.txt',
      });
    });
  });

  // Tests for deleteFile
  describe('deleteFile', () => {
    it('removes object from bucket', async () => {
      await service.deleteFile('file.txt');
      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'test-bucket',
        'file.txt',
      );
    });
  });
});
