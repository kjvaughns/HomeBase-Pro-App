import { db, pool } from './db';
import { eq, and } from 'drizzle-orm';
import { notificationDeliveries, notificationPreferences, pushTokens, notifications, appointments, reviews, users, providers } from '@workspace/db';
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
  sendReviewReplyEmail,
  sendStripeOnboardingNeededEmail,
  sendStripeConnectedEmail,
  sendProviderBookingNotificationEmail,
  sendJobStatusChangedEmail,
  sendRebookingNudgeEmail,
  sendBookingRequestReceivedEmail,
  sendIntakeSubmissionNotification,
  sendSubscriptionGraceStartEmail,
  sendSubscriptionGraceReminderEmail,
  sendSubscriptionExpiredEmail,
  sendEstimateEmail,
  sendEstimateDecisionEmail,
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
  | 'review.reply'
  | 'rebook.prompt'
  | 'stripe.onboarding_needed'
  | 'stripe.connected'
  | 'subscription.grace_start'
  | 'subscription.grace_reminder'
  | 'subscription.expired'
  | 'estimate.sent'
  | 'estimate.accepted'
  | 'estimate.declined'
  | 'estimate.expired'
  | 'referral.reward_earned'
  | 'crew.launched_own_business';

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
  scheduledTime?: string;
  wasRescheduled?: boolean;
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

