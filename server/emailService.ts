import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Resend authentication token not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected - please set up the Resend integration');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

function fmtUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function buildEmailBase(title: string, body: string, ctaLabel?: string, ctaUrl?: string): string {
  const ctaHtml = ctaLabel && ctaUrl
    ? `<a href="${ctaUrl}" style="display:block;background:#38AE5F;color:#fff;text-align:center;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin:24px 0;">${ctaLabel}</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background-color:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
      <!-- Header -->
      <div style="background:#38AE5F;padding:28px 32px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px;">HomeBase</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">The smart way to manage home services</div>
      </div>
      <!-- Body -->
      <div style="padding:32px;">
        ${body}
        ${ctaHtml}
      </div>
      <!-- Footer -->
      <div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:11px;margin:0 0 4px;">Sent via HomeBase &mdash; The smart way to manage home services</p>
        <p style="color:#d1d5db;font-size:10px;margin:0;">You are receiving this because you have an account or transaction on HomeBase. <a href="#" style="color:#9ca3af;">Unsubscribe</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;margin-bottom:10px;">
    <span style="color:#6b7280;font-size:14px;">${label}</span>
    <span style="color:#111827;font-weight:600;font-size:14px;">${value}</span>
  </div>`;
}

function infoBox(rows: string): string {
  return `<div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">${rows}</div>`;
}

function greeting(name: string): string {
  return `<p style="color:#374151;font-size:16px;margin:0 0 20px;">Hi ${name},</p>`;
}

function paragraph(text: string): string {
  return `<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 20px;">${text}</p>`;
}

function appDownloadSection(): string {
  return `<div style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border-radius:8px;padding:20px;margin-top:24px;text-align:center;">
    <p style="color:#166534;font-weight:600;margin:0 0 6px;font-size:14px;">Manage your home services with HomeBase</p>
    <p style="color:#15803d;font-size:13px;margin:0 0 14px;">Track invoices, book services, and get instant quotes &mdash; all in one app.</p>
    <div>
      <a href="https://apps.apple.com/app/homebase" style="display:inline-block;background:#111827;color:#fff;padding:9px 18px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500;margin:0 4px;">App Store</a>
      <a href="https://play.google.com/store/apps/details?id=com.homebase" style="display:inline-block;background:#111827;color:#fff;padding:9px 18px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500;margin:0 4px;">Google Play</a>
    </div>
  </div>`;
}

type SendResult = { success: boolean; messageId?: string; error?: string };

async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  try {
    const { client, fromEmail } = await getResendClient();
    const result = await client.emails.send({
      from: fromEmail || 'HomeBase <noreply@resend.dev>',
      to,
      subject,
      html,
    });
    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }
    return { success: true, messageId: result.data?.id };
  } catch (err: any) {
    console.error('sendEmail error:', err);
    return { success: false, error: err.message || 'Failed to send email' };
  }
}

// ─── Account / Auth templates ──────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string): Promise<SendResult> {
  const body = greeting(name) +
    paragraph('Welcome to HomeBase! We\'re thrilled to have you. HomeBase helps you manage your home services, track invoices, and connect with trusted providers &mdash; all in one place.') +
    `<h2 style="color:#111827;font-size:18px;margin:0 0 12px;">What you can do</h2>` +
    `<ul style="color:#6b7280;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
      <li>Book local service providers</li>
      <li>Manage invoices and payments</li>
      <li>Track your home maintenance history</li>
      <li>Get smart reminders for recurring services</li>
    </ul>` +
    appDownloadSection();
  return sendEmail(to, 'Welcome to HomeBase!', buildEmailBase('Welcome to HomeBase', body, 'Open HomeBase', 'https://homebaseproapp.com'));
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<SendResult> {
  const body = greeting(name) +
    paragraph('You requested a password reset for your HomeBase account. Click the button below to set a new password. This link expires in 1 hour.') +
    paragraph('If you did not request this, you can safely ignore this email. Your password will not change.');
  return sendEmail(to, 'Reset your HomeBase password', buildEmailBase('Password Reset', body, 'Reset Password', resetUrl));
}

export async function sendEmailVerificationEmail(to: string, name: string, verifyUrl: string): Promise<SendResult> {
  const body = greeting(name) +
    paragraph('Thanks for signing up! Please verify your email address to activate your HomeBase account.') +
    paragraph('This verification link expires in 24 hours.');
  return sendEmail(to, 'Verify your HomeBase email', buildEmailBase('Verify Email', body, 'Verify Email Address', verifyUrl));
}

