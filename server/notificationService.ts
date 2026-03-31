import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { notificationDeliveries, notificationPreferences } from '@shared/schema';
import {
  sendWelcomeEmail,
  sendBookingConfirmationEmail,
  sendBookingReminderEmail,
  sendBookingCancelledEmail,
  sendBookingRescheduledEmail,
  sendInvoiceEmail,
  sendInvoiceCreatedEmail,
  sendInvoiceReminderEmail,
  sendInvoicePaidEmail,
  sendPaymentFailedEmail,
  sendReviewRequestEmail,
  sendStripeOnboardingNeededEmail,
  sendStripeConnectedEmail,
  sendProviderBookingNotificationEmail,
  sendJobStatusChangedEmail,
} from './emailService';

export type NotificationEvent =
  | 'user.signup'
  | 'booking.created'
  | 'booking.updated'
  | 'booking.cancelled'
  | 'booking.rescheduled'
  | 'booking.reminder_24h'
  | 'booking.reminder_2h'
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.reminder_3d'
  | 'invoice.overdue_1d'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'job.status_changed'
  | 'review.request'
  | 'stripe.onboarding_needed'
  | 'stripe.connected';

export interface DispatchPayload {
  recipientUserId?: string;
  providerUserId?: string;
  recipientEmail?: string;
  relatedRecordType?: string;
  relatedRecordId?: string;
  // Email addressing
  clientEmail?: string;
  clientName?: string;
  clientPhone?: string;
  recipientPhone?: string;
  providerEmail?: string;
  providerName?: string;
  // Booking fields
  serviceName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  address?: string;
  estimatedPrice?: number;
  confirmationNumber?: string;
  oldDate?: string;
  oldTime?: string;
  reason?: string;
  // Invoice fields
  invoiceNumber?: string;
  amount?: number;
  dueDate?: string;
  paymentLink?: string;
  paymentDate?: string;
  lineItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  daysUntilDue?: number;
  daysOverdue?: number;
  // Job fields
  newStatus?: string;
  scheduledDate?: string;
  notes?: string;
  // Auth/onboarding fields
  onboardingUrl?: string;
  // Review fields
  reviewUrl?: string;
}

async function logDelivery(opts: {
  channel: 'email' | 'push' | 'in_app' | 'sms';
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'pending_sms';
  eventType: string;
  recipientUserId?: string;
  recipientEmail?: string;
  relatedRecordType?: string;
  relatedRecordId?: string;
  externalMessageId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  try {
    const [row] = await db.insert(notificationDeliveries).values({
      channel: opts.channel,
      status: opts.status,
      eventType: opts.eventType,
      recipientUserId: opts.recipientUserId ?? null,
      recipientEmail: opts.recipientEmail ?? null,
      relatedRecordType: opts.relatedRecordType ?? null,
      relatedRecordId: opts.relatedRecordId ?? null,
      externalMessageId: opts.externalMessageId ?? null,
      error: opts.error ?? null,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
    }).returning();
    return row.id;
  } catch (err) {
    console.error('Failed to log notification delivery:', err);
    return '';
  }
}

async function updateDelivery(id: string, status: 'sent' | 'failed', externalMessageId?: string, error?: string): Promise<void> {
  if (!id) return;
  try {
    await db.update(notificationDeliveries)
      .set({ status, externalMessageId: externalMessageId ?? null, error: error ?? null, updatedAt: new Date() })
      .where(eq(notificationDeliveries.id, id));
  } catch (err) {
    console.error('Failed to update notification delivery:', err);
  }
}

const EVENT_PREF_FIELD: Partial<Record<NotificationEvent, keyof typeof notificationPreferences.$inferSelect>> = {
  'booking.created':      'emailBookingConfirmation',
  'booking.updated':      'emailBookingConfirmation',
  'booking.cancelled':    'emailBookingCancelled',
  'booking.rescheduled':  'emailBookingConfirmation',
  'booking.reminder_24h': 'emailBookingReminder',
  'booking.reminder_2h':  'emailBookingReminder',
  'invoice.sent':         'emailInvoiceCreated',
  'invoice.reminder_3d':  'emailInvoiceReminder',
  'invoice.overdue_1d':   'emailInvoiceReminder',
  'invoice.paid':         'emailInvoicePaid',
  'invoice.payment_failed': 'emailPaymentFailed',
  'review.request':       'emailReviewRequest',
};

async function isEmailAllowed(event: NotificationEvent, recipientUserId?: string): Promise<boolean> {
  const prefField = EVENT_PREF_FIELD[event];
  if (!prefField || !recipientUserId) return true;
  try {
    const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, recipientUserId));
    if (!prefs) return true;
    const allowed = prefs[prefField];
    return allowed !== false;
  } catch {
    return true;
  }
}

