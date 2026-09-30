import {
  EmailDelivery,
  brevoProvider,
  createLogger,
  createPassportEvent,
  type EmailProvider,
  type OutgoingEmail,
  type PassportEvent,
} from '@bpp/shared';
import { EmailNotifier } from '../src/notifications/emailNotifier';
import { LogNotifier } from '../src/notifications/logNotifier';
import { buildNotification, type Notification, type Notifier } from '../src/notifications/notification';
import { NotificationDispatcher } from '../src/notifications/notificationDispatcher';
import { recipientsSchema } from '../src/notifications/recipients';

const silentLogger = createLogger('test', { silent: true });

describe('buildNotification', () => {
  it.each([
    ['passport.created', 'Battery passport created: p-1'],
    ['passport.updated', 'Battery passport updated: p-1'],
    ['passport.deleted', 'Battery passport deleted: p-1'],
  ] as const)('formats %s', (eventType, expected) => {
    expect(buildNotification(createPassportEvent(eventType, 'p-1')).message).toBe(expected);
  });
});

describe('LogNotifier', () => {
  it('writes a structured [Notification] log entry', async () => {
    const logger = createLogger('test', { silent: true });
    const info = jest.spyOn(logger, 'info');
    const event = createPassportEvent('passport.created', 'p-1');

    await new LogNotifier(logger).send(buildNotification(event));

    expect(info).toHaveBeenCalledWith(
      '[Notification] Battery passport created: p-1',
      expect.objectContaining({ eventId: event.eventId, eventType: 'passport.created', passportId: 'p-1' }),
    );
  });
});

const fakeProvider = (name: EmailProvider['name'], fail?: string) => {
  const sent: OutgoingEmail[] = [];
  const provider: EmailProvider = {
    name,
    async send(email) {
      if (fail) throw new Error(fail);
      sent.push(email);
      return { messageId: `${name}-1` };
    },
    async verify() {
      if (fail) throw new Error(fail);
    },
  };
  return { provider, sent };
};

describe('EmailNotifier', () => {
  const addresses = { from: 'BatteryPass <from@example.com>', to: ['ops@example.com', 'lead@example.com'] };
  const notification = buildNotification(createPassportEvent('passport.deleted', 'p-9'));

  it('sends one email to every recipient through the first provider', async () => {
    const smtp = fakeProvider('smtp');
    const brevo = fakeProvider('brevo');
    const delivery = new EmailDelivery([smtp.provider, brevo.provider], silentLogger);

    await new EmailNotifier(delivery, addresses, silentLogger).send(notification);

    expect(smtp.sent).toEqual([
      expect.objectContaining({
        to: ['ops@example.com', 'lead@example.com'],
        subject: 'Battery passport deleted',
        text: expect.stringContaining('Battery passport deleted: p-9'),
      }),
    ]);
    expect(brevo.sent).toHaveLength(0);
    expect(delivery.health()).toEqual({ email: 'up', emailProvider: 'smtp' });
  });

  it('falls back to Brevo when SMTP fails', async () => {
    const smtp = fakeProvider('smtp', 'Connection timeout');
    const brevo = fakeProvider('brevo');
    const delivery = new EmailDelivery([smtp.provider, brevo.provider], silentLogger);

    await new EmailNotifier(delivery, addresses, silentLogger).send(notification);

    expect(brevo.sent).toHaveLength(1);
    expect(delivery.health()).toEqual({ email: 'up', emailProvider: 'brevo' });
  });

  it('reports an error when every provider fails', async () => {
    const delivery = new EmailDelivery(
      [fakeProvider('smtp', 'Connection timeout').provider, fakeProvider('brevo', 'HTTP 401').provider],
      silentLogger,
    );

    await expect(new EmailNotifier(delivery, addresses, silentLogger).send(notification)).rejects.toThrow(
      'HTTP 401',
    );
    expect(delivery.health().email).toBe('error');
  });

  it('is up after start-up checks when any provider works', async () => {
    const delivery = new EmailDelivery(
      [fakeProvider('smtp', 'Connection timeout').provider, fakeProvider('brevo').provider],
      silentLogger,
    );
    expect(delivery.health().email).toBe('checking');
    await delivery.verify();
    expect(delivery.health().email).toBe('up');
  });
});

describe('Brevo provider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('posts the email to the Brevo API with the parsed sender', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ messageId: '<abc@brevo>' }), { status: 201 }));

    const result = await brevoProvider('key-123').send({
      from: 'BatteryPass <from@example.com>',
      to: ['ops@example.com', 'lead@example.com'],
      subject: 'Battery passport created',
      text: 'Hello',
    });

    expect(result.messageId).toBe('<abc@brevo>');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init?.headers as Record<string, string>)['api-key']).toBe('key-123');
    expect(JSON.parse(init?.body as string)).toEqual({
      sender: { name: 'BatteryPass', email: 'from@example.com' },
      to: [{ email: 'ops@example.com' }, { email: 'lead@example.com' }],
      subject: 'Battery passport created',
      textContent: 'Hello',
    });
  });

  it('turns an API error into a readable message', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Key not found' }), { status: 401 }));

    await expect(
      brevoProvider('bad').send({ from: 'a@example.com', to: ['b@example.com'], subject: 's', text: 't' }),
    ).rejects.toThrow('Brevo API returned HTTP 401: Key not found');
  });
});

describe('NOTIFICATION_EMAIL_TO', () => {
  it.each([
    ['ops@example.com', ['ops@example.com']],
    ['ops@example.com, lead@example.com', ['ops@example.com', 'lead@example.com']],
    [
      'ops@example.com;lead@example.com  qa@example.com',
      ['ops@example.com', 'lead@example.com', 'qa@example.com'],
    ],
    ['Ops@Example.com, ops@example.com,', ['ops@example.com']],
    ['', []],
    [undefined, []],
  ])('parses %p', (value, expected) => {
    expect(recipientsSchema.parse(value)).toEqual(expected);
  });

  it('rejects an invalid address', () => {
    expect(recipientsSchema.safeParse('ops@example.com, not-an-email').success).toBe(false);
  });
});

describe('NotificationDispatcher', () => {
  class RecordingNotifier implements Notifier {
    readonly channel = 'recording';
    received: Notification[] = [];
    async send(notification: Notification) {
      this.received.push(notification);
    }
  }

  class FailingNotifier implements Notifier {
    readonly channel = 'failing';
    async send(): Promise<void> {
      throw new Error('SMTP connection refused');
    }
  }

  it('delivers through every channel even if one fails', async () => {
    const recording = new RecordingNotifier();
    const event: PassportEvent = createPassportEvent('passport.updated', 'p-2');

    await expect(
      new NotificationDispatcher([new FailingNotifier(), recording], silentLogger).dispatch(event),
    ).resolves.toBeUndefined();
    expect(recording.received).toHaveLength(1);
    expect(recording.received[0].message).toBe('Battery passport updated: p-2');
  });
});
