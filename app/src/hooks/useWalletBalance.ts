import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { isSolanaWallet } from '@dynamic-labs/solana';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

const USDC_DECIMALS = 6;

export const useWalletBalance = (usdcMintAddress?: string) => {
  const { primaryWallet } = useDynamicContext();
  const [balance, setBalance] = useState<string>("0.00");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  
  const isSolana = primaryWallet && isSolanaWallet(primaryWallet);

  const fetchBalance = useCallback(async () => {
    if (!isSolana || !usdcMintAddress || !primaryWallet) {
      setBalance("0.00");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(undefined);

      const connection = await primaryWallet.getConnection();
      const walletPublicKey = new PublicKey(primaryWallet.address);

      const tokenAccount = await getAssociatedTokenAddress(
        new PublicKey(usdcMintAddress),
        walletPublicKey
      );

      try {
        const tokenAccountInfo = await getAccount(connection, tokenAccount);
        const balanceAmount = Number(tokenAccountInfo.amount) / Math.pow(10, USDC_DECIMALS);
        setBalance(balanceAmount.toFixed(2));
      } catch {
        // Token account doesn't exist, balance is 0
        setBalance("0.00");
      }
    } catch (error) {
      console.error("Error fetching USDC balance:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch USDC balance"
      );
      setBalance("0.00");
    } finally {
      setIsLoading(false);
    }
  }, [isSolana, usdcMintAddress, primaryWallet]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance,
    clearError: () => setError(undefined)
  };
};