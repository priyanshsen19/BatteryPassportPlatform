import nodemailer from 'nodemailer';
import { config, logger } from '../config';

export interface PasswordResetMail {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export interface Mailer {
  sendPasswordReset(mail: PasswordResetMail): Promise<void>;
}

/**
 * Sends password reset emails over SMTP. Without SMTP_HOST (local development) the link is
 * written to the service log instead, so the flow can still be completed.
 */
export function createMailer(): Mailer {
  const smtp = config.smtp;
  if (!smtp) {
    return {
      async sendPasswordReset({ to, resetUrl }) {
        logger.warn('SMTP is not configured; password reset link written to the log instead', {
          to,
          resetUrl,
        });
      },
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  });

  return {
    async sendPasswordReset({ to, resetUrl, expiresInMinutes }) {
      const info = await transporter.sendMail({
        from: smtp.from,
        to,
        subject: 'Reset your BatteryPass password',
        text: [
          'We received a request to reset the password for your BatteryPass account.',
          '',
          `Choose a new password here (the link expires in ${expiresInMinutes} minutes):`,
          resetUrl,
          '',
          'If you did not ask for this, you can ignore this email; your password stays the same.',
        ].join('\n'),
      });
      logger.info('Password reset email sent', { messageId: info.messageId });
    },
  };
}

export const mailer = createMailer();
