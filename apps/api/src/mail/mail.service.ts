import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import nodemailer, { type Transporter } from 'nodemailer';
import { EnvService } from '../config/env.service';

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly transporter: Transporter;

  constructor(
    private readonly env: EnvService,
    private readonly logger: Logger,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.env.values.SMTP_HOST,
      port: this.env.values.SMTP_PORT,
      // `secure: true` = implicit TLS (typically port 465); `secure: false`
      // leaves nodemailer free to negotiate STARTTLS opportunistically if
      // the server's EHLO response advertises it, which is exactly what
      // Resend's and Postmark's SMTP relays expect on port 587. An earlier
      // version of this transport hardcoded `ignoreTLS: !secure`, forcing
      // STARTTLS off entirely for any non-`secure` connection — that was a
      // Mailpit-shaped assumption baked into code rather than config
      // (Mailpit never advertises STARTTLS, so nodemailer never attempts an
      // upgrade against it either way; verified by removing the flag and
      // re-running the full auth/membership e2e suites against real
      // Mailpit), and would have silently broken STARTTLS against a real
      // provider once one was configured.
      secure: this.env.values.SMTP_SECURE,
      auth:
        this.env.values.SMTP_USER && this.env.values.SMTP_PASSWORD
          ? {
              user: this.env.values.SMTP_USER,
              pass: this.env.values.SMTP_PASSWORD,
            }
          : undefined,
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.env.values.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      'Verify your Worldbinder account',
      `<p>Confirm your email address to finish creating your Worldbinder account.</p>
       <p><a href="${link}">${link}</a></p>
       <p>This link expires in 24 hours.</p>`,
    );
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = `${this.env.values.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      'Reset your Worldbinder password',
      `<p>A password reset was requested for this account. If this wasn't you, ignore this email.</p>
       <p><a href="${link}">${link}</a></p>
       <p>This link expires in 1 hour.</p>`,
    );
  }

  async sendCampaignInviteEmail(
    to: string,
    token: string,
    campaignName: string,
  ): Promise<void> {
    const link = `${this.env.values.FRONTEND_URL}/accept-invitation/${encodeURIComponent(token)}`;
    await this.send(
      to,
      `You've been invited to "${campaignName}" on Worldbinder`,
      `<p>You've been invited to join the campaign "${campaignName}" on Worldbinder.</p>
       <p><a href="${link}">${link}</a></p>
       <p>This invitation expires in 7 days.</p>`,
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.env.values.MAIL_FROM,
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error({ err: error, to, subject }, 'Failed to send email');
      throw error;
    }
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
