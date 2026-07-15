import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthTokenResponse,
  AuthUser,
  SessionSummary,
} from '@worldbinder/contracts';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResendVerificationInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from '@worldbinder/validation';
import type { CookieOptions, Request, Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EnvService } from '../config/env.service';
import { AuthService, type RefreshResult } from './auth.service';
import { CurrentUser } from './guards/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { extractClientIp, hashIp, summarizeUserAgent } from './network.util';
import type { AccessTokenPayload } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly env: EnvService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.auth.register(body, this.buildContext(req));
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.auth.verifyEmail(body.token, this.buildContext(req));
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(
    @Body(new ZodValidationPipe(resendVerificationSchema))
    body: ResendVerificationInput,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.auth.resendVerification(body.email, this.buildContext(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenResponse> {
    const result = await this.auth.login(
      body.email,
      body.password,
      this.buildContext(req),
    );
    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    return this.toResponse(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenResponse> {
    const refreshToken = this.readRefreshCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token presented');
    }

    const result = await this.auth.refresh(
      refreshToken,
      this.buildContext(req),
    );
    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    return this.toResponse(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = this.readRefreshCookie(req);
    if (refreshToken) {
      await this.auth.logout(refreshToken, this.buildContext(req));
    }
    this.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema))
    body: ForgotPasswordInput,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.auth.forgotPassword(body.email, this.buildContext(req));
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.auth.resetPassword(
      body.token,
      body.newPassword,
      this.buildContext(req),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: ChangePasswordInput,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.auth
      .changePassword(
        user.sub,
        body.currentPassword,
        body.newPassword,
        user.sid,
        this.buildContext(req),
      )
      .then(() => ({
        message: 'Password changed. Other sessions have been signed out.',
      }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  listSessions(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<SessionSummary[]> {
    return this.auth.listSessions(user.sub, user.sid);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  revokeSession(
    @CurrentUser() user: AccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<{ message: string }> {
    return this.auth
      .revokeSession(user.sub, sessionId)
      .then(() => ({ message: 'Session revoked' }));
  }

  private buildContext(req: Request): {
    ipHash: string;
    userAgentSummary: string | null;
  } {
    return {
      ipHash: hashIp(extractClientIp(req), this.env.values.JWT_ACCESS_SECRET),
      userAgentSummary: summarizeUserAgent(req.headers['user-agent']),
    };
  }

  private toResponse(result: RefreshResult): AuthTokenResponse {
    const user: AuthUser = result.user;
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user,
    };
  }

  private cookieOptions(maxAgeMs?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.env.values.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: this.env.values.COOKIE_DOMAIN,
      path: '/auth',
      maxAge: maxAgeMs,
    };
  }

  private setRefreshCookie(
    res: Response,
    refreshToken: string,
    expiresAt: Date,
  ): void {
    res.cookie(
      this.env.values.REFRESH_COOKIE_NAME,
      refreshToken,
      this.cookieOptions(expiresAt.getTime() - Date.now()),
    );
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.env.values.REFRESH_COOKIE_NAME, this.cookieOptions());
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[this.env.values.REFRESH_COOKIE_NAME];
  }
}
