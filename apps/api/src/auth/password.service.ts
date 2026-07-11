import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Centralized, versioned Argon2id parameters (roadmap §12.3). Changing these
 * only affects newly-hashed passwords; `needsRehash` lets callers upgrade
 * existing hashes opportunistically on next successful login.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, ARGON2_OPTIONS);
  }

  verify(hash: string, plainPassword: string): Promise<boolean> {
    return argon2.verify(hash, plainPassword);
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, ARGON2_OPTIONS);
  }
}
