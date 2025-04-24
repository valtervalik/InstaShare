import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { GoogleAuthService } from './google-auth.service';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let mockConfigService: any;
  let mockAuthService: any;
  let mockEventEmitter: any;
  let mockResponse: Response;

  beforeEach(() => {
    mockConfigService = { get: jest.fn().mockReturnValue('dummy') };
    mockAuthService = { generateTokens: jest.fn() };
    mockEventEmitter = { emit: jest.fn() };
    mockResponse = {} as Response;

    // placeholder model, will be overridden per test
    const dummyModel: any = { findOne: jest.fn() };
    service = new GoogleAuthService(
      mockConfigService,
      mockAuthService,
      dummyModel,
      mockEventEmitter,
    );
    // override OAuth2Client instance
    service['oauthClient'] = {
      verifyIdToken: jest.fn(),
    } as unknown as OAuth2Client;
  });

  it('should generate tokens for existing user', async () => {
    const user = { email: 'a@b.com', googleId: 'id1' } as any;
    (service['oauthClient'].verifyIdToken as jest.Mock).mockResolvedValue({
      getPayload: () => ({ email: user.email, sub: user.googleId }),
    });
    service['userModel'].findOne = jest.fn().mockResolvedValue(user);

    const result = await service.authenticate('token', mockResponse);

    expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
      user,
      mockResponse,
    );
  });

  it('should create new user, emit welcome event, and generate tokens', async () => {
    const email = 'new@user.com';
    const googleId = 'id2';
    (service['oauthClient'].verifyIdToken as jest.Mock).mockResolvedValue({
      getPayload: () => ({ email, sub: googleId }),
    });
    service['userModel'].findOne = jest.fn().mockResolvedValue(null);
    // mock constructor behavior
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const ModelCtor: any = function (data: any) {
      Object.assign(this, data);
      this.save = saveMock;
    };
    ModelCtor.findOne = service['userModel'].findOne;

    service = new GoogleAuthService(
      mockConfigService,
      mockAuthService,
      ModelCtor,
      mockEventEmitter,
    );
    service['oauthClient'] = {
      verifyIdToken: jest
        .fn()
        .mockResolvedValue({ getPayload: () => ({ email, sub: googleId }) }),
    } as unknown as OAuth2Client;

    await service.authenticate('token', mockResponse);

    expect(saveMock).toHaveBeenCalled();
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('user.welcome', {
      email,
    });
    expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
      expect.objectContaining({ email, googleId }),
      mockResponse,
    );
  });

  it('should throw ConflictException on duplicate key error', async () => {
    (service['oauthClient'].verifyIdToken as jest.Mock).mockImplementation(
      () => {
        throw { code: 11000 };
      },
    );

    await expect(
      service.authenticate('token', mockResponse),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should throw UnauthorizedException on invalid token', async () => {
    (service['oauthClient'].verifyIdToken as jest.Mock).mockRejectedValue(
      new Error('invalid'),
    );

    await expect(
      service.authenticate('token', mockResponse),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
