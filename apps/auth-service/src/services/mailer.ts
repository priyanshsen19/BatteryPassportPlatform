import { EmailDelivery, brevoProvider, smtpProvider, type EmailProvider } from '@bpp/shared';
import nodemailer from 'nodemailer';
import { config, logger } from '../config';

export interface PasswordResetMail {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export interface Mailer {
  sendPasswordReset(mail: PasswordResetMail): Promise<void>;
  /** Checks the email providers at start-up and logs the outcome; never throws. */
  verify(): Promise<void>;
}

function createDelivery(): EmailDelivery {
  const { smtp, brevoApiKey } = config.email;
  const providers: EmailProvider[] = [];
  if (smtp) {
    providers.push(
      smtpProvider(
        nodemailer.createTransport({
          ...smtp,
          // Fail within seconds rather than Nodemailer's default of two minutes.
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        }),
      ),
    );
  }
  if (brevoApiKey) providers.push(brevoProvider(brevoApiKey));
  return new EmailDelivery(providers, logger);
}

/**
 * Sends password reset emails over SMTP, falling back to Brevo when SMTP fails. With neither
 * configured (local development) the link is written to the service log instead.
 */
function createMailer(): Mailer {
  const delivery = createDelivery();
  if (!delivery.enabled) {
    return {
      async sendPasswordReset({ to, resetUrl }) {
        logger.warn('Email is not configured; password reset link written to the log instead', {
          to,
          resetUrl,
        });
      },
      async verify() {
        logger.warn('Email is not configured (SMTP_HOST, BREVO_API_KEY); reset links will only be logged');
      },
    };
  }

  if (!config.email.fromConfigured) {
    logger.warn(
      'SMTP_FROM is not set; sending as the SMTP login, which providers such as Brevo reject unless it is a verified sender',
      { from: config.email.from },
    );
  }

  return {
    verify: () => delivery.verify(),

    async sendPasswordReset({ to, resetUrl, expiresInMinutes }) {
      const { provider, messageId } = await delivery.send({
        from: config.email.from,
        to: [to],
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
      logger.info('Password reset email sent', { provider, messageId });
    },
  };
}

export const mailer = createMailer();
