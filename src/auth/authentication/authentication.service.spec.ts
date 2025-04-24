/* eslint-disable sonarjs/no-duplicate-string */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { HashingService } from 'src/common/hashing/hashing.service';
import { User } from 'src/users/schemas/user.schema';
import { REFRESH_TOKEN_KEY } from '../auth.constants';
import { AuthenticationService } from './authentication.service';
import { RefreshTokenIdsStorage } from './refresh-token-ids.storage/refresh-token-ids.storage';
import { TwoFactorAuthService } from './two-factor-auth/two-factor-auth.service';

// helper to mock mongoose query chain
const makeFindOneMock = (data: any) => ({
  populate: jest.fn().mockReturnThis(),
  select: jest.fn().mockResolvedValue(data),
});

// declare mock variables for use in tests
let mockModel: any;
let mockHashing: any;
let mockJwt: any;
let mockConfig: any;
let mockStorage: any;
let mockTwoFA: any;

describe('AuthenticationService', () => {
  let service: AuthenticationService;

  beforeEach(async () => {
    mockModel = { findOne: jest.fn(), findById: jest.fn() } as any;
    mockHashing = { compare: jest.fn() } as any;
    mockJwt = { signAsync: jest.fn(), verifyAsync: jest.fn() } as any;
    mockConfig = { get: jest.fn() } as any;
    mockStorage = {
      insert: jest.fn(),
      validate: jest.fn(),
      invalidate: jest.fn(),
    } as any;
    mockTwoFA = {} as any;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        { provide: getModelToken(User.name), useValue: mockModel },
        { provide: HashingService, useValue: mockHashing },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RefreshTokenIdsStorage, useValue: mockStorage },
        { provide: TwoFactorAuthService, useValue: mockTwoFA },
      ],
    }).compile();

    service = module.get<AuthenticationService>(AuthenticationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTokens', () => {
    it('should generate tokens and set cookie', async () => {
      const user = {
        _id: '123',
        email: 'test@test.com',
        role: 'role',
        permission: ['perm'],
      } as any;
      mockJwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockConfig.get.mockReturnValueOnce(3600).mockReturnValueOnce(3600);
      mockStorage.insert.mockResolvedValue(undefined);
      const mockResponse = { cookie: jest.fn() } as any;

      const result = await service.generateTokens(user, mockResponse);

      expect(mockJwt.signAsync).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_KEY,
        'refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result).toEqual({ accessToken: 'access-token' });
    });
  });

  describe('validateUser', () => {
    const userObj: any = {
      _id: '1',
      email: 'u@test',
      password: 'hashed',
      isTFAEnabled: false,
      toObject: () => ({
        _id: '1',
        email: 'u@test',
        role: 'r',
        permission: [],
      }),
    };

    it('should throw if user not found', async () => {
      mockModel.findOne.mockReturnValue(makeFindOneMock(null));
      await expect(service.validateUser('a', 'b')).rejects.toThrow(
        'Bad credentials',
      );
    });

    it('should throw if password mismatch', async () => {
      mockModel.findOne.mockReturnValue(
        makeFindOneMock({ ...userObj, password: 'hashed' }),
      );
      mockHashing.compare.mockResolvedValue(false);
      await expect(service.validateUser('u@test', 'wrong')).rejects.toThrow(
        'Bad credentials',
      );
    });

    it('should return user object without sensitive fields', async () => {
      mockModel.findOne.mockReturnValue(makeFindOneMock(userObj));
      mockHashing.compare.mockResolvedValue(true);
      const result = await service.validateUser('u@test', 'pass');
      expect(result).toEqual({
        _id: '1',
        email: 'u@test',
        role: 'r',
        permission: [],
      });
    });
  });

  describe('validateUser additional cases', () => {
    it('should throw please login with google if user has no password but has googleId', async () => {
      const user = {
        password: null,
        googleId: 'gid',
        populate: () => {},
      } as any;
      mockModel.findOne.mockReturnValue(makeFindOneMock(user));
      await expect(service.validateUser('e', 'x')).rejects.toThrow(
        'Please login with google',
      );
    });

    it('should throw unauthorized if user has no password and no googleId', async () => {
      const user = { password: null, googleId: null } as any;
      mockModel.findOne.mockReturnValue(makeFindOneMock(user));
      await expect(service.validateUser('e', 'x')).rejects.toThrow();
    });

    it('should throw invalid 2FA code when TFA enabled and code invalid', async () => {
      const secret = 's';
      const userObjTFA = {
        _id: '1',
        email: 'u@test',
        password: 'hashed',
        isTFAEnabled: true,
        tfaSecret: secret,
        toObject: () => ({
          _id: '1',
          email: 'u@test',
          role: 'r',
          permission: [],
        }),
      } as any;
      mockModel.findOne.mockReturnValue(makeFindOneMock(userObjTFA));
      mockHashing.compare.mockResolvedValue(true);
      mockTwoFA.verifyCode = jest.fn().mockResolvedValue(false);
      await expect(
        service.validateUser('u@test', 'pass', 'code'),
      ).rejects.toThrow('Invalid 2FA code');
    });

    it('should authenticate when TFA enabled and code valid', async () => {
      const secret = 's';
      const userObjTFA = {
        _id: '1',
        email: 'u@test',
        password: 'hashed',
        isTFAEnabled: true,
        tfaSecret: secret,
        toObject: () => ({
          _id: '1',
          email: 'u@test',
          role: 'r',
          permission: [],
        }),
      } as any;
      mockModel.findOne.mockReturnValue(makeFindOneMock(userObjTFA));
      mockHashing.compare.mockResolvedValue(true);
      mockTwoFA.verifyCode = jest.fn().mockResolvedValue(true);
      const res = await service.validateUser('u@test', 'pass', 'code');
      expect(res).toEqual({
        _id: '1',
        email: 'u@test',
        role: 'r',
        permission: [],
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens on valid token', async () => {
      const payload = { sub: '1', refreshTokenId: 'rid' };
      mockJwt.verifyAsync.mockResolvedValue(payload);
      const mockUser = {
        _id: '1',
        id: '1',
        populate: jest
          .fn()
          .mockResolvedValue({ _id: '1', role: [], permission: [] }),
      };
      mockModel.findById.mockReturnValue({
        populate: () => Promise.resolve(mockUser),
      });
      mockStorage.validate.mockResolvedValue(true);
      mockStorage.invalidate.mockResolvedValue(undefined);
      mockJwt.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      mockConfig.get.mockReturnValueOnce(3600).mockReturnValueOnce(3600);
      mockStorage.insert.mockResolvedValue(undefined);
      const mockResponse = { cookie: jest.fn() } as any;

      const result = await service.refreshToken('rt', mockResponse);

      expect(result).toEqual({ accessToken: 'new-access' });
      expect(mockStorage.invalidate).toHaveBeenCalledWith('1');
    });

    it('should throw on invalid token', async () => {
      mockJwt.verifyAsync.mockRejectedValue(new Error('fail'));
      await expect(service.refreshToken('bad', {} as any)).rejects.toThrow();
    });

    it('should throw UnauthorizedException when storage validation fails', async () => {
      const payload = { sub: '1', refreshTokenId: 'rid' };
      mockJwt.verifyAsync.mockResolvedValue(payload);
      const mockUser = {
        _id: '1',
        id: '1',
        populate: jest
          .fn()
          .mockResolvedValue({ _id: '1', role: [], permission: [] }),
      };
      mockModel.findById.mockReturnValue({
        populate: () => Promise.resolve(mockUser),
      });
      mockStorage.validate.mockResolvedValue(false);
      const mockResponse = { cookie: jest.fn() } as any;

      await expect(service.refreshToken('rt', mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
