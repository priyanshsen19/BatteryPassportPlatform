import type { Logger } from '../logger';

export interface OutgoingEmail {
  /** "Name <address>" or a bare address. */
  from: string;
  to: string[];
  subject: string;
  text: string;
}

export interface EmailProvider {
  readonly name: 'smtp' | 'brevo';
  send(email: OutgoingEmail): Promise<{ messageId?: string }>;
  /** Resolves when the provider is reachable and the credentials are accepted. */
  verify(): Promise<void>;
}

/** The part of a Nodemailer transporter used here, so this package does not depend on Nodemailer. */
interface SmtpTransport {
  sendMail(message: OutgoingEmail): Promise<{ messageId?: string }>;
  verify(): Promise<unknown>;
}

export function smtpProvider(transport: SmtpTransport): EmailProvider {
  return {
    name: 'smtp',
    send: (email) => transport.sendMail(email),
    verify: async () => {
      await transport.verify();
    },
  };
}

const BREVO_API = 'https://api.brevo.com/v3';

function parseAddress(value: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value);
  return match ? { name: match[1] || undefined, email: match[2].trim() } : { email: value.trim() };
}

async function brevoError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return new Error(`Brevo API returned HTTP ${response.status}${body?.message ? `: ${body.message}` : ''}`);
}

/**
 * Brevo's transactional email API over HTTPS. Useful where outbound SMTP is blocked (as on some
 * hosting free tiers). The sender address must be verified in Brevo.
 */
export function brevoProvider(apiKey: string, timeoutMs = 15_000): EmailProvider {
  const headers = { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' };
  return {
    name: 'brevo',
    async send({ from, to, subject, text }) {
      const response = await fetch(`${BREVO_API}/smtp/email`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sender: parseAddress(from),
          to: to.map((email) => ({ email })),
          subject,
          textContent: text,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw await brevoError(response);
      const body = (await response.json().catch(() => ({}))) as { messageId?: string };
      return { messageId: body.messageId };
    },
    async verify() {
      const response = await fetch(`${BREVO_API}/account`, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw await brevoError(response);
    },
  };
}

/** Turns common provider failures into an actionable hint for the logs. */
export function describeEmailError(provider: EmailProvider['name'], err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  if (provider === 'brevo') {
    if (/HTTP 401/.test(e.message ?? '')) return 'Brevo rejected the API key: check BREVO_API_KEY';
    if (/sender/i.test(e.message ?? '')) {
      return `${e.message}. The SMTP_FROM address must be a verified sender in Brevo`;
    }
    return e.message ?? String(err);
  }
  if (e.code === 'EAUTH' || e.responseCode === 535) {
    return 'SMTP login rejected: check SMTP_USER/SMTP_PASSWORD (for Gmail, use an App Password)';
  }
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION' || e.code === 'ESOCKET') {
    return 'SMTP server unreachable: check SMTP_HOST/SMTP_PORT/SMTP_SECURE and that outbound SMTP is allowed';
  }
  if (e.code === 'EDNS' || e.code === 'ENOTFOUND') return 'SMTP_HOST could not be resolved';
  return e.message ?? String(err);
}

export type EmailStatus = 'disabled' | 'checking' | 'up' | 'error';

/**
 * Sends through the first provider that works, in order (e.g. SMTP, then Brevo as a fallback),
 * and keeps the latest outcome for health reporting.
 */
export class EmailDelivery {
  private status: EmailStatus;
  private lastProvider?: EmailProvider['name'];

  constructor(
    private readonly providers: EmailProvider[],
    private readonly logger: Logger,
  ) {
    this.status = providers.length > 0 ? 'checking' : 'disabled';
  }

  get enabled(): boolean {
    return this.providers.length > 0;
  }

  /** For /health: whether email works and which provider sent the latest message. */
  health(): Record<string, string> {
    return { email: this.status, ...(this.lastProvider && { emailProvider: this.lastProvider }) };
  }

  async send(email: OutgoingEmail): Promise<{ provider: EmailProvider['name']; messageId?: string }> {
    let lastError: unknown;
    for (const [index, provider] of this.providers.entries()) {
      try {
        const { messageId } = await provider.send(email);
        this.status = 'up';
        this.lastProvider = provider.name;
        return { provider: provider.name, messageId };
      } catch (err) {
        lastError = err;
        const fallback = this.providers[index + 1];
        this.logger.warn(
          fallback
            ? `Email via ${provider.name} failed; trying ${fallback.name}`
            : `Email via ${provider.name} failed`,
          {
            hint: describeEmailError(provider.name, err),
          },
        );
      }
    }
    this.status = 'error';
    throw lastError ?? new Error('No email provider is configured');
  }

  /** Checks every provider at start-up and logs the result; never throws. */
  async verify(): Promise<void> {
    if (!this.enabled) return;
    const results = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          await provider.verify();
          this.logger.info('Email provider verified', { provider: provider.name });
          return true;
        } catch (err) {
          this.logger.error('Email provider check failed', {
            provider: provider.name,
            hint: describeEmailError(provider.name, err),
          });
          return false;
        }
      }),
    );
    // A later send updates this; until then, email works if any provider does.
    if (this.status === 'checking') this.status = results.some(Boolean) ? 'up' : 'error';
  }
}
