// src/services/transferService.ts

import { supabase } from '@/lib/supabase';
import EmailNotificationService from './emailNotificationService';
import { ENV_CONFIG } from '@/config/environment';

export interface TransferIntent {
    id: string;
    senderWalletAddress: string;
    recipientEmail: string;
    amount: number; // Amount in USDC base units (6 decimals)
    status: 'pending' | 'claimed' | 'expired';
    createdAt: string;
    claimedAt?: string;
    expiresAt: string;
}

export interface CreateTransferIntentParams {
    senderWalletAddress: string;
    senderEmail?: string; // Optional sender email
    recipientEmail: string;
    amount: number; // Amount in USDC base units (6 decimals)
}

export interface UnclaimedTransfer {
    id: string;
    amount: string;
    fromEmail: string;
    fromName?: string;
    message?: string;
    timestamp: Date;
    status: 'pending' | 'claimed' | 'cancelled';
    tokenSymbol: string;
    senderWallet: string;
}

export class TransferIntentService {
    /**
     * Create a new transfer intent for an unregistered recipient
     */
    static async createTransferIntent(params: CreateTransferIntentParams): Promise<TransferIntent> {
        const { senderWalletAddress, senderEmail, recipientEmail, amount } = params;

        console.log('🎯 Creating transfer intent:', {
            sender: senderWalletAddress,
            recipient: recipientEmail,
            amount: amount / 1_000_000 // Log in USDC units for readability
        });

        try {
            // Set expiration to 30 days from now
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            const { data, error } = await supabase
                .from('transfer_intents')
                .insert({
                    sender_wallet: senderWalletAddress,
                    recipient_email: recipientEmail.toLowerCase(),
                    token_mint: ENV_CONFIG.usdcMintAddress,
                    token_symbol: 'USDC',
                    amount: amount / 1_000_000, // Convert to USDC units (numeric with 6 decimals)
                    status: 'pending',
                    expires_at: expiresAt.toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('❌ Supabase error creating transfer intent:', error);
                throw new TransferIntentError(
                    'Failed to create transfer intent',
                    'DATABASE_ERROR'
                );
            }

            console.log('✅ Transfer intent created successfully:', data.id);

            const transferIntent = {
                id: data.id,
                senderWalletAddress: data.sender_wallet,
                recipientEmail: data.recipient_email,
                amount: Math.round(data.amount * 1_000_000), // Convert back to base units
                status: data.status,
                createdAt: data.created_at,
                claimedAt: data.claimed_at,
                expiresAt: data.expires_at
            };

            // Send invitation email automatically
            try {
                if (EmailNotificationService.isConfigured()) {
                    console.log('📧 Sending invitation email...');
                    const emailResult = await EmailNotificationService.sendInvitationEmail({
                        transferIntentId: data.id,
                        senderEmail: senderEmail || `${data.sender_wallet.slice(0, 6)}...${data.sender_wallet.slice(-4)}`,
                        recipientEmail: data.recipient_email,
                        amount: Math.round(data.amount * 1_000_000), // Convert back to base units
                        expirationDate: data.expires_at
                    });

                    if (emailResult.success) {
                        console.log('✅ Invitation email sent successfully:', emailResult.emailId);
                    } else {
                        console.warn('⚠️ Failed to send invitation email:', emailResult.error);
                    }
                } else {
                    console.warn('⚠️ Email service not configured, skipping invitation email');
                }
            } catch (emailError) {
                console.error('❌ Error sending invitation email:', emailError);
                // Don't fail the transfer intent creation if email fails
            }

            return transferIntent;
        } catch (error) {
            if (error instanceof TransferIntentError) {
                throw error;
            }

            console.error('❌ Failed to create transfer intent:', error);
            throw new TransferIntentError(
                'Failed to create transfer intent',
                'UNKNOWN_ERROR'
            );
        }
    }

    /**
     * Get pending transfer intents for a recipient email
     */
    static async getUnclaimedTransfers(recipientEmail: string): Promise<TransferIntent[]> {
        try {
            const { data, error } = await supabase
                .from('transfer_intents')
                .select('*')
                .eq('recipient_email', recipientEmail.toLowerCase())
                .eq('status', 'pending')
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Supabase error getting unclaimed transfers:', error);
                throw new TransferIntentError(
                    'Failed to get unclaimed transfers',
                    'DATABASE_ERROR'
                );
            }

            return data.map(item => ({
                id: item.id,
                senderWalletAddress: item.sender_wallet_address,
                recipientEmail: item.recipient_email,
                amount: item.amount_usdc,
                status: item.status,
                createdAt: item.created_at,
                claimedAt: item.claimed_at,
                expiresAt: item.expires_at
            }));
        } catch (error) {
            if (error instanceof TransferIntentError) {
                throw error;
            }

            console.error('❌ Failed to get unclaimed transfers:', error);
            throw new TransferIntentError(
                'Failed to get unclaimed transfers',
                'UNKNOWN_ERROR'
            );
        }
    }