export async function sendProviderOnboardingCompleteEmail(to: string, providerName: string): Promise<SendResult> {
  const body = greeting(providerName) +
    paragraph('Congratulations! Your HomeBase provider account is fully set up and active. You can now accept bookings, send invoices, and grow your business.') +
    `<div style="background:#f0fdf4;border-radius:8px;padding:20px;margin-bottom:20px;border-left:4px solid #38AE5F;">
      <p style="color:#166534;font-weight:600;margin:0 0 6px;">You\'re ready to go</p>
      <p style="color:#15803d;font-size:13px;margin:0;">Share your booking link, manage your schedule, and get paid faster with HomeBase.</p>
    </div>` +
    appDownloadSection();
  return sendEmail(to, 'Your HomeBase provider account is ready', buildEmailBase('Provider Account Ready', body));
}

// ─── Booking templates ─────────────────────────────────────────────────────────

interface BookingData {
  clientEmail: string;
  clientName: string;
  providerName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  address?: string;
  estimatedPrice?: number;
  confirmationNumber?: string;
}

export async function sendBookingConfirmationEmail(data: BookingData): Promise<SendResult> {
  const priceRow = data.estimatedPrice ? infoRow('Est. Price', fmtUsd(data.estimatedPrice)) : '';
  const body = greeting(data.clientName) +
    paragraph('Great news! Your service appointment has been confirmed. Here are your booking details:') +
    infoBox(
      (data.confirmationNumber ? infoRow('Confirmation #', data.confirmationNumber) : '') +
      infoRow('Service', data.serviceName) +
      infoRow('Provider', data.providerName) +
      infoRow('Date', data.appointmentDate) +
      infoRow('Time', data.appointmentTime) +
      (data.address ? infoRow('Location', data.address) : '') +
      priceRow
    ) +
    `<div style="background:#fffbeb;border-radius:8px;padding:14px 16px;margin-bottom:20px;border-left:4px solid #f59e0b;">
      <p style="color:#92400e;font-size:13px;margin:0;"><strong>Need to reschedule?</strong> Contact ${data.providerName} at least 24 hours before your appointment.</p>
    </div>` +
    appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Booking Confirmed: ${data.serviceName} with ${data.providerName}`,
    buildEmailBase('Booking Confirmed', body)
  );
}

export async function sendBookingReminderEmail(data: BookingData, hoursUntil: number): Promise<SendResult> {
  const label = hoursUntil <= 2 ? 'in 2 hours' : 'tomorrow';
  const body = greeting(data.clientName) +
    paragraph(`This is a reminder that your appointment is coming up ${label}. Here are the details:`) +
    infoBox(
      infoRow('Service', data.serviceName) +
      infoRow('Provider', data.providerName) +
      infoRow('Date', data.appointmentDate) +
      infoRow('Time', data.appointmentTime) +
      (data.address ? infoRow('Location', data.address) : '')
    ) +
    appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Reminder: ${data.serviceName} with ${data.providerName} ${label}`,
    buildEmailBase('Appointment Reminder', body)
  );
}

export async function sendBookingCancelledEmail(data: BookingData, reason?: string): Promise<SendResult> {
  const body = greeting(data.clientName) +
    paragraph(`Your ${data.serviceName} appointment with ${data.providerName} has been cancelled.`) +
    infoBox(
      infoRow('Service', data.serviceName) +
      infoRow('Provider', data.providerName) +
      infoRow('Date', data.appointmentDate) +
      infoRow('Time', data.appointmentTime) +
      (reason ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:14px;">Reason: </span><span style="color:#111827;font-size:14px;">${reason}</span></div>` : '')
    ) +
    paragraph('If you would like to rebook, please contact the provider or visit HomeBase to schedule a new appointment.') +
    appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Booking Cancelled: ${data.serviceName} with ${data.providerName}`,
    buildEmailBase('Booking Cancelled', body)
  );
}

export async function sendBookingRescheduledEmail(data: BookingData, oldDate: string, oldTime: string): Promise<SendResult> {
  const body = greeting(data.clientName) +
    paragraph(`Your ${data.serviceName} appointment with ${data.providerName} has been rescheduled.`) +
    `<p style="color:#6b7280;font-size:13px;text-decoration:line-through;margin:0 0 4px;">Previously: ${oldDate} at ${oldTime}</p>` +
    infoBox(
      `<p style="color:#38AE5F;font-weight:600;font-size:13px;margin:0 0 12px;">New schedule</p>` +
      infoRow('Service', data.serviceName) +
      infoRow('Provider', data.providerName) +
      infoRow('Date', data.appointmentDate) +
      infoRow('Time', data.appointmentTime) +
      (data.address ? infoRow('Location', data.address) : '')
    ) +
    appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Rescheduled: ${data.serviceName} with ${data.providerName}`,
    buildEmailBase('Appointment Rescheduled', body)
  );
}

