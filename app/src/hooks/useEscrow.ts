import { useState, useCallback, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isSolanaWallet } from '@dynamic-labs/solana';
import { useToast } from '@/hooks/use-toast';
import { escrowService, CreateEscrowParams, EscrowInfo } from '@/services/escrowService';
import { PublicKey } from '@solana/web3.js';

export interface UseEscrowOptions {
  onSuccess?: (signature: string, escrowInfo: EscrowInfo) => void;
  onError?: (error: string) => void;
}

export interface UseEscrowReturn {
  createEscrow: (params: CreateEscrowParams) => Promise<void>;
  claimEscrow: (escrowPDA: string) => Promise<void>;
  reclaimExpiredEscrow: (escrowPDA: string) => Promise<void>;
  getEscrowsForSender: () => Promise<any[]>;
  findEscrowByEmail: (recipientEmail: string) => Promise<any[]>;
  isLoading: boolean;
  error: string | null;
  transactionSignature: string | null;
  clearError: () => void;
  isReady: boolean;
}

export const useEscrow = (options: UseEscrowOptions = {}): UseEscrowReturn => {
  const { primaryWallet } = useDynamicContext();
  const { toast } = useToast();

  const { onSuccess, onError } = options;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);

  // Check if we're ready for escrow operations
  const isSolana = primaryWallet && isSolanaWallet(primaryWallet);
  const isReady = !!(isSolana);

  // Initialize escrow service when wallet is ready
  useEffect(() => {
    if (isSolana) {
      try {
        escrowService.initializeProgram(primaryWallet);
      } catch (error) {
        console.error('Failed to initialize escrow service:', error);
      }
    }
  }, [isSolana, primaryWallet]);

  // Create escrow
  const createEscrow = useCallback(async (params: CreateEscrowParams) => {
    if (!isReady) {
      const errorMsg = "Wallet not ready for escrow transactions";
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
      toast({
        title: "Creating escrow...",
        description: `Setting up escrow for ${params.amount / 1_000_000} USDC`,
      });

      // Prepare transaction
      const { transaction, escrowInfo } = await escrowService.prepareCreateEscrowTransaction({
        ...params,
        senderAddress: primaryWallet.address
      });

      // Get signer and execute transaction
      const signer = await primaryWallet.getSigner();
      console.log('About to send escrow transaction:', transaction);
      console.log('✍️ User signing escrow transaction...');
      const { signature } = await signer.signAndSendTransaction(transaction);

      console.log('✅ Escrow created successfully:', signature);
      console.log('📋 Escrow info:', escrowInfo);
      
      setTransactionSignature(signature);

      toast({
        title: "Escrow Created! 🎉",
        description: `Escrow created for ${params.amount / 1_000_000} USDC to ${params.recipientEmail}`,
      });

      onSuccess?.(signature, escrowInfo);

    } catch (err) {
      console.error('❌ Escrow creation failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Escrow creation failed';
      setError(errorMessage);

      toast({
        title: "Escrow Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });

      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, primaryWallet, toast, onSuccess, onError]);

  // Claim escrow
  const claimEscrow = useCallback(async (escrowPDA: string) => {
    if (!isReady) {
      const errorMsg = "Wallet not ready for escrow transactions";
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
      toast({
        title: "Claiming escrow...",
        description: "Processing your claim request",
      });

      // Prepare transaction
      const transaction = await escrowService.prepareClaimEscrowTransaction(
        new PublicKey(escrowPDA),
        primaryWallet.address
      );

      // Get signer and execute transaction
      const signer = await primaryWallet.getSigner();
      console.log('✍️ User signing claim transaction...');
      const { signature } = await signer.signAndSendTransaction(transaction);

      console.log('✅ Escrow claimed successfully:', signature);
      setTransactionSignature(signature);

      toast({
        title: "Escrow Claimed! 🎉",
        description: "You have successfully claimed the escrow",
      });

      onSuccess?.(signature, {} as EscrowInfo);

    } catch (err) {
      console.error('❌ Escrow claim failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Escrow claim failed';
      setError(errorMessage);

      toast({
        title: "Escrow Claim Failed",
        description: errorMessage,
        variant: "destructive",
      });

      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, primaryWallet, toast, onSuccess, onError]);

  // Reclaim expired escrow
  const reclaimExpiredEscrow = useCallback(async (escrowPDA: string) => {
    if (!isReady) {
      const errorMsg = "Wallet not ready for escrow transactions";
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
      toast({
        title: "Reclaiming expired escrow...",
        description: "Processing your reclaim request",
      });

      // Prepare transaction
      const transaction = await escrowService.prepareReclaimExpiredEscrowTransaction(
        new PublicKey(escrowPDA),
        primaryWallet.address
      );

      // Get signer and execute transaction
      const signer = await primaryWallet.getSigner();
      console.log('✍️ User signing reclaim transaction...');
      const { signature } = await signer.signAndSendTransaction(transaction);

      console.log('✅ Expired escrow reclaimed successfully:', signature);
      setTransactionSignature(signature);

      toast({
        title: "Escrow Reclaimed! 🎉",
        description: "You have successfully reclaimed the expired escrow",
      });

      onSuccess?.(signature, {} as EscrowInfo);

    } catch (err) {
      console.error('❌ Escrow reclaim failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Escrow reclaim failed';
      setError(errorMessage);

      toast({
        title: "Escrow Reclaim Failed",
        description: errorMessage,
        variant: "destructive",
      });

      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, primaryWallet, toast, onSuccess, onError]);

  // Get escrows for sender
  const getEscrowsForSender = useCallback(async () => {
    if (!isReady) {
      return [];
    }

    try {
      return await escrowService.getEscrowsForSender(primaryWallet.address);
    } catch (error) {
      console.error('Error fetching escrows:', error);
      return [];
    }
  }, [isReady, primaryWallet]);

  // Find escrow by email
  const findEscrowByEmail = useCallback(async (recipientEmail: string) => {
    if (!isReady) {
      return [];
    }

    try {
      return await escrowService.findEscrowByEmail(primaryWallet.address, recipientEmail);
    } catch (error) {
      console.error('Error finding escrow by email:', error);
      return [];
    }
  }, [isReady, primaryWallet]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    createEscrow,
    claimEscrow,
    reclaimExpiredEscrow,
    getEscrowsForSender,
    findEscrowByEmail,
    isLoading,
    error,
    transactionSignature,
    clearError,
    isReady
  };
};

export default useEscrow;