// src/hooks/useSendUsdc.ts

import {useState, useCallback} from 'react';
import {useDynamicContext} from '@dynamic-labs/sdk-react-core';
import {isSolanaWallet} from '@dynamic-labs/solana';
import {useToast} from '@/hooks/use-toast';
import EmailResolver from '@/services/emailResolver';
import TransactionService from '@/services/transactionService.ts';
import TransferIntentService from '@/services/transferService';

export interface UseSendUsdcOptions {
    usdcMintAddress?: string;
    rpcUrl?: string;
    onSuccess?: (signature: string) => void;
    onError?: (error: string) => void;
}

export interface UseSendUsdcReturn {
    sendUsdc: (email: string, amount: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
    transactionSignature: string | null;
    clearError: () => void;
    isReady: boolean;
}

export const useSendUsdc = (options: UseSendUsdcOptions = {}): UseSendUsdcReturn => {
    const {primaryWallet, user} = useDynamicContext();
    const {toast} = useToast();

    const {
        usdcMintAddress,
        rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com",
        onSuccess,
        onError
    } = options;

    // State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transactionSignature, setTransactionSignature] = useState<string | null>(null);

    // Check if we're ready to send
    const isSolana = primaryWallet && isSolanaWallet(primaryWallet);
    const isReady = !!(isSolana && usdcMintAddress && rpcUrl);

    // Main send function
    const sendUsdc = useCallback(async (email: string, amount: string) => {
        if (!isReady) {
            const errorMsg = "Wallet not ready for USDC transactions";
            setError(errorMsg);
            toast({
                title: "Transaction Failed",
                description: errorMsg,
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        setError(null);
        setTransactionSignature(null);

        try {
            // Convert amount to lamports (USDC has 6 decimals)
            const amountInLamports = Math.round(parseFloat(amount) * 1_000_000);

            console.log('💸 Processing USDC amount:', amountInLamports, 'base units');

            // Step 1: Try to resolve email to wallet address
            toast({
                title: "Processing transaction...",
                description: `Sending ${amount} USDC to ${email}`,
            });

            console.log('📧 Resolving email to wallet address...');
            const resolvedAddress = await EmailResolver.resolveEmailToAddress(email);

            if (resolvedAddress) {
                // Direct transfer flow - recipient is registered
                console.log('✅ Email resolved to:', resolvedAddress);
                console.log('🎯 Creating direct transfer...');

                // Create gasless transaction
                const gaslessTransaction = await TransactionService.createGaslessTransaction({
                    senderAddress: primaryWallet.address,
                    recipientAddress: resolvedAddress,
                    amount: amountInLamports,
                });

                // Get signer and execute transaction
                const signer = await primaryWallet.getSigner();
                console.log('✍️ User signing gasless transaction...');
                const { signature } = await signer.signAndSendTransaction(gaslessTransaction);

                console.log('✅ Direct transfer successful:', signature);
                setTransactionSignature(signature);
            } else {
                // Transfer intent flow - recipient is not registered
                // Only create database record, NO transaction sent
                console.log('📝 Recipient not registered, creating transfer intent (no transaction sent)...');

                const transferIntent = await TransferIntentService.createTransferIntent({
                    senderWalletAddress: primaryWallet.address,
                    senderEmail: user?.email || undefined,
                    recipientEmail: email,
                    amount: amountInLamports,
                });

                console.log('✅ Transfer intent created (no funds transferred yet):', transferIntent.id);
                setTransactionSignature(transferIntent.id); // Use intent ID as signature for tracking
            }

            // Same success message regardless of flow
            toast({
                title: "Transaction Successful! 🎉",
                description: `Sent ${amount} USDC to ${email}`,
            });

            // Call success callback
            onSuccess?.(transactionSignature || 'intent-created');

        } catch (err) {
            console.error('❌ Gasless transaction failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
            setError(errorMessage);

            toast({
                title: "Transaction Failed",
                description: errorMessage,
                variant: "destructive",
            });

            onError?.(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [
        isReady,
        primaryWallet,
        usdcMintAddress,
        rpcUrl,
        toast,
        onSuccess,
        onError
    ]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        sendUsdc,
        isLoading,
        error,
        transactionSignature,
        clearError,
        isReady
    };
};

export default useSendUsdc;