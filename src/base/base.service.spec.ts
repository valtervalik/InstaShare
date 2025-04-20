import { ConflictException, NotFoundException } from '@nestjs/common';
import { BaseService } from './base.service';

describe('BaseService', () => {
  interface TestDoc {
    id?: string;
    name?: string;
    createdBy?: string;
    updatedBy?: string;
    deleted?: boolean;
    deletedAt?: Date;
    deletedBy?: string;
    restoredAt?: Date;
    restoredBy?: string;
  }
  let service: any;
  let mockModel: any;
  const user = { sub: 'user123' };

  beforeEach(() => {
    const ServiceClass = BaseService<TestDoc>('Test');
    service = new ServiceClass();
    mockModel = {
      create: jest.fn(),
      exists: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
    };
    service.model = mockModel;
  });

  describe('create', () => {
    it('should create without user', async () => {
      mockModel.create.mockResolvedValue({ name: 'test' });
      const result = await service.create({ name: 'test' });
      expect(mockModel.create).toHaveBeenCalledWith({ name: 'test' });
      expect(result).toEqual({ name: 'test' });
    });

    it('should create with user', async () => {
      mockModel.create.mockResolvedValue({ name: 't', createdBy: 'user123' });
      const result = await service.create({ name: 't' }, user);
      expect(mockModel.create).toHaveBeenCalledWith({
        name: 't',
        createdBy: 'user123',
      });
      expect(result.createdBy).toBe('user123');
    });

    it('should throw ConflictException on duplicate error', async () => {
      const err: any = new Error();
      err.code = 11000;
      mockModel.create.mockRejectedValue(err);
      await expect(service.create({})).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('createIfUnique', () => {
    it('should throw ConflictException if exists', async () => {
      mockModel.exists.mockResolvedValue(true);
      await expect(
        service.createIfUnique({ id: '1' }, {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should create if unique', async () => {
      mockModel.exists.mockResolvedValue(false);
      mockModel.create.mockResolvedValue({});
      await service.createIfUnique({ id: '1' }, { name: 'n' }, user);
      expect(mockModel.create).toHaveBeenCalledWith({
        name: 'n',
        createdBy: 'user123',
      });
    });
  });

  describe('findById', () => {
    it('should return document if found', async () => {
      mockModel.findById.mockResolvedValue({ id: '1' });
      const res = await service.findById('1');
      expect(res).toEqual({ id: '1' });
    });
    it('should throw NotFoundException if not found', async () => {
      mockModel.findById.mockResolvedValue(null);
      await expect(service.findById('1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should return when found', async () => {
      mockModel.findOne.mockResolvedValue({ id: '1' });
      const res = await service.findOne({ id: '1' });
      expect(res).toEqual({ id: '1' });
    });
    it('should throw NotFoundException if missing', async () => {
      mockModel.findOne.mockResolvedValue(null);
      await expect(service.findOne({ id: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('exists', () => {
    it('should return true/false', async () => {
      mockModel.exists.mockResolvedValue({});
      expect(await service.exists({ test: 1 })).toBe(true);
      mockModel.exists.mockResolvedValue(null);
      expect(await service.exists({})).toBe(false);
    });
  });

  describe('update', () => {
    it('should update with new:true', async () => {
      mockModel.findOneAndUpdate.mockResolvedValue({ name: 'u' });
      const res = await service.update('1', { name: 'u' }, { new: true }, user);
      expect(mockModel.findOneAndUpdate).toHaveBeenCalled();
      expect(res).toEqual({ name: 'u' });
    });
  });

  describe('remove', () => {
    it('should call deleteOne', async () => {
      await service.remove('1');
      expect(mockModel.deleteOne).toHaveBeenCalledWith({ _id: '1' });
    });
  });

  describe('count', () => {
    it('should count documents', async () => {
      mockModel.countDocuments.mockResolvedValue(5);
      expect(await service.count({})).toBe(5);
    });
  });

  describe('findAll', () => {
    it('should return elements and pagination', async () => {
      const query: any = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        collation: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ id: '1' }]),
      };
      mockModel.find.mockReturnValue(query);
      mockModel.countDocuments.mockResolvedValue(1);
      const res = await service.findAll(
        { order: 'name', select: 'name', populate: [] },
        { page: 1, limit: 1 },
      );
      expect(query.skip).toHaveBeenCalledWith(0);
      expect(res.elements).toEqual([{ id: '1' }]);
      expect(res.pagination.totalElements).toBe(1);
    });
  });

  describe('findAllWithoutPagination', () => {
    it('should return elements and total', async () => {
      const query: any = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ id: '2' }]),
      };
      mockModel.find.mockReturnValue(query);
      const res = await service.findAllWithoutPagination({
        order: 'asc',
        select: '',
        populate: ['a'],
      });
      expect(res.elements).toEqual([{ id: '2' }]);
      expect(res.total).toBe(1);
    });
  });

  describe('findAllAggregate', () => {
    it('should aggregate and paginate', async () => {
      const agg: any = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ id: '3' }]),
      };
      mockModel.aggregate.mockReturnValue(agg);
      // total aggregation returns [{ total: 2 }]
      const totalAgg: any = {
        exec: jest.fn().mockResolvedValue([{ total: 2 }]),
      };
      mockModel.aggregate
        .mockReturnValueOnce(agg)
        .mockReturnValueOnce(totalAgg);
      const res = await service.findAllAggregate([{ $match: {} }], {
        page: 1,
        limit: 1,
      });
      expect(res.elements).toEqual([{ id: '3' }]);
      expect(res.pagination.totalElements).toBe(2);
    });
  });

  describe('updateMany', () => {
    it('should updateMany and return docs when new=true', async () => {
      mockModel.updateMany.mockResolvedValue(undefined);
      mockModel.find.mockResolvedValue([{ id: '4' }]);
      const res = await service.updateMany(
        ['4'],
        { name: 'x' },
        { new: true },
        user,
      );
      expect(mockModel.updateMany).toHaveBeenCalled();
      expect(res).toEqual([{ id: '4' }]);
    });
    it('should updateMany and return void when new=false', async () => {
      mockModel.updateMany.mockResolvedValue(undefined);
      const res = await service.updateMany(
        ['5'],
        { name: 'y' },
        { new: false },
      );
      expect(res).toBeUndefined();
    });
  });

  describe('removeMany', () => {
    it('should call deleteMany', async () => {
      await service.removeMany(['6']);
      expect(mockModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ['6'] },
      });
    });
  });

  describe('softRemove and restore', () => {
    it('should softRemove with user', async () => {
      await service.softRemove('7', user);
      expect(mockModel.updateOne).toHaveBeenCalledTimes(2);
    });
    it('should softRemove without user', async () => {
      await service.softRemove('8');
      expect(mockModel.updateOne).toHaveBeenCalledTimes(1);
    });
    it('should restore with user', async () => {
      await service.restore('9', user);
      expect(mockModel.updateOne).toHaveBeenCalledTimes(2);
    });
    it('should restore without user', async () => {
      await service.restore('10');
      expect(mockModel.updateOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('softRemoveMany and restoreMany', () => {
    it('should softRemoveMany with user', async () => {
      await service.softRemoveMany(['11'], user);
      expect(mockModel.updateMany).toHaveBeenCalled();
    });
    it('should softRemoveMany without user', async () => {
      await service.softRemoveMany(['12']);
      expect(mockModel.updateMany).toHaveBeenCalled();
    });
    it('should restoreMany with user', async () => {
      await service.restoreMany(['13'], user);
      expect(mockModel.updateMany).toHaveBeenCalled();
    });
    it('should restoreMany without user', async () => {
      await service.restoreMany(['14']);
      expect(mockModel.updateMany).toHaveBeenCalled();
    });
  });
});
