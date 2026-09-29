import nodemailer from 'nodemailer';
import { config, logger } from '../config';

export interface PasswordResetMail {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export interface Mailer {
  sendPasswordReset(mail: PasswordResetMail): Promise<void>;
  /** Checks the SMTP connection and login at startup and logs the outcome; never throws. */
  verify(): Promise<void>;
}

/** Turns common SMTP failures into an actionable hint for the logs. */
function smtpHint(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  if (e.code === 'EAUTH' || e.responseCode === 535) {
    return 'SMTP login rejected: check SMTP_USER/SMTP_PASSWORD (for Gmail, use an App Password, not the account password)';
  }
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION' || e.code === 'ESOCKET') {
    return 'SMTP server unreachable: check SMTP_HOST/SMTP_PORT (587 with SMTP_SECURE=false, or 465 with SMTP_SECURE=true) and that the host allows outbound SMTP';
  }
  if (e.code === 'EDNS' || e.code === 'ENOTFOUND') return 'SMTP_HOST could not be resolved';
  return e.message ?? String(err);
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
      async verify() {
        logger.warn('SMTP is not configured (SMTP_HOST is empty); password reset links will only be logged');
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
    async verify() {
      try {
        await transporter.verify();
        logger.info('SMTP connection verified', { host: smtp.host, port: smtp.port, from: smtp.from });
      } catch (err) {
        logger.error('SMTP connection check failed', {
          host: smtp.host,
          port: smtp.port,
          hint: smtpHint(err),
        });
      }
    },

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
      logger.info('Password reset email sent', { messageId: info.messageId, accepted: info.accepted.length });
    },
  };
}

export const mailer = createMailer();
