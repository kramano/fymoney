import { useState, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isSolanaWallet } from '@dynamic-labs/solana';
import { useToast } from '@/hooks/use-toast';
import { useSendUsdc } from '@/hooks/useSendUsdc';
import { useEscrow } from '@/hooks/useEscrow';
import EmailResolver from '@/services/emailResolver';

export type SendMethod = 'direct' | 'escrow';

export interface UseSendWithEscrowOptions {
  usdcMintAddress?: string;
  onSuccess?: (signature: string, method: SendMethod) => void;
  onError?: (error: string) => void;
}

export interface UseSendWithEscrowReturn {
  sendWithMethod: (email: string, amount: string, method: SendMethod, expirationDays?: number) => Promise<void>;
  checkRecipientStatus: (email: string) => Promise<'registered' | 'not-registered'>;
  recommendedMethod: SendMethod | null;
  isLoading: boolean;
  error: string | null;
  transactionSignature: string | null;
  clearError: () => void;
  isReady: boolean;
}

export const useSendWithEscrow = (options: UseSendWithEscrowOptions = {}): UseSendWithEscrowReturn => {
  const { primaryWallet } = useDynamicContext();
  const { toast } = useToast();

  const { usdcMintAddress, onSuccess, onError } = options;

  // State
  const [recommendedMethod, setRecommendedMethod] = useState<SendMethod | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);

  // Initialize hooks
  const sendUsdcHook = useSendUsdc({
    usdcMintAddress,
    onSuccess: (signature) => {
      setTransactionSignature(signature);
      onSuccess?.(signature, 'direct');
    },
    onError: (error) => {
      setError(error);
      onError?.(error);
    }
  });

  const escrowHook = useEscrow({
    onSuccess: (signature) => {
      setTransactionSignature(signature);
      onSuccess?.(signature, 'escrow');
    },
    onError: (error) => {
      setError(error);
      onError?.(error);
    }
  });

  // Check if we're ready
  const isSolana = primaryWallet && isSolanaWallet(primaryWallet);
  const isReady = !!(isSolana && usdcMintAddress);

  // Check recipient status and recommend method
  const checkRecipientStatus = useCallback(async (email: string): Promise<'registered' | 'not-registered'> => {
    try {
      const resolvedAddress = await EmailResolver.resolveEmailToAddress(email);
      const status = resolvedAddress ? 'registered' : 'not-registered';
      
      // Set recommended method based on status
      setRecommendedMethod(status === 'registered' ? 'direct' : 'escrow');
      
      return status;
    } catch (error) {
      console.error('Error checking recipient status:', error);
      setRecommendedMethod('escrow'); // Default to escrow on error
      return 'not-registered';
    }
  }, []);

  // Main send function that routes to appropriate method
  const sendWithMethod = useCallback(async (
    email: string, 
    amount: string, 
    method: SendMethod,
    expirationDays: number = 7
  ) => {
    if (!isReady) {
      const errorMsg = "Wallet not ready for transactions";
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
      if (method === 'direct') {
        // Check if recipient is actually registered for direct transfer
        const recipientStatus = await checkRecipientStatus(email);
        if (recipientStatus === 'not-registered') {
          throw new Error('Recipient is not registered. Please use escrow method.');
        }
        
        // Use existing USDC hook for direct transfer
        await sendUsdcHook.sendUsdc(email, amount);
      } else {
        // Use escrow for unregistered recipients or when explicitly chosen
        const amountInBaseUnits = Math.round(parseFloat(amount) * 1_000_000);
        
        await escrowHook.createEscrow({
          senderAddress: primaryWallet.address,
          recipientEmail: email,
          amount: amountInBaseUnits,
          expirationDays
        });
      }
    } catch (err) {
      console.error(`❌ ${method} send failed:`, err);
      const errorMessage = err instanceof Error ? err.message : `${method} send failed`;
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
    toast,
    sendUsdcHook,
    escrowHook,
    onSuccess,
    onError,
    checkRecipientStatus
  ]);

  const clearError = useCallback(() => {
    setError(null);
    sendUsdcHook.clearError();
    escrowHook.clearError();
  }, [sendUsdcHook, escrowHook]);

  // Aggregate loading state from both hooks
  const aggregatedIsLoading = isLoading || sendUsdcHook.isLoading || escrowHook.isLoading;

  // Aggregate error state
  const aggregatedError = error || sendUsdcHook.error || escrowHook.error;

  // Use the most recent transaction signature
  const aggregatedSignature = transactionSignature || sendUsdcHook.transactionSignature || escrowHook.transactionSignature;

  return {
    sendWithMethod,
    checkRecipientStatus,
    recommendedMethod,
    isLoading: aggregatedIsLoading,
    error: aggregatedError,
    transactionSignature: aggregatedSignature,
    clearError,
    isReady
  };
};

export default useSendWithEscrow;