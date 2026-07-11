import { JwtService } from '@nestjs/jwt';
import type { EnvService } from '../config/env.service';
import { TokenService } from './token.service';

function makeEnvStub(
  overrides: Partial<{
    JWT_ACCESS_SECRET: string;
    JWT_ACCESS_TTL_SECONDS: number;
  }> = {},
) {
  return {
    values: {
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_ACCESS_TTL_SECONDS: 900,
      ...overrides,
    },
  } as EnvService;
}

describe('TokenService', () => {
  it('signs and verifies a round-trippable access token', () => {
    const service = new TokenService(new JwtService(), makeEnvStub());
    const token = service.signAccessToken({
      sub: 'user-1',
      email: 'a@b.com',
      sid: 'session-1',
    });

    const payload = service.verifyAccessToken(token);
    expect(payload).toMatchObject({
      sub: 'user-1',
      email: 'a@b.com',
      sid: 'session-1',
    });
  });

  it('rejects a token signed with a different secret', () => {
    const signer = new TokenService(
      new JwtService(),
      makeEnvStub({ JWT_ACCESS_SECRET: 'a'.repeat(32) }),
    );
    const verifier = new TokenService(
      new JwtService(),
      makeEnvStub({ JWT_ACCESS_SECRET: 'b'.repeat(32) }),
    );

    const token = signer.signAccessToken({
      sub: 'user-1',
      email: 'a@b.com',
      sid: 'session-1',
    });
    expect(() => verifier.verifyAccessToken(token)).toThrow();
  });

  it('generates opaque tokens that hash deterministically but differ per call', () => {
    const service = new TokenService(new JwtService(), makeEnvStub());
    const tokenA = service.generateOpaqueToken();
    const tokenB = service.generateOpaqueToken();

    expect(tokenA).not.toEqual(tokenB);
    expect(service.hashOpaqueToken(tokenA)).toEqual(
      service.hashOpaqueToken(tokenA),
    );
    expect(service.hashOpaqueToken(tokenA)).not.toEqual(
      service.hashOpaqueToken(tokenB),
    );
  });
});
