// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const TRANSFER_INVITATION_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">

<div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a; margin: 0;">You've Received Money!</h1>
        <p style="color: #666; font-size: 18px; margin: 10px 0 0 0;">
            <strong>{{senderEmail}}</strong> sent you <strong>\${{amount}} USDC</strong>
        </p>
    </div>

    <!-- Main Content -->
    <div style="margin-bottom: 30px;">
        <p style="color: #333; line-height: 1.6; margin-bottom: 20px;">
            Hi there,
        </p>

        <p style="color: #333; line-height: 1.6; margin-bottom: 20px;">
            Great news! <strong>{{senderEmail}}</strong> has sent you <strong>\${{amount}} USDC</strong> using our digital wallet platform.
        </p>

        <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1976d2; margin: 0 0 10px 0; font-size: 16px;">
                What is USDC?
            </h3>
            <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.5;">
                USDC is a digital dollar (stablecoin) that's always worth \$1 USD.
                It's a secure, fast way to send and receive money digitally.
            </p>
        </div>

        <p style="color: #333; line-height: 1.6; margin-bottom: 25px;">
            To claim your money, you'll need to create a free wallet account.
            The process takes less than 2 minutes and only requires an email address.
        </p>
    </div>

    <!-- Call to Action -->
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{claimUrl}}"
           style="background: #1976d2; color: white; padding: 15px 30px; text-decoration: none;
              border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
            Claim Your \${{amount}} USDC
        </a>
    </div>

    <!-- Important Warnings -->
    <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">
            Important: Development Network
        </h3>
        <p style="color: #856404; margin: 0; font-size: 14px; line-height: 1.5;">
            <strong>This transaction occurred on Solana Devnet (test network)</strong>.
            This is demonstration money for testing purposes only. While the technology
            and processes are real, this USDC has no actual monetary value.
        </p>
    </div>

    <!-- Security Notice -->
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <h3 style="color: #495057; margin: 0 0 10px 0; font-size: 16px;">
            Security & Privacy
        </h3>
        <ul style="color: #495057; margin: 10px 0; padding-left: 20px; font-size: 14px; line-height: 1.5;">
            <li>Your funds are secured by blockchain technology</li>
            <li>Only you control your wallet with your email login</li>
            <li>We never store your private keys</li>
            <li>This email was sent because you were a recipient of a transaction</li>
        </ul>
    </div>

    <!-- Next Steps -->
    <div style="margin: 25px 0;">
        <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">
            What happens next?
        </h3>
        <ol style="color: #333; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li>Click the "Claim Your USDC" button above</li>
            <li>Sign up with your email address ({{recipientEmail}})</li>
            <li>Your wallet will be created automatically</li>
            <li>Your \${{amount}} USDC will be waiting for you</li>
            <li>You can then send, receive, or earn yield on your USDC</li>
        </ol>
    </div>

    <!-- Transaction Summary (Email-Client Compatible) -->
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <!-- Header Row -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 15px;">
        <tr>
          <td style="vertical-align: middle;">
            <h4 style="color: #666; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif;">
              Transaction Summary
            </h4>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <a href="https://solscan.io/tx/34qU2o5hZFjLAAgUCJryyZwio1FC4bojpEEug82pBBqU5LvAV9VqJa5VwAMD6LB2ejTsBjHZUtjPDmLew8YLETd9?cluster=devnet" 
               style="color: #1976d2; text-decoration: none; font-size: 12px; font-weight: 500; font-family: Arial, sans-serif;"
               target="_blank">
              View on Blockchain →
            </a>
          </td>
        </tr>
      </table>
      
      <!-- Transaction Details -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <!-- Amount Row -->
        <tr>
          <td style="padding: 5px 0; vertical-align: middle;">
            <span style="color: #666; font-size: 14px; font-family: Arial, sans-serif;">Amount</span>
          </td>
          <td style="padding: 5px 0; text-align: right; vertical-align: middle;">
            <span style="color: #333; font-weight: 600; font-size: 16px; font-family: Arial, sans-serif;">\${{amount}} USDC</span>
          </td>
        </tr>
        
        <!-- From Row -->
        <tr>
          <td style="padding: 5px 0; vertical-align: middle;">
            <span style="color: #666; font-size: 14px; font-family: Arial, sans-serif;">From</span>
          </td>
          <td style="padding: 5px 0; text-align: right; vertical-align: middle;">
            <span style="color: #333; font-size: 14px; font-family: Arial, sans-serif;">{{senderEmail}}</span>
          </td>
        </tr>
        
        <!-- Date Row -->
        <tr>
          <td style="padding: 5px 0; vertical-align: middle;">
            <span style="color: #666; font-size: 14px; font-family: Arial, sans-serif;">Date</span>
          </td>
          <td style="padding: 5px 0; text-align: right; vertical-align: middle;">
            <span style="color: #333; font-size: 14px; font-family: Arial, sans-serif;">{{currentDate}}</span>
          </td>
        </tr>
        
        <!-- Network Row -->
        <tr>
          <td style="padding: 5px 0; vertical-align: middle;">
            <span style="color: #666; font-size: 14px; font-family: Arial, sans-serif;">Network</span>
          </td>
          <td style="padding: 5px 0; text-align: right; vertical-align: middle;">
            <span style="color: #f39c12; font-size: 12px; background-color: #fef9e7; padding: 2px 8px; border-radius: 12px; font-weight: 500; font-family: Arial, sans-serif;">
              Solana Devnet
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
        <p style="color: #666; font-size: 12px; margin: 0;">
            This is an automated message regarding your USDC transaction.
        </p>
        <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">
            This transfer expires on <strong>{{expirationDate}}</strong>
        </p>
    </div>

