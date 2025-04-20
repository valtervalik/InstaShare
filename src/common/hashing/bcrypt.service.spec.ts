import { BcryptService } from './bcrypt.service';

describe('BcryptService', () => {
  let service: BcryptService;
  const plainText = 'TestPassword123!';

  beforeEach(() => {
    service = new BcryptService();
  });

  it('should hash a string and return a hash not equal to the input', async () => {
    const hash = await service.hash(plainText);
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(plainText);
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should compare valid data and hashed data to true', async () => {
    const hash = await service.hash(plainText);
    const result = await service.compare(plainText, hash);
    expect(result).toBe(true);
  });

  it('should return false when comparing invalid data to a hash', async () => {
    const hash = await service.hash(plainText);
    const result = await service.compare('WrongPassword!', hash);
    expect(result).toBe(false);
  });
});
