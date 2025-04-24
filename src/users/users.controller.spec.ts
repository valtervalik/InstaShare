import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const mockService = {
      generatePassword: jest.fn().mockReturnValue('pass123'),
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should generate password and call service.create', async () => {
      const dto: CreateUserDto = { email: 'test', name: 'n' } as any;
      const activeUser = {
        sub: 'u',
        email: 'e',
        role: {} as any,
        permission: {} as any,
      } as ActiveUserData;
      const userRes = { id: '1' };
      service.create.mockResolvedValueOnce(userRes as any);

      const response = await controller.create(dto, activeUser);
      expect(service.generatePassword).toHaveBeenCalledWith(12);
      expect(service.create).toHaveBeenCalledWith(
        { ...dto, password: 'pass123' },
        activeUser,
      );
      expect(response).toEqual({
        message: 'User created successfully',
        statusCode: HttpStatus.CREATED,
        data: userRes,
      });
    });

    it('should propagate error when service.create throws', async () => {
      service.create.mockRejectedValueOnce(new Error('fail'));
      await expect(controller.create({} as any, {} as any)).rejects.toThrow(
        'fail',
      );
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with default pagination', () => {
      service.findAll.mockReturnValue({
        elements: [],
        pagination: { page: 1, limit: 10 },
      } as any);
      expect(controller.findAll({ page: 3, limit: 5 })).toEqual({
        elements: [],
        pagination: { page: 1, limit: 10 },
      });
      expect(service.findAll).toHaveBeenCalledWith({}, { page: 3, limit: 5 });
    });
  });

  describe('findById', () => {
    it('should return user by id', () => {
      const user = { id: '1' };
      service.findById.mockReturnValueOnce(user as any);
      expect(controller.findById('1')).toEqual(user);
      expect(service.findById).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('should call service.update and return api response', async () => {
      const dto: UpdateUserDto = { name: 'n' } as any;
      const activeUser = {
        sub: 'u',
        email: 'e',
        role: {} as any,
        permission: {} as any,
      } as ActiveUserData;
      const updated = { id: '1' };
      service.update.mockResolvedValueOnce(updated as any);

      const res = await controller.update('1', dto, activeUser);
      expect(service.update).toHaveBeenCalledWith(
        '1',
        dto,
        { new: true },
        activeUser,
      );
      expect(res).toEqual({
        message: 'User updated successfully',
        statusCode: HttpStatus.OK,
        data: updated,
      });
    });
  });

  describe('remove', () => {
    it('should call service.remove and return api response', async () => {
      service.remove.mockResolvedValue(undefined as any);
      const res = await controller.remove('1');
      expect(service.remove).toHaveBeenCalledWith('1');
      expect(res).toEqual({
        message: 'User deleted successfully',
        statusCode: HttpStatus.OK,
      });
    });

    it('should propagate error when service.remove throws', async () => {
      service.remove.mockRejectedValueOnce(new Error('fail'));
      await expect(controller.remove('1')).rejects.toThrow('fail');
    });
  });
});