export async function logDelivery(opts: {
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

/**
 * Atomically claim the right to send a notification identified by
 * (eventType, dedupKey, channel). Uses an INSERT … ON CONFLICT DO NOTHING
 * against the notification_dedup_claims table whose PRIMARY KEY is
 * (event_type, dedup_key, channel).
 *
 * Returns true  → this caller won the race; it MUST dispatch and then call
 *                 logDelivery to record the outcome.
 * Returns false → another handler already claimed this slot; skip dispatch.
 *
 * Typical dedup key: the Stripe PaymentIntent id (shared across concurrent
 * payment_intent.succeeded and invoice.paid webhooks for the same payment).
 *
 * Task #246 — prevents duplicate payment push/email notifications.
 */
export async function claimNotificationDelivery(
  eventType: string,
  dedupKey: string,
  channel: 'email' | 'push' | 'in_app' | 'sms',
): Promise<boolean> {
  try {
    const result = await pool.query(
      `INSERT INTO notification_dedup_claims (event_type, dedup_key, channel)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING 1 AS claimed`,
      [eventType, dedupKey, channel],
    );
    return result.rowCount !== null && result.rowCount > 0;
  } catch (err) {
    // If the table doesn't exist yet (migration not yet applied), fall back to
    // allowing the dispatch rather than silently dropping the notification.
    console.error('[claimNotificationDelivery] dedup claim failed — allowing dispatch:', err);
    return true;
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
  'review.reply':         'emailReviewRequest',
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

    // ── Task #296: Estimate events ────────────────────────────────────
    case 'estimate.sent': {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, lineItems, paymentLink } = payload;
      if (!clientEmail || !clientName) {
        return { emailSent: false, emailError: 'Missing client email or name' };
      }
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: 'estimate',
        relatedRecordId: payload.relatedRecordId,
      });
      // Reuses the invoice-shaped fields: invoiceNumber=estimateNumber,
      // dueDate=expiresAt, paymentLink=public viewer URL.
      const result = await sendEstimateEmail({
        clientEmail, clientName, providerName,
        estimateNumber: invoiceNumber || '',
        amount: amount || 0,
        expiresAt: dueDate,
        lineItems: lineItems || [],
        viewerUrl: paymentLink || '',
      });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      return { emailSent: result.success, emailError: result.error };
    }

    case 'estimate.accepted':
    case 'estimate.declined':
    case 'estimate.expired': {
      const { clientEmail, clientName, providerEmail, providerName, invoiceNumber, amount } = payload;
      // Notify the PROVIDER (decision/expiry concerns them).
      const recipient = providerEmail;
      if (!recipient) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: recipient,
        relatedRecordType: 'estimate',
        relatedRecordId: payload.relatedRecordId,
      });
      const decision: 'accepted' | 'declined' | 'expired' =
        event === 'estimate.accepted' ? 'accepted'
        : event === 'estimate.declined' ? 'declined'
        : 'expired';
      const result = await sendEstimateDecisionEmail({
        recipientEmail: recipient,
        recipientName: providerName || 'there',
        clientName: clientName || 'Your client',
        estimateNumber: invoiceNumber || '',
        amount: amount || 0,
        decision,
      });
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

    case 'review.reply': {
      const { clientEmail, clientName, providerName, serviceName, reviewUrl, description } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientEmail: clientEmail,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendReviewReplyEmail({ clientEmail, clientName, providerName, serviceName, replyText: description || '', reviewUrl });
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
      const { clientEmail, clientName, providerName, serviceName, newStatus, scheduledDate, scheduledTime, wasRescheduled, notes } = payload;
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
        weather_held:{ title: 'Weather hold',           body: `Weather is moving us — ${providerName} placed your ${serviceName} on hold and will reschedule shortly.` },
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
            const result = await sendJobStatusChangedEmail({ clientEmail, clientName, providerName, serviceName, newStatus, scheduledDate, scheduledTime, wasRescheduled, notes });
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

    case 'subscription.grace_start': {
      if (!payload.recipientEmail) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientUserId: payload.recipientUserId,
        recipientEmail: payload.recipientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendSubscriptionGraceStartEmail({
        to: payload.recipientEmail,
        providerName: payload.providerName || 'there',
      });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      // Also log a push delivery row for dedup against hasDeliveryForRecord(..., 'push')
      await logDelivery({
        channel: 'push', status: 'sent', eventType: event,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      break;
    }

    case 'subscription.grace_reminder': {
      if (!payload.recipientEmail) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientUserId: payload.recipientUserId,
        recipientEmail: payload.recipientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendSubscriptionGraceReminderEmail({
        to: payload.recipientEmail,
        providerName: payload.providerName || 'there',
        daysRemaining: payload.daysUntilDue ?? 2,
      });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      await logDelivery({
        channel: 'push', status: 'sent', eventType: event,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      break;
    }

    case 'subscription.expired': {
      if (!payload.recipientEmail) break;
      const deliveryId = await logDelivery({
        channel: 'email', status: 'queued', eventType: event,
        recipientUserId: payload.recipientUserId,
        recipientEmail: payload.recipientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
      const result = await sendSubscriptionExpiredEmail({
        to: payload.recipientEmail,
        providerName: payload.providerName || 'there',
      });
      await updateDelivery(deliveryId, result.success ? 'sent' : 'failed', result.messageId, result.error);
      await logDelivery({
        channel: 'push', status: 'sent', eventType: event,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId,
      });
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

    // Defense in depth: even with the (user_id, token) unique constraint in
    // place, dedupe here so any straggler duplicates can never produce more
    // than one push per physical device. (See Task #143.)
    const uniqueTokens = Array.from(new Set(tokens.map((t) => t.token)));

    const messages: PushMessage[] = uniqueTokens.map((token) => ({
      to: token,
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

const REVIEW_NUDGE_EVENT = 'review.nudge';
const REVIEW_NUDGE_REVIEWABLE_STATUSES = new Set([
  'completed',
  'paid',
  'closed',
  'awaiting_payment',
]);

/**
 * Sends a one-time push + email nudging the homeowner to leave a review for
 * a completed appointment. Safe to call multiple times — it is deduped by a
 * sent push delivery row keyed on the appointment id.
 *
 * Skipped when:
 *   - the appointment is missing or cancelled
 *   - the appointment is not in a reviewable state
 *   - the homeowner has already left a review
 *   - a nudge has already been delivered for this appointment
 */
export async function sendReviewNudge(appointmentId: string): Promise<void> {
  try {
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!appointment) return;
    if (appointment.status === 'cancelled') return;
    if (!REVIEW_NUDGE_REVIEWABLE_STATUSES.has(appointment.status || '')) return;

    const [existingReview] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.appointmentId, appointmentId))
      .limit(1);
    if (existingReview) return;

    const alreadyNudged = await hasDeliveryForRecord(
      REVIEW_NUDGE_EVENT,
      appointmentId,
      'push',
    );
    if (alreadyNudged) return;

    const [homeowner] = await db
      .select()
      .from(users)
      .where(eq(users.id, appointment.userId))
      .limit(1);
    const [provider] = appointment.providerId
      ? await db
          .select()
          .from(providers)
          .where(eq(providers.id, appointment.providerId))
          .limit(1)
      : [null];

    const providerName = provider?.businessName || 'your provider';
    const serviceName = appointment.serviceName || 'your service';
    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      (process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'https://homebaseproapp.com');
    const reviewUrl = `${baseUrl}/open-app?path=review&jobId=${encodeURIComponent(appointmentId)}`;

    // In-app push (this is also what we dedupe against)
    if (homeowner) {
      try {
        await dispatchNotification(
          homeowner.id,
          `How was your ${serviceName}?`,
          `Tell ${providerName} how it went — your review only takes a minute.`,
          REVIEW_NUDGE_EVENT,
          {
            screen: 'Review',
            params: { appointmentId },
            appointmentId,
            providerId: appointment.providerId,
            reviewUrl,
          },
          'reminders',
        );
        // Persist a "sent" push delivery row keyed on the appointment so the
        // dedup check above sees it on subsequent calls. dispatchNotification
        // does not log into notification_deliveries on its own.
        await logDelivery({
          channel: 'push',
          status: 'sent',
          eventType: REVIEW_NUDGE_EVENT,
          recipientUserId: homeowner.id,
          relatedRecordType: 'appointment',
          relatedRecordId: appointmentId,
        });
      } catch (err) {
        console.error('[review.nudge] push error:', err);
      }
    }

    // Email companion (best-effort, respects user notification prefs)
    if (homeowner?.email) {
      const clientName =
        `${homeowner.firstName || ''} ${homeowner.lastName || ''}`.trim() ||
        homeowner.email;
      try {
        await dispatch('review.request', {
          clientEmail: homeowner.email,
          clientName,
          providerName,
          serviceName,
          reviewUrl,
          recipientUserId: homeowner.id,
          relatedRecordType: 'appointment',
          relatedRecordId: appointmentId,
        });
      } catch (err) {
        console.error('[review.nudge] email error:', err);
      }
    }
  } catch (err) {
    console.error('sendReviewNudge error:', err);
  }
}
