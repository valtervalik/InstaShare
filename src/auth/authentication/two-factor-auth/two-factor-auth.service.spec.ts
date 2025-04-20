import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { EncryptingService } from 'src/common/encrypting/encrypting.service';
import { User } from 'src/users/schemas/user.schema';
import { TwoFactorAuthService } from './two-factor-auth.service';

describe('TwoFactorAuthService', () => {
  let service: TwoFactorAuthService;

  beforeEach(async () => {
    const mockConfig = { get: jest.fn(), getOrThrow: jest.fn() } as any;
    const mockEncrypt = {
      setKeys: jest.fn(),
      encryptWithPublicKey: jest.fn(),
      decryptWithPrivateKey: jest.fn(),
    } as any;
    const mockModel = { updateOne: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorAuthService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: EncryptingService, useValue: mockEncrypt },
        { provide: getModelToken(User.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<TwoFactorAuthService>(TwoFactorAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
