/**
 * Milestone 15 Phase 1 — a small local copy of
 * `apps/api/test/helpers/test-users.ts`'s `findEmailToken` pattern, kept
 * independent of the test suite (this is a standalone script, not a Jest
 * spec) so it isn't affected by test-file churn and doesn't reach across
 * the `src/`/`test/` boundary.
 *
 * Polls Mailpit's real REST API for an email matching `subjectIncludes`
 * sent to `email`, then extracts a token from its HTML body using
 * `tokenPattern`'s first capture group. Default pattern matches `?token=`
 * links (verify-email, reset-password); pass a different pattern for
 * links that embed the token in the path (campaign invitations,
 * `/accept-invitation/<token>`).
 */

const MAILPIT_URL = 'http://127.0.0.1:8025';

export async function findEmailToken(
  email: string,
  subjectIncludes: string,
  tokenPattern: RegExp = /token=([^&"\s]+)/,
): Promise<string> {
  let foundEmailButNoTokenMatch = false;

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
      foundEmailButNoTokenMatch = true;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(
    foundEmailButNoTokenMatch
      ? `Found a "${subjectIncludes}" email for ${email}, but tokenPattern (${tokenPattern}) never matched its body — wrong pattern for this email's link shape.`
      : `No "${subjectIncludes}" email found for ${email} after polling Mailpit`,
  );
}