</div>

</body>
</html>`;

const PAYMENT_REQUEST_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">

<div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a; margin: 0;">Payment Request</h1>
        <p style="color: #666; font-size: 18px; margin: 10px 0 0 0;">
            <strong>{{requesterName}}</strong> is requesting <strong>\${{amount}} USDC</strong>
        </p>
    </div>

    <!-- Main Content -->
    <div style="margin-bottom: 30px;">
        <p style="color: #333; line-height: 1.6; margin-bottom: 20px;">
            Hi there,
        </p>

        <p style="color: #333; line-height: 1.6; margin-bottom: 20px;">
            <strong>{{requesterName}}</strong> ({{requesterEmail}}) has sent you a payment request for <strong>\${{amount}} USDC</strong>.
        </p>

        {{#message}}
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1976d2;">
            <h4 style="color: #1976d2; margin: 0 0 8px 0; font-size: 14px;">Message from {{requesterName}}:</h4>
            <p style="color: #333; margin: 0; font-style: italic;">"{{message}}"</p>
        </div>
        {{/message}}

        <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1976d2; margin: 0 0 10px 0; font-size: 16px;">
                What is USDC?
            </h3>
            <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.5;">
                USDC is a digital dollar (stablecoin) that's always worth \$1 USD.
                It's a secure, fast way to send and receive money digitally.
            </p>
        </div>

        <p style="color: #333; line-height: 1.6; margin-bottom: 25px;">
            You can easily send the requested amount by clicking the button below. 
            If you don't have a wallet yet, you can create one in less than 2 minutes.
        </p>
    </div>

    <!-- Call to Action -->
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{paymentUrl}}"
           style="background: #16a34a; color: white; padding: 15px 30px; text-decoration: none;
              border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
            Send \${{amount}} USDC
        </a>
    </div>

    <!-- Important Warnings -->
    <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">
            Important: Development Network
        </h3>
        <p style="color: #856404; margin: 0; font-size: 14px; line-height: 1.5;">
            <strong>This is on Solana Devnet (test network)</strong>.
            This is for demonstration purposes only. While the technology
            and processes are real, this USDC has no actual monetary value.
        </p>
    </div>

    <!-- Request Summary -->
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 15px;">
        <tr>
          <td style="vertical-align: middle;">
            <h4 style="color: #666; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif;">
              Payment Request Details
            </h4>
          </td>
        </tr>
      </table>
      
      <table width="100%" cellpadding="0" cellspacing="0">
        <!-- Amount Row -->
        <tr>
          <td style="padding: 5px 0; vertical-align: middle;">
            <span style="color: #666; font-size: 14px; font-family: Arial, sans-serif;">Requested Amount</span>
          </td>
          <td style="padding: 5px 0; text-align: right; vertical-align: middle;">
            <span style="color: #333; font-weight: 600; font-size: 16px; font-family: Arial, sans-serif;">\${{amount}} USDC</span>
          </td>
        </tr>
        
        <!-- From Row -->
        <tr>
          <td style="padding: 5px 0; vertical-align: middle;">
            <span style="color: #666; font-size: 14px; font-family: Arial, sans-serif;">Requested by</span>
          </td>
          <td style="padding: 5px 0; text-align: right; vertical-align: middle;">
            <span style="color: #333; font-size: 14px; font-family: Arial, sans-serif;">{{requesterName}} ({{requesterEmail}})</span>
          </td>
        </tr>
        
        <!-- Date Row -->
        <tr>
          <td style="padding: 5px 0; vertical-align: middle;">
            <span style="color: #666; font-size: 14px; font-family: Arial, sans-serif;">Request Date</span>
          </td>
          <td style="padding: 5px 0; text-align: right; vertical-align: middle;">
            <span style="color: #333; font-size: 14px; font-family: Arial, sans-serif;">{{currentDate}}</span>
          </td>
        </tr>
        
        <!-- Network Row -->
        <tr>
          <td style="padding: 5px 0; vertical-align: middle;">
            <span style="color: #666; font-size: 14px; font-family: Arial, sans-serif;">Network</span>
          </td>
          <td style="padding: 5px 0; text-align: right; vertical-align: middle;">
            <span style="color: #f39c12; font-size: 12px; background-color: #fef9e7; padding: 2px 8px; border-radius: 12px; font-weight: 500; font-family: Arial, sans-serif;">
              Solana Devnet
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
        <p style="color: #666; font-size: 12px; margin: 0;">
            This is a payment request sent via our digital wallet platform.
        </p>
        <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">
            You can choose to send or decline this request.
        </p>
    </div>

</div>

</body>
</html>`;

