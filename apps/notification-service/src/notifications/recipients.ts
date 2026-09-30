import { z } from 'zod';

/**
 * NOTIFICATION_EMAIL_TO as a list: addresses separated by commas, semicolons or spaces, e.g.
 * "ops@example.com, lead@example.com". Empty means email notifications are off.
 */
export const recipientsSchema = z
  .string()
  .optional()
  .transform((value) =>
    [...new Set((value ?? '').split(/[\s,;]+/).map((address) => address.trim().toLowerCase()))].filter(
      Boolean,
    ),
  )
  .pipe(z.array(z.email('NOTIFICATION_EMAIL_TO must contain valid email addresses, separated by commas')));
