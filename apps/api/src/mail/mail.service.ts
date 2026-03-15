import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CrmRole } from '@crm/types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendInvitation(
    to: string,
    token: string,
    role: CrmRole,
    firstName?: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const appUrl = this.configService.get<string>('APP_URL') ?? 'http://localhost:5173';
    const inviteUrl = `${appUrl}/accept-invite?token=${token}`;

    if (!apiKey) {
      this.logger.log(
        `[MailService] No RESEND_API_KEY set. Would send invite to ${to} with role ${role}. Invite URL: ${inviteUrl}`,
      );
      return;
    }

    const fromAddress =
      this.configService.get<string>('RESEND_FROM_ADDRESS') ?? 'onboarding@resend.dev';

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(apiKey);

      const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
      await resend.emails.send({
        from: fromAddress,
        to,
        subject: `You have been invited as ${role}`,
        html: `<p>${greeting}</p><p>You have been invited to join the CRM as <strong>${role}</strong>.</p><p><a href="${inviteUrl}">Accept Invitation</a></p>`,
      });
    } catch (err) {
      this.logger.error(`Failed to send invitation email to ${to}`, err);
    }
  }
}
