import { Injectable } from '@nestjs/common';
import { compare, genSalt, hash } from 'bcryptjs';
import { HashingService } from './hashing.service';

@Injectable()
export class BcryptService implements HashingService {
  async hash(data: string): Promise<string> {
    const salt = await genSalt(12);
    return hash(data, salt);
  }

  async compare(data: string, hash: string): Promise<boolean> {
    return await compare(data, hash);
  }
}
