import { ExecutionContext, HttpException } from '@nestjs/common';
import { GlobalRateLimitGuard } from './global-rate-limit.guard';
import { RateLimiterService } from './rate-limiter.service';

function contextWithIp(ip: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, socket: { remoteAddress: ip } }),
    }),
  } as unknown as ExecutionContext;
}

function fakeRateLimiter(consume: jest.Mock): RateLimiterService {
  return { consume } as unknown as RateLimiterService;
}

describe('GlobalRateLimitGuard', () => {
  it('allows the request when under the limit', async () => {
    const consume = jest.fn().mockResolvedValue(true);
    const guard = new GlobalRateLimitGuard(fakeRateLimiter(consume));

    await expect(guard.canActivate(contextWithIp('1.2.3.4'))).resolves.toBe(
      true,
    );
    expect(consume).toHaveBeenCalledWith('global:1.2.3.4', 300, 60);
  });

  it('throws a 429 HttpException once the limit is exhausted', async () => {
    const consume = jest.fn().mockResolvedValue(false);
    const guard = new GlobalRateLimitGuard(fakeRateLimiter(consume));

    await expect(
      guard.canActivate(contextWithIp('1.2.3.4')),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('keys the limit per IP, not globally across all callers', async () => {
    const consume = jest.fn().mockResolvedValue(true);
    const guard = new GlobalRateLimitGuard(fakeRateLimiter(consume));

    await guard.canActivate(contextWithIp('1.1.1.1'));
    await guard.canActivate(contextWithIp('2.2.2.2'));

    expect(consume).toHaveBeenNthCalledWith(1, 'global:1.1.1.1', 300, 60);
    expect(consume).toHaveBeenNthCalledWith(2, 'global:2.2.2.2', 300, 60);
  });
});
