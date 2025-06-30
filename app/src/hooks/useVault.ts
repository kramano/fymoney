import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isSolanaWallet } from '@dynamic-labs/solana';
import { PublicKey } from '@solana/web3.js';
import TransactionService from '@/services/transactionService';

interface VaultState {
  userBalance: number;
  totalDeposits: number;
  hasDeposit: boolean;
  isLoading: boolean;
  error: string | null;
}

interface VaultActions {
  deposit: (amount: number) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  withdraw: (amount: number) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  refreshBalance: () => Promise<void>;
  clearError: () => void;
}

export const useVault = (): VaultState & VaultActions => {
  const { primaryWallet } = useDynamicContext();
  const [state, setState] = useState<VaultState>({
    userBalance: 0,
    totalDeposits: 0,
    hasDeposit: false,
    isLoading: false,
    error: null
  });

  // Refresh vault data
  const refreshBalance = async () => {
    if (!primaryWallet || !isSolanaWallet(primaryWallet)) {
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const userWallet = new PublicKey(primaryWallet.address);
      
      const [userBalance, totalDeposits, hasDeposit] = await Promise.all([
        TransactionService.getUserVaultBalance(userWallet),
        TransactionService.getVaultTotalDeposits(),
        TransactionService.hasVaultDeposit(userWallet)
      ]);

      setState(prev => ({
        ...prev,
        userBalance,
        totalDeposits,
        hasDeposit,
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to refresh vault balance:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to load vault data',
        isLoading: false
      }));
    }
  };

  // Load initial data when wallet connects
  useEffect(() => {
    if (primaryWallet && isSolanaWallet(primaryWallet)) {
      refreshBalance();
    }
  }, [primaryWallet?.address]);

  // Deposit funds to vault
  const deposit = async (amount: number): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!primaryWallet || !isSolanaWallet(primaryWallet)) {
      return {
        success: false,
        error: 'No Solana wallet connected'
      };
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const userWallet = new PublicKey(primaryWallet.address);
      
      // Create deposit transaction
      const transactionResult = await TransactionService.createDepositTransaction(
        userWallet,
        amount
      );

      // Sign and send transaction
      const signer = await primaryWallet.getSigner();
      const { signature: txHash } = await signer.signAndSendTransaction(transactionResult.transaction);

      // Refresh balance after successful deposit
      await refreshBalance();

      setState(prev => ({ ...prev, isLoading: false }));

      return {
        success: true,
        txHash
      };
    } catch (error) {
      console.error('Vault deposit failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Deposit failed';
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  // Withdraw funds from vault
  const withdraw = async (amount: number): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!primaryWallet || !isSolanaWallet(primaryWallet)) {
      return {
        success: false,
        error: 'No Solana wallet connected'
      };
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const userWallet = new PublicKey(primaryWallet.address);
      
      // Create withdraw transaction
      const transactionResult = await TransactionService.createWithdrawTransaction(
        userWallet,
        amount
      );

      // Sign and send transaction
      const signer = await primaryWallet.getSigner();
      const { signature: txHash } = await signer.signAndSendTransaction(transactionResult.transaction);

      // Refresh balance after successful withdrawal
      await refreshBalance();

      setState(prev => ({ ...prev, isLoading: false }));

      return {
        success: true,
        txHash
      };
    } catch (error) {
      console.error('Vault withdraw failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Withdrawal failed';
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  return {
    ...state,
    deposit,
    withdraw,
    refreshBalance,
    clearError
  };
};

export default useVault;