import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { FileCategoriesService } from './file-categories.service';
import { FileCategory } from './schemas/file-category.schema';

describe('FileCategoriesService', () => {
  let service: FileCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileCategoriesService,
        { provide: getModelToken(FileCategory.name), useValue: {} },
      ],
    }).compile();

    service = module.get<FileCategoriesService>(FileCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
