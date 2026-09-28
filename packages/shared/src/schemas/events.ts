import { z } from 'zod';

/** Single topic carrying every passport lifecycle event; consumers route on `eventType`. */
export const PASSPORT_EVENTS_TOPIC = 'battery-passport-events';

export const PASSPORT_EVENT_TYPES = ['passport.created', 'passport.updated', 'passport.deleted'] as const;
export type PassportEventType = (typeof PASSPORT_EVENT_TYPES)[number];

export const passportEventSchema = z.object({
  eventId: z.uuid(),
  eventType: z.enum(PASSPORT_EVENT_TYPES),
  version: z.literal(1),
  timestamp: z.iso.datetime(),
  data: z.object({
    passportId: z.string().min(1),
  }),
});

export type PassportEvent = z.infer<typeof passportEventSchema>;
