import {
  InvalidateRefreshTokenError,
  RefreshTokenIdsStorage,
} from './refresh-token-ids.storage';

describe('RefreshTokenIdsStorage', () => {
  let storage: RefreshTokenIdsStorage;
  let mockRedis: any;

  beforeEach(() => {
    const mockConfig = {} as any;
    storage = new RefreshTokenIdsStorage(mockConfig);
    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      quit: jest.fn(),
    };
    (storage as any).redisClient = mockRedis;
  });

  it('should be defined', () => {
    expect(storage).toBeDefined();
  });

  it('insert should call redis.set with correct key and tokenId', async () => {
    await storage.insert('user1', 'token1');
    expect(mockRedis.set).toHaveBeenCalledWith('user-user1', 'token1');
  });

  it('validate should return true when token matches', async () => {
    mockRedis.get.mockResolvedValue('token1');
    await expect(storage.validate('user1', 'token1')).resolves.toBe(true);
  });

  it('validate should throw InvalidateRefreshTokenError when token mismatches', async () => {
    mockRedis.get.mockResolvedValue('other');
    await expect(storage.validate('user1', 'token1')).rejects.toBeInstanceOf(
      InvalidateRefreshTokenError,
    );
  });

  it('invalidate should call redis.del with correct key', async () => {
    await storage.invalidate('user1');
    expect(mockRedis.del).toHaveBeenCalledWith('user-user1');
  });

  it('getKey should generate correct key', () => {
    // Access private method via casting
    const key = (storage as any).getKey('user1');
    expect(key).toBe('user-user1');
  });
});