function replaceTemplatePlaceholders(template: string, data: any, appUrl: string): string {
  let result = template;
  
  // Handle transfer invitation placeholders
  if (data.senderEmail) {
    const claimUrl = data.claimUrl || `${appUrl}?email=${encodeURIComponent(data.recipientEmail || '')}`;
    result = result
      .replace(/\{\{senderEmail\}\}/g, data.senderEmail || '')
      .replace(/\{\{recipientEmail\}\}/g, data.recipientEmail || '')
      .replace(/\{\{amount\}\}/g, data.amount || '0.00')
      .replace(/\{\{claimUrl\}\}/g, claimUrl)
      .replace(/\{\{expirationDate\}\}/g, data.expirationDate || 'N/A');
  }
  
  // Handle payment request placeholders
  if (data.requesterEmail) {
    const paymentUrl = data.paymentUrl || `${appUrl}?send_to=${encodeURIComponent(data.requesterEmail)}&amount=${data.amount}`;
    result = result
      .replace(/\{\{requesterEmail\}\}/g, data.requesterEmail || '')
      .replace(/\{\{requesterName\}\}/g, data.requesterName || data.requesterEmail || '')
      .replace(/\{\{targetEmail\}\}/g, data.targetEmail || '')
      .replace(/\{\{amount\}\}/g, data.amount || '0.00')
      .replace(/\{\{paymentUrl\}\}/g, paymentUrl);
    
    // Handle optional message with conditional rendering
    if (data.message && data.message !== 'No message') {
      result = result
        .replace(/\{\{#message\}\}/g, '')
        .replace(/\{\{\/message\}\}/g, '')
        .replace(/\{\{message\}\}/g, data.message);
    } else {
      // Remove the message section entirely
      result = result.replace(/\{\{#message\}\}[\s\S]*?\{\{\/message\}\}/g, '');
    }
  }
  
  // Common placeholders
  result = result.replace(/\{\{currentDate\}\}/g, data.currentDate || new Date().toLocaleDateString());
  
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
      }
    });
  }

  try {
    // Handle actual POST request
    const body = await req.json();
    
    // Support both old format (html) and new format (templateData)
    let html: string;
    let to: string;
    let subject: string;
    const appUrl = body.appUrl || 'https://your-app.com'; // Default fallback

    if (body.templateData) {
      // New format with template data
      to = body.to;
      subject = body.subject;
      
      // Determine which template to use based on email type
      let selectedTemplate;
      if (body.templateData.type === 'payment_request') {
        selectedTemplate = PAYMENT_REQUEST_TEMPLATE;
        console.log('📧 Using payment request template');
      } else {
        selectedTemplate = TRANSFER_INVITATION_TEMPLATE;
        console.log('📧 Using transfer invitation template');
      }
      
      html = replaceTemplatePlaceholders(selectedTemplate, body.templateData, appUrl);
      
      console.log('📧 Using template with data:', {
        to,
        subject,
        appUrl,
        emailType: body.templateData.type || 'transfer_invitation',
        templateData: body.templateData
      });
    } else {
      // Old format with direct HTML
      to = body.to;
      subject = body.subject;
      html = body.html;
      
      console.log('📧 Using direct HTML format:', { to, subject, appUrl });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "wallet@fymoney.xyz",
        to,
        subject,
        html
      })
    });

    const data = await res.json();
    
    if (res.ok) {
      console.log('✅ Email sent successfully:', data.id);
    } else {
      console.error('❌ Resend API error:', data);
    }

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      },
      status: res.status
    });

  } catch (error) {
    console.error('❌ Function error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: {
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      },
      status: 500
    });
  }
});