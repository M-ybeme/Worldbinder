import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies a matching password', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    await expect(
      service.verify(hash, 'correct-horse-battery-staple'),
    ).resolves.toBe(true);
  });

  it('rejects a non-matching password', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('produces a hash that does not need rehashing under current params', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    expect(service.needsRehash(hash)).toBe(false);
  });

  it('flags a hash produced under weaker params as needing rehash', () => {
    // memoryCost=1024 is far below the service's configured 65536.
    const weakHash = '$argon2id$v=19$m=1024,t=3,p=1$c29tZXNhbHQ$aGFzaHZhbHVl';
    expect(service.needsRehash(weakHash)).toBe(true);
  });
});
