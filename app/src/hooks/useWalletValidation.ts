import { useEffect, useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isSolanaWallet } from '@dynamic-labs/solana';

const SOLANA_WALLET_REQUIRED_ERROR = "This application requires a Solana wallet. Please connect a Solana wallet to continue.";

export const useWalletValidation = () => {
  const { primaryWallet } = useDynamicContext();
  const [validationError, setValidationError] = useState<string | undefined>(undefined);
  
  const isSolana = primaryWallet && isSolanaWallet(primaryWallet);
  const isValidWallet = primaryWallet && isSolana;

  useEffect(() => {
    if (primaryWallet && !isSolana) {
      setValidationError(SOLANA_WALLET_REQUIRED_ERROR);
    } else if (primaryWallet && isSolana) {
      // Clear validation error when valid wallet is connected
      if (validationError === SOLANA_WALLET_REQUIRED_ERROR) {
        setValidationError(undefined);
      }
    }
  }, [primaryWallet, isSolana, validationError]);

  return {
    isValidWallet,
    isSolana,
    validationError,
    clearValidationError: () => setValidationError(undefined)
  };
};