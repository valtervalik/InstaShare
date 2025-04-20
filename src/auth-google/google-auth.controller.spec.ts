import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';

describe('GoogleAuthController', () => {
  let controller: GoogleAuthController;
  let service: jest.Mocked<GoogleAuthService>;

  beforeEach(async () => {
    const mockService = { authenticate: jest.fn() } as any;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleAuthController],
      providers: [{ provide: GoogleAuthService, useValue: mockService }],
    }).compile();

    controller = module.get<GoogleAuthController>(GoogleAuthController);
    service = module.get(GoogleAuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('calls authenticate on GoogleAuthService', async () => {
    const tokenDto = { token: 'abc' };
    const response = {} as Response;
    const result = { some: 'value' };
    service.authenticate.mockResolvedValue(result as any);

    await expect(controller.authenticate(tokenDto, response)).resolves.toEqual(
      result,
    );
    expect(service.authenticate).toHaveBeenCalledWith('abc', response);
  });
});
