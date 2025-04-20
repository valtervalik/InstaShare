import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import { Permission } from './schemas/permission.schema';

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(async () => {
    const mockModel = {} as any;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getModelToken(Permission.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