    /**
     * Claim a transfer intent (to be implemented when claiming flow is built)
     */
    static async claimTransferIntent(intentId: string, recipientWallet: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('transfer_intents')
                .update({
                    status: 'claimed',
                    claimed_at: new Date().toISOString(),
                    claimed_by_wallet: recipientWallet
                })
                .eq('id', intentId)
                .eq('status', 'pending')
                .select()
                .single();

            if (error || !data) {
                console.error('❌ Supabase error claiming transfer intent:', error);
                return false;
            }

            console.log('✅ Transfer intent claimed successfully:', intentId);
            return true;
        } catch (error) {
            console.error('❌ Failed to claim transfer intent:', error);
            return false;
        }
    }

    /**
     * Get transfer intent by ID
     */
    static async getTransferIntent(intentId: string): Promise<TransferIntent | null> {
        try {
            const { data, error } = await supabase
                .from('transfer_intents')
                .select('*')
                .eq('id', intentId)
                .single();

            if (error || !data) {
                return null;
            }

            return {
                id: data.id,
                senderWalletAddress: data.sender_wallet,
                recipientEmail: data.recipient_email,
                amount: Math.round(data.amount * 1_000_000), // Convert back to base units
                status: data.status,
                createdAt: data.created_at,
                claimedAt: data.claimed_at,
                expiresAt: data.expires_at
            };
        } catch (error) {
            console.error('❌ Failed to get transfer intent:', error);
            return null;
        }
    }

    /**
     * Get unclaimed transfers by email for receive modal
     */
    static async getUnclaimedTransfersByEmail(email: string): Promise<{
        transfers: UnclaimedTransfer[];
        totalAmount: number;
    }> {
        try {
            const { data, error } = await supabase
                .from('transfer_intents')
                .select('*')
                .eq('recipient_email', email.toLowerCase())
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(5); // Maximum 5 as per requirements

            if (error) {
                console.error('❌ Supabase error getting unclaimed transfers:', error);
                return { transfers: [], totalAmount: 0 };
            }

            const transfers: UnclaimedTransfer[] = data.map(item => {
                // Handle timezone-aware timestamp parsing
                let validTimestamp = new Date();
                
                if (item.created_at) {
                    // If the timestamp doesn't have timezone info, assume it's UTC
                    const timestampStr = item.created_at.includes('Z') || item.created_at.includes('+') 
                        ? item.created_at 
                        : item.created_at + 'Z'; // Add UTC indicator
                    
                    const parsedTimestamp = new Date(timestampStr);
                    
                    // Debug logging (only for first few items to avoid spam)
                    if (data.indexOf(item) < 2) {
                        console.log('Parsing timestamp:', {
                            original: item.created_at,
                            withTZ: timestampStr,
                            parsed: parsedTimestamp.toISOString(),
                            now: new Date().toISOString(),
                            localTime: parsedTimestamp.toLocaleString(),
                            nowLocal: new Date().toLocaleString(),
                            isValid: !isNaN(parsedTimestamp.getTime()),
                            diffMs: new Date().getTime() - parsedTimestamp.getTime()
                        });
                    }
                    
                    if (!isNaN(parsedTimestamp.getTime())) {
                        validTimestamp = parsedTimestamp;
                    } else {
                        console.warn('Invalid timestamp from database:', item.created_at, 'for transfer:', item.id);
                    }
                }
                
                return {
                    id: item.id,
                    amount: (item.amount).toFixed(2), // Convert to display format
                    fromEmail: item.sender_wallet, // Use wallet as sender identifier for now
                    fromName: undefined,
                    message: item.message || undefined,
                    timestamp: validTimestamp,
                    status: item.status as 'pending' | 'claimed' | 'cancelled',
                    tokenSymbol: item.token_symbol || 'USDC',
                    senderWallet: item.sender_wallet
                };
            });

            const totalAmount = transfers.reduce((sum, transfer) => 
                sum + parseFloat(transfer.amount), 0
            );

            return { transfers, totalAmount };
        } catch (error) {
            console.error('❌ Failed to get unclaimed transfers by email:', error);
            return { transfers: [], totalAmount: 0 };
        }
    }

    /**
     * Claim transfer (non-functional for now)
     */
    static async claimTransfer(transferId: string, walletAddress: string): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }> {
        // NON-FUNCTIONAL FOR NOW - just return success: false
        console.log('🚧 Claim transfer called but not yet implemented:', { transferId, walletAddress });
        
        return { 
            success: false, 
            error: "Claiming not yet implemented" 
        };
    }
}

// Error class for transfer intent operations
export class TransferIntentError extends Error {
    constructor(
        message: string,
        public code: 'DATABASE_ERROR' | 'INVALID_INPUT' | 'NOT_FOUND' | 'UNKNOWN_ERROR'
    ) {
        super(message);
        this.name = 'TransferIntentError';
    }
}

export default TransferIntentService;