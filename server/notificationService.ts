import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { notificationDeliveries, notificationPreferences, pushTokens, notifications } from '@shared/schema';
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
  sendRebookingNudgeEmail,
  sendBookingRequestReceivedEmail,
  sendIntakeSubmissionNotification,
} from './emailService';

export type NotificationEvent =
  | 'user.signup'
  | 'booking.created'
  | 'booking.updated'
  | 'booking.cancelled'
  | 'booking.rescheduled'
  | 'booking.reminder_24h'
  | 'booking.reminder_2h'
  | 'booking.request_received'
  | 'booking.request_provider'
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.reminder_3d'
  | 'invoice.overdue_1d'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'job.status_changed'
  | 'review.request'
  | 'rebook.prompt'
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
  description?: string;
  serviceDescription?: string;
  addOns?: string[];
  intakeAnswers?: string;
  oldDate?: string;
  oldTime?: string;
  reason?: string;
  preferredDate?: string;
  preferredTime?: string;
  bookingLinkName?: string;
  problemDescription?: string;
  // Invoice fields
  invoiceNumber?: string;
  amount?: number;
  dueDate?: string;
  paymentLink?: string;
  paymentDate?: string;
  paymentMethod?: string;
  lineItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  daysUntilDue?: number;
  daysOverdue?: number;
  // Job fields
  newStatus?: string;
  scheduledDate?: string;
  notes?: string;
  rebookLink?: string;
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
  'booking.request_received': 'emailBookingConfirmation',
  'booking.request_provider': 'emailBookingConfirmation',
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
  // Some events are exempt from the global gate because they use a non-default
  // recipient (e.g. providerUserId) or send to multiple recipients (client +
  // provider) and must be gated per-recipient inside the case block.
  const PER_RECIPIENT_GATED: NotificationEvent[] = [
    'booking.created',
    'booking.request_provider',
  ];
  if (!PER_RECIPIENT_GATED.includes(event)) {
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
      const { clientEmail, clientName, providerEmail, providerName, serviceName, appointmentDate, appointmentTime, address, estimatedPrice, confirmationNumber, description, serviceDescription, addOns, intakeAnswers } = payload;
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
          const result = await sendBookingConfirmationEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address, estimatedPrice, confirmationNumber, description, serviceDescription, addOns, intakeAnswers });
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
          const result = await sendProviderBookingNotificationEmail({ providerEmail, providerName, clientName, serviceName, appointmentDate, appointmentTime, address, description });
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
      if (!providerName || !serviceName || !newStatus) {
        console.log('[notification] job.status_changed skipped — missing provider/service/status');
        break;
      }

      // Step-specific push copy
      type PushCopy = { title: string; body: string };
      const pushCopy: Record<string, PushCopy> = {
        confirmed:   { title: 'Appointment confirmed', body: `${providerName} confirmed your ${serviceName} appointment.` },
        on_my_way:   { title: `${providerName} is on the way`, body: `Your ${serviceName} provider is heading to you now.` },
        arrived:     { title: `${providerName} has arrived`, body: `Your provider just arrived for your ${serviceName} appointment.` },
        in_progress: { title: 'Work has started', body: `${providerName} has started your ${serviceName}.` },
        completed:   { title: 'Service complete', body: `${providerName} finished your ${serviceName}. Thank you!` },
        cancelled:   { title: 'Appointment cancelled', body: `Your ${serviceName} with ${providerName} was cancelled.` },
      };
      const push = pushCopy[newStatus] ?? { title: 'Job update', body: `Your ${serviceName} status changed.` };

      // Email — requires client email + name, and respects email opt-out (gated
      // locally so that opting out of email still allows the push notification).
      if (clientEmail && clientName) {
        const [prefs] = payload.recipientUserId
          ? await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, payload.recipientUserId)).catch(() => [null])
          : [null];
        const emailOptedOut = prefs?.emailBookingConfirmation === false;

        if (emailOptedOut) {
          console.log(`[notification] job.status_changed(${newStatus}) email skipped — user ${payload.recipientUserId} opted out`);
        } else {
          const deliveryId = await logDelivery({
            channel: 'email', status: 'queued', eventType: event,
            recipientEmail: clientEmail,
            recipientUserId: payload.recipientUserId,
            relatedRecordType: payload.relatedRecordType,
            relatedRecordId: payload.relatedRecordId,
          });
          try {
            const result = await sendJobStatusChangedEmail({ clientEmail, clientName, providerName, serviceName, newStatus, scheduledDate, notes });
            await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
            console.log(`[notification] job.status_changed(${newStatus}) email ${result.success ? 'sent' : 'failed'} to ${clientEmail}`);
          } catch (err: any) {
            await updateDelivery(deliveryId, 'failed', undefined, err?.message);
            console.error(`[notification] job.status_changed(${newStatus}) email error:`, err);
          }
        }
      } else {
        console.log(`[notification] job.status_changed(${newStatus}) email skipped — no client email/name`);
      }

      // Push — requires linked homeowner user
      if (payload.recipientUserId) {
        try {
          await dispatchNotification(
            payload.recipientUserId,
            push.title,
            push.body,
            'job.status_changed',
            {
              jobId: payload.relatedRecordId,
              newStatus,
              providerName,
              serviceName,
              screen: 'ProviderJobDetail',
            },
            'bookings',
          );
          console.log(`[notification] job.status_changed(${newStatus}) push dispatched to user ${payload.recipientUserId}`);
        } catch (err) {
          console.error(`[notification] job.status_changed(${newStatus}) push error:`, err);
        }
      } else {
        console.warn(`[notification] job.status_changed(${newStatus}) push skipped — client has no linked homeowner user (recipientUserId missing)`);
      }
      break;
    }

    case 'booking.request_received': {
      const { clientEmail, clientName, providerName, serviceName, preferredDate, preferredTime, address, problemDescription } = payload;
      if (!clientEmail || !clientName || !providerName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendBookingRequestReceivedEmail({
        clientEmail,
        clientName,
        providerName,
        serviceName,
        preferredDate,
        preferredTime,
        address,
        description: problemDescription,
        confirmationNumber: payload.relatedRecordId,
      });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'booking.request_provider': {
      const { providerEmail, providerName, clientName, clientEmail, clientPhone, address, problemDescription, bookingLinkName } = payload;
      if (!providerEmail || !providerName || !clientName || !problemDescription) break;
      // Gate on the provider's own preferences (uses providerUserId, not recipientUserId)
      const providerEmailOk = await isEmailAllowed(event, payload.providerUserId);
      if (!providerEmailOk) {
        console.log(`[notification] Skipped ${event} for provider user ${payload.providerUserId} (preference opt-out)`);
        break;
      }
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: providerEmail,
        recipientUserId: payload.providerUserId,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendIntakeSubmissionNotification({
        providerEmail,
        providerName,
        clientName,
        clientEmail,
        clientPhone,
        address,
        problemDescription,
        bookingLinkName,
      });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      break;
    }

    case 'rebook.prompt': {
      const { clientEmail, clientName, providerName, serviceName, rebookLink } = payload;
      if (!clientEmail || !clientName || !providerName || !serviceName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendRebookingNudgeEmail({ clientEmail, clientName, providerName, serviceName, rebookLink });
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

// ─── Push Notification Functions ───────────────────────────────────────────

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

interface ExpoPushResponse {
  data: Array<{
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: Record<string, unknown>;
  }>;
}

async function sendExpoPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error('Expo push API error:', response.status, await response.text());
      return;
    }

    const result = (await response.json()) as ExpoPushResponse;
    for (const ticket of result.data || []) {
      if (ticket.status === 'error') {
        console.error('Push notification error:', ticket.message, ticket.details);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          console.log('Device not registered, token should be cleaned up');
        }
      }
    }
  } catch (err) {
    console.error('Failed to send push notifications:', err);
  }
}

type NotificationCategory = 'bookings' | 'invoices' | 'messages' | 'reminders';

export async function sendPush(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
  _category: NotificationCategory = 'bookings'
): Promise<void> {
  try {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    if (prefs && prefs.pushEnabled === false) {
      return;
    }

    const tokens = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)));

    if (tokens.length === 0) return;

    const messages: PushMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data,
      sound: 'default',
    }));

    await sendExpoPushNotifications(messages);
  } catch (err) {
    console.error('sendPush error:', err);
  }
}

export async function dispatchNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  data: Record<string, unknown> = {},
  category: NotificationCategory = 'bookings'
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId,
      title,
      message,
      type,
      isRead: false,
      data: JSON.stringify(data),
    });

    await sendPush(userId, title, message, data, category);
  } catch (err) {
    console.error('dispatchNotification error:', err);
  }
}
