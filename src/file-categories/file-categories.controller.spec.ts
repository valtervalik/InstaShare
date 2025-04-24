import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface';
import { CreateFileCategoryDto } from './dto/create-file-category.dto';
import { UpdateFileCategoryDto } from './dto/update-file-category.dto';
import { FileCategoriesController } from './file-categories.controller';
import { FileCategoriesService } from './file-categories.service';

describe('FileCategoriesController', () => {
  let controller: FileCategoriesController;
  let service: jest.Mocked<FileCategoriesService>;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAllWithoutPagination: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as Partial<jest.Mocked<FileCategoriesService>>;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileCategoriesController],
      providers: [{ provide: FileCategoriesService, useValue: mockService }],
    }).compile();

    controller = module.get<FileCategoriesController>(FileCategoriesController);
    service = module.get(
      FileCategoriesService,
    ) as jest.Mocked<FileCategoriesService>;
  });

  describe('create', () => {
    it('should call service.create and return api response', async () => {
      const dto: CreateFileCategoryDto = { name: 'Category1' };
      const activeUser: ActiveUserData = {
        sub: 'user1',
        email: 'test@example.com',
        role: {} as any,
        permission: {} as any,
      };
      const result = { id: '1', name: 'Category1' };
      service.create.mockResolvedValue(result as any);

      expect(await controller.create(dto, activeUser)).toEqual({
        message: 'File category created successfully',
        statusCode: HttpStatus.CREATED,
        data: result,
      });
      expect(service.create).toHaveBeenCalledWith(dto, activeUser);
    });

    it('should propagate error when service.create throws', async () => {
      const dto = { name: 'Category1' };
      const activeUser = {
        sub: 'user1',
        email: 'x',
        role: {} as any,
        permission: {} as any,
      };
      const error = new Error('fail');
      service.create.mockRejectedValueOnce(error);
      await expect(
        controller.create(dto as any, activeUser as any),
      ).rejects.toThrow(error);
    });
  });

  describe('findAll', () => {
    it('should call service.findAllWithoutPagination and return categories', () => {
      const result = [{ id: '1' }];
      service.findAllWithoutPagination.mockReturnValue(result as any);

      expect(controller.findAll()).toEqual(result);
      expect(service.findAllWithoutPagination).toHaveBeenCalledWith({
        order: 'name',
      });
    });

    it('should return empty array when no categories', () => {
      service.findAllWithoutPagination.mockReturnValue({
        elements: [],
        total: 0,
      } as any);
      expect(controller.findAll()).toEqual({ elements: [], total: 0 });
    });
  });

  describe('update', () => {
    it('should call service.update and return api response', async () => {
      const id = '1';
      const dto: UpdateFileCategoryDto = { name: 'Updated' };
      const activeUser: ActiveUserData = {
        sub: 'user1',
        email: 'test@example.com',
        role: {} as any,
        permission: {} as any,
      };
      const updated = { id: '1', name: 'Updated' };
      service.update.mockResolvedValue(updated as any);

      expect(await controller.update(id, dto, activeUser)).toEqual({
        message: 'File category updated successfully',
        statusCode: HttpStatus.OK,
        data: updated,
      });
      expect(service.update).toHaveBeenCalledWith(
        id,
        dto,
        { new: true },
        activeUser,
      );
    });

    it('should propagate error when service.update throws', async () => {
      const id = '1';
      const dto = { name: 'Updated' };
      const activeUser = {
        sub: 'user1',
        email: 'x',
        role: {} as any,
        permission: {} as any,
      };
      const err = new Error('update fail');
      service.update.mockRejectedValueOnce(err);
      await expect(
        controller.update(id, dto as any, activeUser as any),
      ).rejects.toThrow(err);
    });
  });

  describe('remove', () => {
    it('should call service.remove and return api response', async () => {
      const id = '1';
      service.remove.mockResolvedValue(undefined as any);

      expect(await controller.remove(id)).toEqual({
        message: 'File category deleted successfully',
        statusCode: HttpStatus.OK,
      });
      expect(service.remove).toHaveBeenCalledWith(id);
    });

    it('should propagate error when service.remove throws', async () => {
      const id = '1';
      const err = new Error('delete fail');
      service.remove.mockRejectedValueOnce(err);
      await expect(controller.remove(id)).rejects.toThrow(err);
    });
  });
});
