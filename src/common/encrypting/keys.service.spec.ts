import * as fs from 'fs';
import * as path from 'path';
import { KeysService } from './keys.service';

describe('KeysService', () => {
  let keysService: KeysService;
  const privateKeyPath = path.resolve(
    __dirname,
    '../../../keys/private-key.key',
  );
  const publicKeyPath = path.resolve(__dirname, '../../../keys/public-key.crt');
  const privateKeyContent = fs.readFileSync(privateKeyPath, 'utf8');
  const publicKeyContent = fs.readFileSync(publicKeyPath, 'utf8');

  beforeEach(() => {
    keysService = new KeysService();
  });

  it('should set and get private key path', () => {
    keysService.setPrivateKeyPath(privateKeyPath);
    expect(keysService.getPrivateKey()).toBe(privateKeyContent);
  });

  it('should set and get public key path', () => {
    keysService.setPublicKeyPath(publicKeyPath);
    expect(keysService.getPublicKey()).toBe(publicKeyContent);
  });
});