// ─── Invoice templates ─────────────────────────────────────────────────────────

interface InvoiceEmailData {
  clientEmail: string;
  clientName: string;
  providerName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  lineItems: { description: string; quantity: number; unitPrice: number; total: number }[];
  paymentLink?: string;
}

export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<SendResult> {
  const lineItemsHtml = data.lineItems.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;">${item.description}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151;font-size:13px;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:13px;">$${item.unitPrice.toFixed(2)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:13px;">$${item.total.toFixed(2)}</td>
    </tr>`).join('');

  const body = greeting(data.clientName) +
    paragraph(`You have received a new invoice from <strong>${data.providerName}</strong>. Please find the details below.`) +
    infoBox(
      infoRow('Invoice #', data.invoiceNumber) +
      infoRow('Due Date', data.dueDate) +
      `<div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #e5e7eb;">
        <span style="color:#6b7280;font-size:14px;">Total Amount</span>
        <span style="color:#38AE5F;font-weight:700;font-size:20px;">${fmtUsd(data.amount)}</span>
      </div>`
    ) +
    `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:10px 12px;text-align:left;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
          <th style="padding:10px 12px;text-align:center;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
          <th style="padding:10px 12px;text-align:right;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Price</th>
          <th style="padding:10px 12px;text-align:right;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Total</th>
        </tr>
      </thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>` +
    (data.paymentLink
      ? `<a href="${data.paymentLink}" style="display:block;background:#38AE5F;color:#fff;text-align:center;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin-bottom:24px;">Pay Now</a>`
      : '') +
    appDownloadSection();

  return sendEmail(
    data.clientEmail,
    `Invoice ${data.invoiceNumber} from ${data.providerName} &ndash; ${fmtUsd(data.amount)}`,
    buildEmailBase(`Invoice from ${data.providerName}`, body)
  );
}

export async function sendInvoiceCreatedEmail(data: InvoiceEmailData): Promise<SendResult> {
  return sendInvoiceEmail(data);
}

export async function sendInvoiceReminderEmail(data: {
  clientEmail: string;
  clientName: string;
  providerName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  paymentLink?: string;
  daysUntilDue?: number;
  daysOverdue?: number;
}): Promise<SendResult> {
  const isOverdue = (data.daysOverdue ?? 0) > 0;
  const urgencyText = isOverdue
    ? `Your invoice is <strong>${data.daysOverdue} day${data.daysOverdue === 1 ? '' : 's'} overdue</strong>. Please arrange payment as soon as possible to avoid any service interruptions.`
    : `Your invoice is due in <strong>${data.daysUntilDue} day${data.daysUntilDue === 1 ? '' : 's'}</strong>. Please arrange payment before the due date.`;

  const body = greeting(data.clientName) +
    `<div style="background:${isOverdue ? '#fef2f2' : '#fffbeb'};border-radius:8px;padding:14px 16px;margin-bottom:20px;border-left:4px solid ${isOverdue ? '#ef4444' : '#f59e0b'};">
      <p style="color:${isOverdue ? '#991b1b' : '#92400e'};font-size:14px;margin:0;">${urgencyText}</p>
    </div>` +
    infoBox(
      infoRow('Invoice #', data.invoiceNumber) +
      infoRow('Provider', data.providerName) +
      infoRow('Due Date', data.dueDate) +
      `<div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #e5e7eb;">
        <span style="color:#6b7280;font-size:14px;">Amount Due</span>
        <span style="color:${isOverdue ? '#ef4444' : '#38AE5F'};font-weight:700;font-size:20px;">${fmtUsd(data.amount)}</span>
      </div>`
    ) +
    (data.paymentLink
      ? `<a href="${data.paymentLink}" style="display:block;background:#38AE5F;color:#fff;text-align:center;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin-bottom:24px;">Pay Now</a>`
      : '') +
    appDownloadSection();

  const subject = isOverdue
    ? `Overdue: Invoice ${data.invoiceNumber} from ${data.providerName}`
    : `Reminder: Invoice ${data.invoiceNumber} due in ${data.daysUntilDue} day${data.daysUntilDue === 1 ? '' : 's'}`;

  return sendEmail(data.clientEmail, subject, buildEmailBase('Invoice Reminder', body));
}

interface PaymentReceiptData {
  clientEmail: string;
  clientName: string;
  providerName: string;
  invoiceNumber: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
}

export async function sendPaymentReceiptEmail(data: PaymentReceiptData): Promise<SendResult> {
  const body = greeting(data.clientName) +
    `<div style="text-align:center;margin-bottom:24px;">
      <div style="width:60px;height:60px;background:#f0fdf4;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
        <div style="font-size:28px;color:#38AE5F;">&#10003;</div>
      </div>
      <p style="color:#166534;font-weight:600;margin:0;">Payment confirmed</p>
    </div>` +
    paragraph('Thank you for your payment! This email confirms we\'ve received your payment for the following:') +
    infoBox(
      infoRow('Invoice #', data.invoiceNumber) +
      infoRow('Payment Date', data.paymentDate) +
      infoRow('Provider', data.providerName) +
      (data.paymentMethod ? infoRow('Payment Method', data.paymentMethod) : '') +
      `<div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #e5e7eb;">
        <span style="color:#6b7280;font-size:14px;">Amount Paid</span>
        <span style="color:#38AE5F;font-weight:700;font-size:20px;">${fmtUsd(data.amount)}</span>
      </div>`
    ) +
    paragraph(`Keep this email as your receipt. If you have any questions about this payment, please contact ${data.providerName} directly.`) +
    appDownloadSection();

  return sendEmail(
    data.clientEmail,
    `Payment Receipt &ndash; ${fmtUsd(data.amount)} to ${data.providerName}`,
    buildEmailBase('Payment Receipt', body)
  );
}

export async function sendInvoicePaidEmail(data: PaymentReceiptData): Promise<SendResult> {
  return sendPaymentReceiptEmail(data);
}

export async function sendPaymentFailedEmail(data: {
  clientEmail: string;
  clientName: string;
  providerName: string;
  invoiceNumber: string;
  amount: number;
  paymentLink?: string;
}): Promise<SendResult> {
  const body = greeting(data.clientName) +
    `<div style="background:#fef2f2;border-radius:8px;padding:14px 16px;margin-bottom:20px;border-left:4px solid #ef4444;">
      <p style="color:#991b1b;font-size:14px;margin:0;"><strong>Payment failed.</strong> We were unable to process your payment for invoice ${data.invoiceNumber}.</p>
    </div>` +
    infoBox(
      infoRow('Invoice #', data.invoiceNumber) +
      infoRow('Provider', data.providerName) +
      `<div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #e5e7eb;">
        <span style="color:#6b7280;font-size:14px;">Amount Due</span>
        <span style="color:#ef4444;font-weight:700;font-size:20px;">${fmtUsd(data.amount)}</span>
      </div>`
    ) +
    paragraph('Please update your payment method and try again. If you need assistance, contact your service provider directly.') +
    (data.paymentLink
      ? `<a href="${data.paymentLink}" style="display:block;background:#38AE5F;color:#fff;text-align:center;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin-bottom:24px;">Retry Payment</a>`
      : '') +
    appDownloadSection();

  return sendEmail(
    data.clientEmail,
    `Payment Failed: Invoice ${data.invoiceNumber} from ${data.providerName}`,
    buildEmailBase('Payment Failed', body)
  );
}

// ─── Follow-up / Review templates ──────────────────────────────────────────────

export async function sendReviewRequestEmail(data: {
  clientEmail: string;
  clientName: string;
  providerName: string;
  serviceName: string;
  reviewUrl?: string;
}): Promise<SendResult> {
  const body = greeting(data.clientName) +
    paragraph(`Thank you for choosing ${data.providerName} for your ${data.serviceName}! We hope everything went smoothly. Your feedback helps other homeowners find great service providers.`) +
    paragraph('Would you mind leaving a quick review? It only takes a minute and means a lot to your provider.') +
    appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `How did your ${data.serviceName} go? Leave a review for ${data.providerName}`,
    buildEmailBase('Leave a Review', body, data.reviewUrl ? 'Leave a Review' : undefined, data.reviewUrl)
  );
}

// ─── Platform alert templates ──────────────────────────────────────────────────

export async function sendStripeOnboardingNeededEmail(to: string, providerName: string, onboardingUrl: string): Promise<SendResult> {
  const body = greeting(providerName) +
    paragraph('To start accepting online payments through HomeBase, you need to complete your Stripe payout account setup. This takes about 5 minutes.') +
    `<ul style="color:#6b7280;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
      <li>Accept card payments from clients</li>
      <li>Receive automatic payouts to your bank account</li>
      <li>Issue refunds directly from HomeBase</li>
    </ul>`;
  return sendEmail(to, 'Complete your payout setup to get paid faster', buildEmailBase('Set Up Payouts', body, 'Set Up Stripe Payouts', onboardingUrl));
}

export async function sendStripeConnectedEmail(to: string, providerName: string): Promise<SendResult> {
  const body = greeting(providerName) +
    paragraph('Your Stripe payout account has been successfully connected to HomeBase. You can now accept online payments from clients and receive payouts directly to your bank account.') +
    `<div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #38AE5F;">
      <p style="color:#166534;font-weight:600;margin:0;">Payments are now active</p>
      <p style="color:#15803d;font-size:13px;margin:6px 0 0;">Send invoices with &ldquo;Pay Now&rdquo; links and get paid faster.</p>
    </div>` +
    appDownloadSection();
  return sendEmail(to, 'Your Stripe payout account is connected', buildEmailBase('Payouts Connected', body));
}

// ─── Provider notifications ────────────────────────────────────────────────────

interface IntakeSubmissionNotificationData {
  providerEmail: string;
  providerName: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  problemDescription: string;
  address?: string;
  bookingLinkName?: string;
}

export async function sendIntakeSubmissionNotification(data: IntakeSubmissionNotificationData): Promise<SendResult> {
  const body = greeting(data.providerName) +
    paragraph(`You've received a new service request via ${data.bookingLinkName || 'your booking page'}! Here are the details:`) +
    infoBox(
      `<div style="margin-bottom:14px;">
        <span style="color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:500;">Client</span>
        <p style="color:#111827;font-weight:600;margin:3px 0 0;font-size:15px;">${data.clientName}</p>
      </div>` +
      (data.clientEmail ? `<div style="margin-bottom:14px;"><span style="color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:500;">Email</span><p style="color:#111827;margin:3px 0 0;"><a href="mailto:${data.clientEmail}" style="color:#38AE5F;">${data.clientEmail}</a></p></div>` : '') +
      (data.clientPhone ? `<div style="margin-bottom:14px;"><span style="color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:500;">Phone</span><p style="color:#111827;margin:3px 0 0;"><a href="tel:${data.clientPhone}" style="color:#38AE5F;">${data.clientPhone}</a></p></div>` : '') +
      (data.address ? `<div style="margin-bottom:14px;"><span style="color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:500;">Address</span><p style="color:#111827;margin:3px 0 0;">${data.address}</p></div>` : '') +
      `<div><span style="color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:500;">Problem Description</span><p style="color:#111827;margin:3px 0 0;line-height:1.5;">${data.problemDescription}</p></div>`
    ) +
    paragraph('Respond quickly to increase your chances of winning this job.');

  return sendEmail(
    data.providerEmail,
    `New Lead: ${data.clientName} &ndash; ${data.problemDescription.substring(0, 50)}${data.problemDescription.length > 50 ? '...' : ''}`,
    buildEmailBase('New Lead Received', body, 'View in HomeBase', 'https://homebaseproapp.com')
  );
}

export async function sendProviderBookingNotificationEmail(data: {
  providerEmail: string;
  providerName: string;
  clientName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  address?: string;
}): Promise<SendResult> {
  const body = greeting(data.providerName) +
    paragraph(`${data.clientName} has booked a ${data.serviceName} with you. Here are the details:`) +
    infoBox(
      infoRow('Client', data.clientName) +
      infoRow('Service', data.serviceName) +
      infoRow('Date', data.appointmentDate) +
      infoRow('Time', data.appointmentTime) +
      (data.address ? infoRow('Location', data.address) : '')
    );
  return sendEmail(
    data.providerEmail,
    `New Booking: ${data.serviceName} with ${data.clientName}`,
    buildEmailBase('New Booking', body, 'View in HomeBase', 'https://homebaseproapp.com')
  );
}

export async function sendJobStatusChangedEmail(data: {
  clientEmail: string;
  clientName: string;
  providerName: string;
  serviceName: string;
  newStatus: string;
  scheduledDate?: string;
  notes?: string;
}): Promise<SendResult> {
  const statusLabel: Record<string, string> = {
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    on_hold: 'On Hold',
  };
  const label = statusLabel[data.newStatus] ?? data.newStatus;
  const body = greeting(data.clientName) +
    paragraph(`We wanted to let you know that the status of your ${data.serviceName} job with ${data.providerName} has been updated to <strong>${label}</strong>.`) +
    (data.scheduledDate || data.notes
      ? infoBox(
          (data.scheduledDate ? infoRow('Scheduled Date', data.scheduledDate) : '') +
          (data.notes ? infoRow('Notes', data.notes) : '')
        )
      : '') +
    paragraph(`If you have any questions, please reach out through the HomeBase app.`);
  return sendEmail(
    data.clientEmail,
    `Job Update: ${data.serviceName} is now ${label}`,
    buildEmailBase('Job Status Update', body, 'View in HomeBase', 'https://homebaseproapp.com')
  );
}
