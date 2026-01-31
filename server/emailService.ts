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
                <a href="${data.paymentLink}" style="display: block; background: #38AE5F; color: white; text-align: center; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Pay Now
                </a>
              ` : ''}
              
              <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; text-align: center;">
                This invoice was sent via HomeBase
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
