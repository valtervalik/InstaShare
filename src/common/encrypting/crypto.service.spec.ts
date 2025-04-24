import * as path from 'path';
import { CryptoService } from './crypto.service';
import { KeysService } from './keys.service';

describe('CryptoService', () => {
  let keysService: KeysService;
  let cryptoService: CryptoService;
  const privateKeyPath = path.resolve(
    __dirname,
    '../../../keys/private-key.key',
  );
  const publicKeyPath = path.resolve(__dirname, '../../../keys/public-key.crt');
  const testString = 'NestJS Unit Test String!';

  beforeEach(() => {
    keysService = new KeysService();
    cryptoService = new CryptoService(keysService);
    cryptoService.setKeys(privateKeyPath, publicKeyPath);
  });

  it('should encrypt with public key and decrypt with private key', async () => {
    const encrypted = await cryptoService.encryptWithPublicKey(testString);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');

    const decrypted = await cryptoService.decryptWithPrivateKey(encrypted);
    expect(decrypted).toBe(testString);
  });

  it('should encrypt with private key and decrypt with public key', async () => {
    const encrypted = await cryptoService.encryptWithPrivateKey(testString);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');

    const decrypted = await cryptoService.decryptWithPublicKey(encrypted);
    expect(decrypted).toBe(testString);
  });
});
