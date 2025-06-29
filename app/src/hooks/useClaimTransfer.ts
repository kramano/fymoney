import { useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isSolanaWallet } from '@dynamic-labs/solana';
import TransferIntentService from '@/services/transferService';
import GaslessTransactionService from '@/services/gaslessTransactionService';

interface ClaimResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export const useClaimTransfer = () => {
  const { primaryWallet } = useDynamicContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimTransfer = async (transferId: string): Promise<ClaimResult> => {
    if (!primaryWallet || !isSolanaWallet(primaryWallet)) {
      return {
        success: false,
        error: 'No Solana wallet connected'
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🎯 Starting claim transfer process for:', transferId);

      // Step 1: Get transfer intent from database
      const transferIntent = await TransferIntentService.getTransferIntent(transferId);
      if (!transferIntent) {
        throw new Error('Transfer not found');
      }

      // Step 2: Validate transfer can be claimed
      if (!transferIntent.escrowPda) {
        throw new Error('This transfer cannot be claimed - no escrow found');
      }

      if (transferIntent.status === 'claimed') {
        throw new Error('Transfer has already been claimed');
      }

      if (transferIntent.status === 'expired' || new Date(transferIntent.expiresAt) < new Date()) {
        throw new Error('Transfer has expired');
      }

      console.log('✅ Transfer validation passed, creating transaction...');

      // Step 3: Create claim transaction
      const transactionResult = await GaslessTransactionService.claimEscrowTransaction(
        transferIntent.escrowPda,
        primaryWallet.address
      );

      console.log('✅ Transaction created, requesting user signature...');

      // Step 4: Sign and send transaction with user's wallet
      const signer = await primaryWallet.getSigner();
      const { signature: txHash } = await signer.signAndSendTransaction(transactionResult.transaction);

      console.log('✅ Transaction signed and sent, updating database...');

      // Step 5: Update database status after successful transaction
      const updateResult = await TransferIntentService.claimTransferIntent(transferId, primaryWallet.address, txHash);
      
      if (!updateResult.success) {
        console.warn('⚠️ Transaction succeeded but database update failed:', updateResult.error);
        // Transaction succeeded on-chain, so we still return success
        // The database inconsistency will need to be handled separately
      }

      console.log('🎉 Claim transfer completed successfully!', { txHash });

      return {
        success: true,
        txHash
      };

    } catch (error) {
      console.error('❌ Failed to claim transfer:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to claim transfer';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return {
    claimTransfer,
    isLoading,
    error,
    clearError
  };
};

export default useClaimTransfer;