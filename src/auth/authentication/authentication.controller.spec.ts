import { BadRequestException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as qr from 'qrcode';
import { TypedEventEmitter } from 'src/common/types/typed-event-emitter/typed-event-emitter.class';
import { apiResponseHandler } from 'src/utils/apiResponseHandler';
import { REFRESH_TOKEN_KEY } from '../auth.constants';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { TwoFactorAuthService } from './two-factor-auth/two-factor-auth.service';

describe('AuthenticationController', () => {
  let controller: AuthenticationController;
  let authService: jest.Mocked<AuthenticationService>;
  let twoFA: jest.Mocked<TwoFactorAuthService>;
  let emitter: jest.Mocked<TypedEventEmitter>;

  beforeEach(async () => {
    const mockAuthService = {
      create: jest.fn(),
      generateTokens: jest.fn(),
      refreshToken: jest.fn(),
      findById: jest.fn(),
      validateUser: jest.fn(),
      update: jest.fn(),
    } as any;
    const mockTwoFA = {
      generateSecret: jest.fn(),
      enableTFAForUser: jest.fn(),
      disableTFAForUser: jest.fn(),
      verifyCode: jest.fn(),
    } as any;
    const mockEmitter = { emit: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticationController],
      providers: [
        { provide: AuthenticationService, useValue: mockAuthService },
        { provide: TwoFactorAuthService, useValue: mockTwoFA },
        { provide: TypedEventEmitter, useValue: mockEmitter },
      ],
    }).compile();

    controller = module.get<AuthenticationController>(AuthenticationController);
    authService = module.get(AuthenticationService);
    twoFA = module.get(TwoFactorAuthService);
    emitter = module.get(TypedEventEmitter);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

describe('AuthenticationController - methods', () => {
  let controller: AuthenticationController;
  let authService: jest.Mocked<AuthenticationService>;
  let twoFA: jest.Mocked<TwoFactorAuthService>;
  let emitter: jest.Mocked<TypedEventEmitter>;

  beforeEach(async () => {
    const mockAuthService = {
      create: jest.fn(),
      generateTokens: jest.fn(),
      refreshToken: jest.fn(),
      findById: jest.fn(),
      validateUser: jest.fn(),
      update: jest.fn(),
    } as any;
    const mockTwoFAService = {
      generateSecret: jest.fn(),
      enableTFAForUser: jest.fn(),
      disableTFAForUser: jest.fn(),
      verifyCode: jest.fn(),
    } as any;
    const mockEmitterService = { emit: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticationController],
      providers: [
        { provide: AuthenticationService, useValue: mockAuthService },
        { provide: TwoFactorAuthService, useValue: mockTwoFAService },
        { provide: TypedEventEmitter, useValue: mockEmitterService },
      ],
    }).compile();

    controller = module.get<AuthenticationController>(AuthenticationController);
    authService = module.get(AuthenticationService);
    twoFA = module.get(TwoFactorAuthService);
    emitter = module.get(TypedEventEmitter);
  });

  it('should sign up user and emit welcome event', async () => {
    const dto = { email: 'a@b.com', password: 'pass' } as any;
    const user = { id: '1' } as any;
    authService.create.mockResolvedValue(user);

    const result = await controller.signUp(dto);

    expect(authService.create).toHaveBeenCalledWith(dto);
    expect(emitter.emit).toHaveBeenCalledWith('user.welcome', {
      email: dto.email,
    });
    expect(result).toEqual(
      apiResponseHandler(
        'User registered successfully',
        HttpStatus.CREATED,
        user,
      ),
    );
  });

  it('should sign in user and return tokens', async () => {
    const mockUser = {} as any;
    const mockReq = { user: mockUser } as any;
    const mockRes = {} as any;
    const tokens = { accessToken: 'tok' };
    authService.generateTokens.mockResolvedValue(tokens);

    const result = await controller.signIn(mockReq, mockRes);

    expect(authService.generateTokens).toHaveBeenCalledWith(mockUser, mockRes);
    expect(result).toEqual(
      apiResponseHandler('Login successful', HttpStatus.OK, tokens),
    );
  });

  it('should refresh token and return new tokens', async () => {
    const cookie = { [REFRESH_TOKEN_KEY]: 'rt' };
    const mockReq = { cookies: cookie } as any;
    const mockRes = {} as any;
    const tokens = { accessToken: 'newAccess' };
    authService.refreshToken.mockResolvedValue(tokens);

    const result = await controller.refreshToken(mockReq, mockRes);

    expect(authService.refreshToken).toHaveBeenCalledWith('rt', mockRes);
    expect(result).toEqual(tokens);
  });

  it('should generate QR code and stream', async () => {
    const activeUser = { email: 'e' } as any;
    const mockRes = { type: jest.fn() } as any;
    twoFA.generateSecret.mockResolvedValue({ secret: 's', uri: 'u' });
    twoFA.enableTFAForUser.mockResolvedValue(undefined);
    jest.spyOn(qr, 'toFileStream').mockReturnValue('stream' as any);

    const result = await controller.generateQrCode(activeUser, mockRes);

    expect(twoFA.generateSecret).toHaveBeenCalledWith(activeUser.email);
    expect(twoFA.enableTFAForUser).toHaveBeenCalledWith(activeUser.email, 's');
    expect(mockRes.type).toHaveBeenCalledWith('png');
    expect(qr.toFileStream).toHaveBeenCalledWith(mockRes, 'u');
    expect(result).toBe('stream');
  });

  it('should disable TFA and return response', async () => {
    const activeUser = { email: 'e' } as any;
    twoFA.disableTFAForUser.mockResolvedValue(undefined);

    const result = await controller.disableTFA(activeUser);

    expect(twoFA.disableTFAForUser).toHaveBeenCalledWith(activeUser.email);
    expect(result).toEqual(
      apiResponseHandler(
        'Two-factor authentication disabled successfully',
        HttpStatus.OK,
      ),
    );
  });

  it('should get current user with populated fields', async () => {
    const activeUser = { sub: '1' } as any;
    const populated = { foo: 'bar' };
    authService.findById.mockResolvedValue({
      populate: () => populated,
    } as any);

    const result = await controller.getCurrentUser(activeUser);

    expect(authService.findById).toHaveBeenCalledWith(activeUser.sub);
    expect(result).toBe(populated);
  });

  it('should logout and clear cookie', () => {
    const mockRes = { clearCookie: jest.fn() } as any;

    const result = controller.logout(mockRes);

    expect(mockRes.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
    expect(result).toEqual(
      apiResponseHandler('Logout successful', HttpStatus.OK),
    );
  });

  describe('changePassword', () => {
    const dto = {
      email: 'a',
      oldPassword: 'o',
      password: 'p',
      confirmPassword: 'p',
    } as any;
    const activeUser = { sub: '1' } as any;

    it('should change password successfully', async () => {
      const user = { _id: { toString: () => '1' } } as any;
      authService.validateUser.mockResolvedValue(user);
      authService.update.mockResolvedValue(undefined);

      const result = await controller.changePassword(dto, activeUser);

      expect(authService.validateUser).toHaveBeenCalledWith(
        dto.email,
        dto.oldPassword,
      );
      expect(authService.update).toHaveBeenCalledWith(
        '1',
        { password: dto.password },
        { new: false },
      );
      expect(result).toEqual(
        apiResponseHandler(
          'Contraseña actualizada exitosamente',
          HttpStatus.OK,
        ),
      );
    });

    it('should throw if trying to change another user password', async () => {
      const user = { _id: { toString: () => '2' } } as any;
      authService.validateUser.mockResolvedValue(user);
      await expect(controller.changePassword(dto, activeUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if passwords do not match', async () => {
      const badDto = { ...dto, confirmPassword: 'x' };
      authService.validateUser.mockResolvedValue({
        _id: { toString: () => '1' },
      } as any);
      await expect(
        controller.changePassword(badDto, activeUser),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
