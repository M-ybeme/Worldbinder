import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthTokenResponse,
  AuthUser,
  SessionSummary,
} from '@worldbinder/contracts';
import type { RegisterInput } from '@worldbinder/validation';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { Logger } from 'nestjs-pino';
import { AuditService } from '../audit/audit.service';
import { RateLimiterService } from '../common/rate-limiter.service';
import { EnvService } from '../config/env.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  emailVerificationTokens,
  passwordResetTokens,
  userCredentials,
  userSessions,
  users,
} from '../database/schema';
import { MailService } from '../mail/mail.service';
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  RATE_LIMITS,
} from './auth.constants';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

export interface RequestContext {
  ipHash: string;
  userAgentSummary: string | null;
}

export interface RefreshResult extends AuthTokenResponse {
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly rateLimiter: RateLimiterService,
    private readonly env: EnvService,
    private readonly logger: Logger,
  ) {}

  async register(
    input: RegisterInput,
    ctx: RequestContext,
  ): Promise<{ message: string }> {
    await this.assertWithinLimit(
      `register:${ctx.ipHash}`,
      RATE_LIMITS.registerPerIp,
    );

    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email));

    if (!existing) {
      const userId = await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ email: input.email, displayName: input.displayName })
          .returning({ id: users.id });

        if (!user) throw new Error('Failed to create user');

        const passwordHash = await this.passwords.hash(input.password);
        await tx
          .insert(userCredentials)
          .values({ userId: user.id, passwordHash });

        return user.id;
      });

      await this.issueEmailVerification(userId, input.email);
      await this.audit.record({
        type: 'user_registered',
        userId,
        ipHash: ctx.ipHash,
      });
    } else if (!existing.emailVerifiedAt) {
      // They started registering before but never finished verifying — resend
      // rather than silently discarding the request. The response stays
      // generic either way, so this doesn't leak whether the email exists.
      await this.db
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(emailVerificationTokens.userId, existing.id),
            isNull(emailVerificationTokens.usedAt),
          ),
        );
      await this.issueEmailVerification(existing.id, existing.email);
    }

    // Same response whether or not the email was already registered — avoids
    // leaking account existence (see docs/decisions on auth design).
    return {
      message:
        'If that email is available, check your inbox to verify your account.',
    };
  }

  async verifyEmail(
    rawToken: string,
    ctx: RequestContext,
  ): Promise<{ message: string }> {
    await this.assertWithinLimit(
      `verify-email:${ctx.ipHash}`,
      RATE_LIMITS.verifyEmailPerIp,
    );

    const tokenHash = this.tokens.hashOpaqueToken(rawToken);

    const [record] = await this.db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, new Date()),
        ),
      );

    if (!record) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, record.id));

    await this.db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, record.userId));

    await this.audit.record({ type: 'email_verified', userId: record.userId });

    return { message: 'Email verified. You can now log in.' };
  }

  async resendVerification(
    email: string,
    ctx: RequestContext,
  ): Promise<{ message: string }> {
    await this.assertWithinLimit(
      `resend-verification:${ctx.ipHash}`,
      RATE_LIMITS.resendVerificationPerIp,
    );

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (user && !user.emailVerifiedAt) {
      await this.db
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(emailVerificationTokens.userId, user.id),
            isNull(emailVerificationTokens.usedAt),
          ),
        );

      await this.issueEmailVerification(user.id, user.email);
    }

    return {
      message:
        'If that account exists and is unverified, a new link has been sent.',
    };
  }

  async login(
    email: string,
    password: string,
    ctx: RequestContext,
  ): Promise<RefreshResult> {
    await this.assertWithinLimit(
      `login-ip:${ctx.ipHash}`,
      RATE_LIMITS.loginPerIp,
    );
    await this.assertWithinLimit(
      `login:${ctx.ipHash}:${email}`,
      RATE_LIMITS.loginPerIpAndEmail,
    );

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      await this.audit.record({
        type: 'login_failed',
        ipHash: ctx.ipHash,
        metadata: { email },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const [credentials] = await this.db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, user.id));

    const valid = credentials
      ? await this.passwords.verify(credentials.passwordHash, password)
      : false;

    if (!valid) {
      await this.audit.record({
        type: 'login_failed',
        userId: user.id,
        ipHash: ctx.ipHash,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'deactivated') {
      throw new ForbiddenException('This account has been deactivated');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Please verify your email before logging in',
      );
    }

    if (credentials && this.passwords.needsRehash(credentials.passwordHash)) {
      const rehashed = await this.passwords.hash(password);
      await this.db
        .update(userCredentials)
        .set({ passwordHash: rehashed })
        .where(eq(userCredentials.userId, user.id));
    }

    const result = await this.createSession(user, ctx);
    await this.audit.record({
      type: 'login_succeeded',
      userId: user.id,
      ipHash: ctx.ipHash,
    });

    return result;
  }

  async refresh(
    rawRefreshToken: string,
    ctx: RequestContext,
  ): Promise<RefreshResult> {
    await this.assertWithinLimit(
      `refresh:${ctx.ipHash}`,
      RATE_LIMITS.refreshPerIp,
    );

    const tokenHash = this.tokens.hashOpaqueToken(rawRefreshToken);
    const [session] = await this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.refreshTokenHash, tokenHash));

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      // This exact refresh token was already rotated away once before — reuse
      // means the token leaked. Revoke the whole family (roadmap §12.2).
      await this.db
        .update(userSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(userSessions.tokenFamilyId, session.tokenFamilyId),
            isNull(userSessions.revokedAt),
          ),
        );

      await this.audit.record({
        type: 'refresh_reuse_detected',
        userId: session.userId,
        ipHash: ctx.ipHash,
        metadata: { tokenFamilyId: session.tokenFamilyId },
      });
      this.logger.warn(
        { userId: session.userId, tokenFamilyId: session.tokenFamilyId },
        'Refresh token reuse detected',
      );

      throw new UnauthorizedException('Session revoked — please log in again');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, session.userId));
    if (!user || user.status === 'deactivated') {
      throw new UnauthorizedException('Account is no longer active');
    }

    await this.db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.id, session.id));

    return this.createSession(user, ctx, session.tokenFamilyId);
  }

  async logout(rawRefreshToken: string, ctx: RequestContext): Promise<void> {
    await this.assertWithinLimit(
      `logout:${ctx.ipHash}`,
      RATE_LIMITS.logoutPerIp,
    );

    const tokenHash = this.tokens.hashOpaqueToken(rawRefreshToken);
    await this.db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(userSessions.refreshTokenHash, tokenHash),
          isNull(userSessions.revokedAt),
        ),
      );
  }

  async listSessions(
    userId: string,
    currentSessionId: string | undefined,
  ): Promise<SessionSummary[]> {
    const rows = await this.db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(userSessions.lastUsedAt));

    return rows.map((row) => ({
      id: row.id,
      userAgentSummary: row.userAgentSummary,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      current: row.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const [session] = await this.db
      .select({ id: userSessions.id })
      .from(userSessions)
      .where(
        and(eq(userSessions.id, sessionId), eq(userSessions.userId, userId)),
      );

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.id, sessionId));
    await this.audit.record({
      type: 'session_revoked',
      userId,
      metadata: { sessionId },
    });
  }

  async forgotPassword(
    email: string,
    ctx: RequestContext,
  ): Promise<{ message: string }> {
    await this.assertWithinLimit(
      `forgot-password:${ctx.ipHash}`,
      RATE_LIMITS.forgotPasswordPerIp,
    );

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (user) {
      await this.db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            isNull(passwordResetTokens.usedAt),
          ),
        );

      const rawToken = this.tokens.generateOpaqueToken();
      await this.db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: this.tokens.hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      });

      await this.mail.sendPasswordResetEmail(user.email, rawToken);
      await this.audit.record({
        type: 'password_reset_requested',
        userId: user.id,
        ipHash: ctx.ipHash,
      });
    }

    return { message: 'If that account exists, a reset link has been sent.' };
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<{ message: string }> {
    await this.assertWithinLimit(
      `reset-password:${ctx.ipHash}`,
      RATE_LIMITS.resetPasswordPerIp,
    );

    const tokenHash = this.tokens.hashOpaqueToken(rawToken);

    const [record] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      );

    if (!record) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, record.id));

    const passwordHash = await this.passwords.hash(newPassword);
    await this.db
      .update(userCredentials)
      .set({ passwordHash, passwordChangedAt: new Date() })
      .where(eq(userCredentials.userId, record.userId));

    // Secure default (roadmap §12.5): revoke every existing session.
    await this.db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(userSessions.userId, record.userId),
          isNull(userSessions.revokedAt),
        ),
      );

    await this.audit.record({
      type: 'password_reset_completed',
      userId: record.userId,
    });

    return { message: 'Password reset. Please log in again.' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    keepSessionId: string | undefined,
    ctx: RequestContext,
  ): Promise<void> {
    await this.assertWithinLimit(
      `change-password:${ctx.ipHash}`,
      RATE_LIMITS.changePasswordPerIp,
    );

    const [credentials] = await this.db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId));

    if (
      !credentials ||
      !(await this.passwords.verify(credentials.passwordHash, currentPassword))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.db
      .update(userCredentials)
      .set({ passwordHash, passwordChangedAt: new Date() })
      .where(eq(userCredentials.userId, userId));

    const sessionsToRevoke = await this.db
      .select({ id: userSessions.id })
      .from(userSessions)
      .where(
        and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)),
      );

    for (const session of sessionsToRevoke) {
      if (session.id === keepSessionId) continue;
      await this.db
        .update(userSessions)
        .set({ revokedAt: new Date() })
        .where(eq(userSessions.id, session.id));
    }

    await this.audit.record({ type: 'password_changed', userId });
  }

  toAuthUser(user: {
    id: string;
    email: string;
    displayName: string;
    emailVerifiedAt: Date | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  private async createSession(
    user: typeof users.$inferSelect,
    ctx: RequestContext,
    tokenFamilyId: string = randomUUID(),
  ): Promise<RefreshResult> {
    const rawRefreshToken = this.tokens.generateOpaqueToken();
    const refreshExpiresAt = new Date(
      Date.now() + this.env.values.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const [session] = await this.db
      .insert(userSessions)
      .values({
        userId: user.id,
        tokenFamilyId,
        refreshTokenHash: this.tokens.hashOpaqueToken(rawRefreshToken),
        userAgentSummary: ctx.userAgentSummary,
        ipHash: ctx.ipHash,
        expiresAt: refreshExpiresAt,
      })
      .returning();

    if (!session) throw new Error('Failed to create session');

    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      sid: session.id,
    });

    return {
      accessToken,
      expiresIn: this.env.values.JWT_ACCESS_TTL_SECONDS,
      user: this.toAuthUser(user),
      refreshToken: rawRefreshToken,
      refreshExpiresAt,
    };
  }

  private async issueEmailVerification(
    userId: string,
    email: string,
  ): Promise<void> {
    const rawToken = this.tokens.generateOpaqueToken();
    await this.db.insert(emailVerificationTokens).values({
      userId,
      tokenHash: this.tokens.hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });
    await this.mail.sendVerificationEmail(email, rawToken);
  }

  private async assertWithinLimit(
    key: string,
    config: { limit: number; windowSeconds: number },
  ): Promise<void> {
    const allowed = await this.rateLimiter.consume(
      key,
      config.limit,
      config.windowSeconds,
    );
    if (!allowed) {
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