export async function dispatch(event: NotificationEvent, payload: DispatchPayload): Promise<void> {
  try {
    await _dispatch(event, payload);
  } catch (err) {
    console.error(`Notification dispatch failed for event ${event}:`, err);
  }
}

export async function dispatchWithResult(event: NotificationEvent, payload: DispatchPayload): Promise<{ emailSent: boolean; emailError?: string }> {
  try {
    const result = await _dispatch(event, payload);
    return result ?? { emailSent: false, emailError: 'No email send attempted for this event' };
  } catch (err: any) {
    console.error(`Notification dispatch failed for event ${event}:`, err);
    return { emailSent: false, emailError: err?.message || 'Email send failed' };
  }
}

async function _dispatch(event: NotificationEvent, payload: DispatchPayload): Promise<{ emailSent: boolean; emailError?: string } | null> {
  // Check user notification preferences before dispatching email.
  // booking.created is exempt from the global gate because it sends to multiple recipients
  // (client + provider) and each must be gated independently inside the case block.
  if (event !== 'booking.created') {
    const emailOk = await isEmailAllowed(event, payload.recipientUserId);
    if (!emailOk) {
      console.log(`[notification] Skipped ${event} for user ${payload.recipientUserId} (preference opt-out)`);
      return { emailSent: false, emailError: 'Opted out of this notification type' };
    }
  }

  switch (event) {
    case 'user.signup': {
      if (!payload.recipientEmail || !payload.clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email',
        status: 'queued',
        eventType: event,
        recipientUserId: payload.recipientUserId,
        recipientEmail: payload.recipientEmail,
      });
      const result = await sendWelcomeEmail(payload.recipientEmail, payload.clientName);
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'booking.updated': {
      const { clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendBookingConfirmationEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address: payload.address, estimatedPrice: payload.estimatedPrice, confirmationNumber: payload.relatedRecordId });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'booking.created': {
      const { clientEmail, clientName, providerEmail, providerName, serviceName, appointmentDate, appointmentTime, address, estimatedPrice, confirmationNumber } = payload;
      // Client confirmation — gate on client's notification preferences
      if (clientEmail && clientName && providerName) {
        const clientEmailOk = await isEmailAllowed(event, payload.recipientUserId);
        if (clientEmailOk) {
          const deliveryId = await logDelivery({
            channel: 'email', status: 'queued', eventType: event,
            recipientEmail: clientEmail,
            recipientUserId: payload.recipientUserId,
            relatedRecordType: payload.relatedRecordType,
            relatedRecordId: payload.relatedRecordId,
          });
          const result = await sendBookingConfirmationEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address, estimatedPrice, confirmationNumber });
          await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
        }
      }
      // Provider notification — always send regardless of client opt-out; gate on provider preferences
      if (providerEmail && providerName && clientName) {
        const providerEmailOk = await isEmailAllowed(event, payload.providerUserId);
        if (providerEmailOk) {
          const deliveryId = await logDelivery({
            channel: 'email', status: 'queued', eventType: `${event}.provider`,
            recipientEmail: providerEmail,
            recipientUserId: payload.providerUserId,
            relatedRecordType: payload.relatedRecordType,
            relatedRecordId: payload.relatedRecordId,
          });
          const result = await sendProviderBookingNotificationEmail({ providerEmail, providerName, clientName, serviceName, appointmentDate, appointmentTime, address });
          await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
        }
      }
      break;
    }

    case 'booking.cancelled': {
      const { clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address, reason } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendBookingCancelledEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address }, reason);
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'booking.rescheduled': {
      const { clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address, oldDate, oldTime } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendBookingRescheduledEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address }, oldDate, oldTime);
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'booking.reminder_24h':
    case 'booking.reminder_2h': {
      const { clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address } = payload;
      if (!clientEmail || !clientName) break;
      const hours = event === 'booking.reminder_2h' ? 2 : 24;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendBookingReminderEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address }, hours);
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'invoice.created': {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, dueDate } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: 'invoice',
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendInvoiceCreatedEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, lineItems: payload.lineItems || [] });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'invoice.sent': {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, lineItems, paymentLink } = payload;
      if (!clientEmail || !clientName) {
        return { emailSent: false, emailError: 'Missing client email or name' };
      }
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: 'invoice',
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendInvoiceEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, lineItems: lineItems || [], paymentLink });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      return { emailSent: result.success, emailError: result.error };
    }

    case 'invoice.reminder_3d': {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, paymentLink, daysUntilDue } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: 'invoice',
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendInvoiceReminderEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, paymentLink, daysUntilDue });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'invoice.overdue_1d': {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, paymentLink, daysOverdue } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: 'invoice',
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendInvoiceReminderEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, paymentLink, daysOverdue });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'invoice.paid': {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, paymentDate, paymentMethod } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: 'invoice',
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendInvoicePaidEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, paymentDate, paymentMethod });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'invoice.payment_failed': {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, paymentLink } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: 'invoice',
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendPaymentFailedEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, paymentLink });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'review.request': {
      const { clientEmail, clientName, providerName, serviceName, reviewUrl } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendReviewRequestEmail({ clientEmail, clientName, providerName, serviceName, reviewUrl });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'stripe.onboarding_needed': {
      const { recipientEmail, providerName, onboardingUrl } = payload;
      if (!recipientEmail || !providerName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail,
        recipientUserId: payload.recipientUserId,
      });
      const result = await sendStripeOnboardingNeededEmail(recipientEmail, providerName, onboardingUrl || 'https://homebaseproapp.com');
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'stripe.connected': {
      const { recipientEmail, providerName } = payload;
      if (!recipientEmail || !providerName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail,
        recipientUserId: payload.recipientUserId,
      });
      const result = await sendStripeConnectedEmail(recipientEmail, providerName);
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'job.status_changed': {
      const { clientEmail, clientName, providerName, serviceName, newStatus, scheduledDate, notes } = payload;
      if (!clientEmail || !clientName || !providerName || !serviceName || !newStatus) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendJobStatusChangedEmail({ clientEmail, clientName, providerName, serviceName, newStatus, scheduledDate, notes });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    default:
      console.warn(`Unknown notification event: ${event}`);
  }

  // SMS placeholder — log queued SMS delivery record for transactional events so future
  // SMS providers (Twilio, etc.) can pick up unprocessed rows from notification_deliveries.
  const SMS_PLACEHOLDER_EVENTS: NotificationEvent[] = [
    'booking.created', 'booking.cancelled', 'booking.reminder_24h',
    'invoice.paid', 'job.status_changed',
  ];
  if (SMS_PLACEHOLDER_EVENTS.includes(event) && (payload.clientPhone || payload.recipientPhone)) {
    await logDelivery({
      channel: 'sms',
      status: 'pending_sms',
      eventType: event,
      recipientUserId: payload.recipientUserId,
      relatedRecordType: payload.relatedRecordType,
      relatedRecordId: payload.relatedRecordId,
      metadata: { phone: payload.clientPhone || payload.recipientPhone },
    });
  }

  return null;
}

export async function hasDeliveryForRecord(
  eventType: string,
  relatedRecordId: string,
  channel: 'email' | 'push' | 'in_app' | 'sms' = 'email'
): Promise<boolean> {
  try {
    const rows = await db.select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.eventType, eventType),
          eq(notificationDeliveries.relatedRecordId, relatedRecordId),
          eq(notificationDeliveries.channel, channel),
          eq(notificationDeliveries.status, 'sent'),
        )
      )
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}
