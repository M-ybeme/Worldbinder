import { randomUUID } from 'node:crypto';
import type { PasswordService } from '../../src/auth/password.service';
import type { Database } from '../../src/database/database.module';
import { userCredentials, users } from '../../src/database/schema';

export const MAILPIT_URL = 'http://127.0.0.1:8025';

export function uniqueEmail(domain: string, label: string): string {
  return `${label}-${randomUUID()}@${domain}`;
}

export async function createVerifiedUser(
  db: Database,
  passwords: PasswordService,
  password: string,
  email: string,
  displayName = 'Fixture User',
): Promise<{ id: string; email: string }> {
  const [user] = await db
    .insert(users)
    .values({ email, displayName, emailVerifiedAt: new Date() })
    .returning({ id: users.id, email: users.email });
  if (!user) throw new Error('failed to create fixture user');

  await db.insert(userCredentials).values({
    userId: user.id,
    passwordHash: await passwords.hash(password),
  });
  return user;
}

/**
 * Polls Mailpit for an email matching `subjectIncludes` sent to `email`, then
 * extracts a token from its HTML body using `tokenPattern`'s first capture
 * group. Default pattern matches `?token=<value>` links (verify/reset);
 * pass a different pattern for links that embed the token in the path, e.g.
 * campaign invitations (`/accept-invitation/<token>`).
 */
export async function findEmailToken(
  email: string,
  subjectIncludes: string,
  tokenPattern: RegExp = /token=([^&"\s]+)/,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listRes = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const list = (await listRes.json()) as {
      messages: { ID: string; Subject: string; To: { Address: string }[] }[];
    };

    const match = list.messages.find(
      (m) =>
        m.Subject.includes(subjectIncludes) &&
        m.To.some((t) => t.Address === email),
    );

    if (match) {
      const detailRes = await fetch(
        `${MAILPIT_URL}/api/v1/message/${match.ID}`,
      );
      const detail = (await detailRes.json()) as { HTML: string };
      const tokenMatch = tokenPattern.exec(detail.HTML);
      if (tokenMatch) return decodeURIComponent(tokenMatch[1]);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(
    `No "${subjectIncludes}" email found for ${email} after polling Mailpit`,
  );
}
