import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { EnvService } from '../config/env.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly env: EnvService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.env.values.JWT_ACCESS_SECRET,
      expiresIn: this.env.values.JWT_ACCESS_TTL_SECONDS,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token, {
      secret: this.env.values.JWT_ACCESS_SECRET,
    });
  }

  /** High-entropy opaque token for refresh/email-verification/password-reset use. */
  generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /** Opaque tokens are hashed with SHA-256 before storage — entropy comes from the
   * token itself, not from hashing cost, so a fast hash is correct here (unlike
   * passwords, see PasswordService). */
  hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
