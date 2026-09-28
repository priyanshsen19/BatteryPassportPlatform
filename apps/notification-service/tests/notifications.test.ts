import { createLogger, createPassportEvent, type PassportEvent } from '@bpp/shared';
import nodemailer from 'nodemailer';
import { EmailNotifier } from '../src/notifications/emailNotifier';
import { LogNotifier } from '../src/notifications/logNotifier';
import { buildNotification, type Notification, type Notifier } from '../src/notifications/notification';
import { NotificationDispatcher } from '../src/notifications/notificationDispatcher';

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

describe('EmailNotifier', () => {
  it('sends an email through the configured transport', async () => {
    const transporter = nodemailer.createTransport({ jsonTransport: true });
    const sendMail = jest.spyOn(transporter, 'sendMail');
    const event = createPassportEvent('passport.deleted', 'p-9');

    await new EmailNotifier(
      transporter,
      { from: 'from@example.com', to: 'ops@example.com' },
      silentLogger,
    ).send(buildNotification(event));

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@example.com',
        subject: 'Battery passport deleted',
        text: expect.stringContaining('Battery passport deleted: p-9'),
      }),
    );
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
