// src/services/emailNotificationService.ts

import { supabase } from '@/lib/supabase';

export interface EmailInvitationParams {
    transferIntentId: string;
    senderEmail: string;
    recipientEmail: string;
    amount: number; // Amount in USDC base units (6 decimals)
    expirationDate: string;
}

export interface EmailInvitationResult {
    emailId: string;
    success: boolean;
    error?: string;
}

export interface PaymentRequestData {
    fromEmail: string;
    fromName?: string;
    toEmail: string;
    amount: string;
    message?: string;
    walletAddress: string;
}

export interface PaymentRequestResult {
    success: boolean;
    requestId?: string;
    error?: string;
}

export class EmailNotificationService {
    /**
     * Send invitation email for a transfer intent via Supabase function
     */
    static async sendInvitationEmail(params: EmailInvitationParams): Promise<EmailInvitationResult> {
        const { transferIntentId, senderEmail, recipientEmail, amount, expirationDate } = params;

        console.log('📧 Sending invitation email for transfer intent:', transferIntentId);

        try {
            // Convert amount to USDC display format
            const amountUsdc = (amount / 1_000_000).toFixed(2);
            
            // Format expiration date
            const expirationDisplay = new Date(expirationDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Get application URL from environment variable (fallback to current origin for development)
            const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
            
            // Create claim URL with recipient email parameter
            const claimUrl = `${appUrl}?email=${encodeURIComponent(recipientEmail)}`;

            // Call Supabase function to send email with template data
            const { data, error } = await supabase.functions.invoke('resend-email', {
                body: {
                    to: recipientEmail,
                    subject: `You've received ${amountUsdc} USDC!`,
                    appUrl,
                    templateData: {
                        senderEmail,
                        recipientEmail,
                        amount: amountUsdc,
                        claimUrl,
                        expirationDate: expirationDisplay,
                        currentDate: new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                        })
                    }
                }
            });

            if (error) {
                console.error('❌ Supabase function error:', error);
                
                // Log failed email notification
                await this.logEmailNotification(transferIntentId, recipientEmail, 'failed', error.message);
                
                return {
                    emailId: '',
                    success: false,
                    error: error.message
                };
            }

            console.log('✅ Email sent successfully via Supabase function:', data?.emailId);

            // Log successful email notification
            await this.logEmailNotification(transferIntentId, recipientEmail, 'sent');

            return {
                emailId: data?.emailId || '',
                success: true
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ Failed to send invitation email:', error);

            // Log failed email notification
            await this.logEmailNotification(transferIntentId, recipientEmail, 'failed', errorMessage);

            return {
                emailId: '',
                success: false,
                error: errorMessage
            };
        }
    }


    /**
     * Log email notification to database
     */
    private static async logEmailNotification(
        transferIntentId: string,
        recipientEmail: string,
        status: 'sent' | 'failed',
        errorMessage?: string
    ): Promise<void> {
        try {
            const { error } = await supabase
                .from('transfer_notifications')
                .insert({
                    transfer_intent_id: transferIntentId,
                    notification_type: 'created',
                    email: recipientEmail,
                    status,
                    error_message: errorMessage
                });

            if (error) {
                console.error('❌ Failed to log email notification:', error);
            }
        } catch (error) {
            console.error('❌ Error logging email notification:', error);
        }
    }
    /**
     * Send payment request email
     */
    static async sendPaymentRequest(data: PaymentRequestData): Promise<PaymentRequestResult> {
        const { fromEmail, fromName, toEmail, amount, message, walletAddress } = data;

        console.log('📧 Sending payment request email from:', fromEmail, 'to:', toEmail);

        try {
            // First, save payment request to database
            const { data: requestData, error: dbError } = await supabase
                .from('payment_requests')
                .insert({
                    requester_email: fromEmail,
                    requester_wallet: walletAddress,
                    target_email: toEmail,
                    amount: parseFloat(amount),
                    message: message || null,
                    status: 'sent'
                })
                .select()
                .single();

            if (dbError) {
                console.error('❌ Failed to save payment request:', dbError);
                return {
                    success: false,
                    error: 'Failed to save payment request'
                };
            }

            // Get application URL from environment variable
            const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
            
            // Create payment URL - user can send money to the requester's email
            const paymentUrl = `${appUrl}?send_to=${encodeURIComponent(fromEmail)}&amount=${amount}`;

            // Call Supabase function to send payment request email
            const { data: emailData, error: emailError } = await supabase.functions.invoke('resend-email', {
                body: {
                    to: toEmail,
                    subject: `Payment request for $${amount} USDC from ${fromName || fromEmail}`,
                    appUrl,
                    templateData: {
                        type: 'payment_request',
                        requesterEmail: fromEmail,
                        requesterName: fromName || fromEmail,
                        targetEmail: toEmail,
                        amount: amount,
                        message: message || 'No message',
                        paymentUrl: paymentUrl,
                        currentDate: new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                        })
                    }
                }
            });

            if (emailError) {
                console.error('❌ Failed to send payment request email:', emailError);
                
                // Update payment request status to failed
                await supabase
                    .from('payment_requests')
                    .update({ status: 'failed' })
                    .eq('id', requestData.id);

                return {
                    success: false,
                    error: emailError.message
                };
            }

            console.log('✅ Payment request email sent successfully:', emailData?.emailId);

            return {
                success: true,
                requestId: requestData.id
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ Failed to send payment request:', error);

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Check if email service is properly configured
     */
    static isConfigured(): boolean {
        return !!import.meta.env.VITE_RESEND_FUNCTION_URL;
    }
}

export default EmailNotificationService;