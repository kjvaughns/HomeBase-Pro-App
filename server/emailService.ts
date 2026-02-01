// Email Service using Resend integration
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

export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(data.amount);
    
    const lineItemsHtml = data.lineItems.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.total.toFixed(2)}</td>
      </tr>
    `).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: #38AE5F; padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Invoice from ${data.providerName}</h1>
            </div>
            
            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                Hi ${data.clientName},
              </p>
              
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
                You have received a new invoice. Please find the details below:
              </p>
              
              <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Invoice Number:</span>
                  <span style="color: #111827; font-weight: 600;">${data.invoiceNumber}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Due Date:</span>
                  <span style="color: #111827; font-weight: 600;">${data.dueDate}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #6b7280;">Total Amount:</span>
                  <span style="color: #38AE5F; font-weight: 700; font-size: 20px;">${formattedAmount}</span>
                </div>
              </div>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; color: #374151; font-size: 12px; text-transform: uppercase;">Description</th>
                    <th style="padding: 12px; text-align: center; color: #374151; font-size: 12px; text-transform: uppercase;">Qty</th>
                    <th style="padding: 12px; text-align: right; color: #374151; font-size: 12px; text-transform: uppercase;">Price</th>
                    <th style="padding: 12px; text-align: right; color: #374151; font-size: 12px; text-transform: uppercase;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>
              
              ${data.paymentLink ? `
                <a href="${data.paymentLink}" style="display: block; background: #38AE5F; color: white; text-align: center; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
                  Pay Now
                </a>
              ` : ''}
              
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; padding: 20px; margin-top: 24px; text-align: center;">
                <p style="color: #166534; font-weight: 600; margin: 0 0 8px 0; font-size: 14px;">
                  Manage your home services with HomeBase
                </p>
                <p style="color: #15803d; font-size: 13px; margin: 0 0 16px 0;">
                  Track invoices, book services, and get instant quotes - all in one app.
                </p>
                <div style="display: flex; justify-content: center; gap: 12px;">
                  <a href="https://apps.apple.com/app/homebase" style="display: inline-block; background: #111827; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;">
                    App Store
                  </a>
                  <a href="https://play.google.com/store/apps/details?id=com.homebase" style="display: inline-block; background: #111827; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;">
                    Google Play
                  </a>
                </div>
              </div>
            </div>
            
            <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <img src="https://via.placeholder.com/120x30/38AE5F/FFFFFF?text=HomeBase" alt="HomeBase" style="height: 24px; margin-bottom: 8px;" />
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                Sent via HomeBase - The smart way to manage home services
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await client.emails.send({
      from: fromEmail || 'HomeBase <noreply@resend.dev>',
      to: data.clientEmail,
      subject: `Invoice ${data.invoiceNumber} from ${data.providerName} - ${formattedAmount}`,
      html
    });
    
    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }
    
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    console.error('Send invoice email error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// Shared app download section for all emails
const appDownloadSection = `
  <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; padding: 20px; margin-top: 24px; text-align: center;">
    <p style="color: #166534; font-weight: 600; margin: 0 0 8px 0; font-size: 14px;">
      Manage your home services with HomeBase
    </p>
    <p style="color: #15803d; font-size: 13px; margin: 0 0 16px 0;">
      Track invoices, book services, and get instant quotes - all in one app.
    </p>
    <div style="display: flex; justify-content: center; gap: 12px;">
      <a href="https://apps.apple.com/app/homebase" style="display: inline-block; background: #111827; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;">
        App Store
      </a>
      <a href="https://play.google.com/store/apps/details?id=com.homebase" style="display: inline-block; background: #111827; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;">
        Google Play
      </a>
    </div>
  </div>
`;

const emailFooter = `
  <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
    <img src="https://via.placeholder.com/120x30/38AE5F/FFFFFF?text=HomeBase" alt="HomeBase" style="height: 24px; margin-bottom: 8px;" />
    <p style="color: #9ca3af; font-size: 11px; margin: 0;">
      Sent via HomeBase - The smart way to manage home services
    </p>
  </div>
