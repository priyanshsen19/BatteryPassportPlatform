import type { PassportEvent, PassportEventType } from '@bpp/shared';

export interface Notification {
  subject: string;
  message: string;
  event: PassportEvent;
}

/** A delivery channel (structured log, email, ...). */
export interface Notifier {
  readonly channel: string;
  send(notification: Notification): Promise<void>;
}

const ACTIONS: Record<PassportEventType, string> = {
  'passport.created': 'created',
  'passport.updated': 'updated',
  'passport.deleted': 'deleted',
};

export function buildNotification(event: PassportEvent): Notification {
  const action = ACTIONS[event.eventType];
  return {
    subject: `Battery passport ${action}`,
    message: `Battery passport ${action}: ${event.data.passportId}`,
    event,
  };
}