`;

interface PaymentReceiptData {
  clientEmail: string;
  clientName: string;
  providerName: string;
  invoiceNumber: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
}

export async function sendPaymentReceiptEmail(data: PaymentReceiptData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(data.amount);
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: #38AE5F; padding: 32px; text-align: center;">
              <div style="width: 60px; height: 60px; background: white; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px; color: #38AE5F;">✓</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 24px;">Payment Received</h1>
            </div>
            
            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                Hi ${data.clientName},
              </p>
              
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
                Thank you for your payment! This email confirms we've received your payment for the following:
              </p>
              
              <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Invoice Number:</span>
                  <span style="color: #111827; font-weight: 600;">${data.invoiceNumber}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Payment Date:</span>
                  <span style="color: #111827; font-weight: 600;">${data.paymentDate}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Provider:</span>
                  <span style="color: #111827; font-weight: 600;">${data.providerName}</span>
                </div>
                ${data.paymentMethod ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Payment Method:</span>
                  <span style="color: #111827; font-weight: 600;">${data.paymentMethod}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                  <span style="color: #6b7280;">Amount Paid:</span>
                  <span style="color: #38AE5F; font-weight: 700; font-size: 20px;">${formattedAmount}</span>
                </div>
              </div>
              
              <p style="color: #6b7280; font-size: 13px; margin-bottom: 24px;">
                Keep this email as your receipt. If you have any questions about this payment, please contact ${data.providerName} directly.
              </p>
              
              ${appDownloadSection}
            </div>
            
            ${emailFooter}
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await client.emails.send({
      from: fromEmail || 'HomeBase <noreply@resend.dev>',
      to: data.clientEmail,
      subject: `Payment Receipt - ${formattedAmount} to ${data.providerName}`,
      html
    });
    
    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }
    
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    console.error('Send payment receipt error:', error);
    return { success: false, error: error.message || 'Failed to send receipt' };
  }
}

interface BookingConfirmationData {
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

export async function sendBookingConfirmationEmail(data: BookingConfirmationData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const formattedPrice = data.estimatedPrice ? new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(data.estimatedPrice) : null;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: #38AE5F; padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Booking Confirmed</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Your service has been scheduled</p>
            </div>
            
            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                Hi ${data.clientName},
              </p>
              
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
                Great news! Your service request has been confirmed. Here are the details:
              </p>
              
              <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                ${data.confirmationNumber ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Confirmation #:</span>
                  <span style="color: #111827; font-weight: 600;">${data.confirmationNumber}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Service:</span>
                  <span style="color: #111827; font-weight: 600;">${data.serviceName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Provider:</span>
                  <span style="color: #111827; font-weight: 600;">${data.providerName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Date:</span>
                  <span style="color: #111827; font-weight: 600;">${data.appointmentDate}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Time:</span>
                  <span style="color: #111827; font-weight: 600;">${data.appointmentTime}</span>
                </div>
                ${data.address ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="color: #6b7280;">Location:</span>
                  <span style="color: #111827; font-weight: 600;">${data.address}</span>
                </div>
                ` : ''}
                ${formattedPrice ? `
                <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                  <span style="color: #6b7280;">Estimated Price:</span>
                  <span style="color: #38AE5F; font-weight: 700; font-size: 18px;">${formattedPrice}</span>
                </div>
                ` : ''}
              </div>
              
              <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
                <p style="color: #92400e; font-size: 13px; margin: 0;">
                  <strong>Need to reschedule?</strong> Contact ${data.providerName} directly at least 24 hours before your appointment.
                </p>
              </div>
              
              ${appDownloadSection}
            </div>
            
            ${emailFooter}
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await client.emails.send({
      from: fromEmail || 'HomeBase <noreply@resend.dev>',
      to: data.clientEmail,
      subject: `Booking Confirmed: ${data.serviceName} with ${data.providerName}`,
      html
    });
    
    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }
    
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    console.error('Send booking confirmation error:', error);
    return { success: false, error: error.message || 'Failed to send confirmation' };
  }
}

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

export async function sendIntakeSubmissionNotification(data: IntakeSubmissionNotificationData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: #38AE5F; padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">New Lead Received</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">via ${data.bookingLinkName || 'your booking page'}</p>
            </div>
            
            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                Hi ${data.providerName},
              </p>
              
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
                You've received a new service request! Here are the details:
              </p>
              
              <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <div style="margin-bottom: 16px;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 500;">Client</span>
                  <p style="color: #111827; font-weight: 600; margin: 4px 0 0; font-size: 16px;">${data.clientName}</p>
                </div>
                ${data.clientEmail ? `
                <div style="margin-bottom: 16px;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 500;">Email</span>
                  <p style="color: #111827; margin: 4px 0 0;"><a href="mailto:${data.clientEmail}" style="color: #38AE5F;">${data.clientEmail}</a></p>
                </div>
                ` : ''}
                ${data.clientPhone ? `
                <div style="margin-bottom: 16px;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 500;">Phone</span>
                  <p style="color: #111827; margin: 4px 0 0;"><a href="tel:${data.clientPhone}" style="color: #38AE5F;">${data.clientPhone}</a></p>
                </div>
                ` : ''}
                ${data.address ? `
                <div style="margin-bottom: 16px;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 500;">Address</span>
                  <p style="color: #111827; margin: 4px 0 0;">${data.address}</p>
                </div>
                ` : ''}
                <div>
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 500;">Problem Description</span>
                  <p style="color: #111827; margin: 4px 0 0; line-height: 1.5;">${data.problemDescription}</p>
                </div>
              </div>
              
              <a href="#" style="display: block; background: #38AE5F; color: white; text-align: center; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                View in HomeBase App
              </a>
              
              <p style="color: #9ca3af; font-size: 12px; margin-top: 16px; text-align: center;">
                Respond quickly to increase your chances of booking this job.
              </p>
            </div>
            
            ${emailFooter}
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await client.emails.send({
      from: fromEmail || 'HomeBase <noreply@resend.dev>',
      to: data.providerEmail,
      subject: `New Lead: ${data.clientName} - ${data.problemDescription.substring(0, 50)}${data.problemDescription.length > 50 ? '...' : ''}`,
      html
    });
    
    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }
    
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    console.error('Send intake notification error:', error);
    return { success: false, error: error.message || 'Failed to send notification' };
  }
}
