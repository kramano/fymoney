export type WalletErrorType = 
  | 'WALLET_CONNECTION_FAILED'
  | 'BALANCE_FETCH_FAILED'
  | 'TRANSACTION_FAILED'
  | 'INVALID_WALLET_TYPE'
  | 'FUNDING_FAILED'
  | 'UNKNOWN_ERROR';

export interface WalletError {
  type: WalletErrorType;
  message: string;
  originalError?: Error;
  timestamp: Date;
}

export const createWalletError = (
  type: WalletErrorType,
  message: string,
  originalError?: Error
): WalletError => ({
  type,
  message,
  originalError,
  timestamp: new Date(),
});

export const formatErrorMessage = (error: WalletError): string => {
  switch (error.type) {
    case 'WALLET_CONNECTION_FAILED':
      return 'Failed to connect to wallet. Please try again.';
    case 'BALANCE_FETCH_FAILED':
      return 'Unable to fetch wallet balance. Please refresh and try again.';
    case 'TRANSACTION_FAILED':
      return 'Transaction failed. Please check your wallet and try again.';
    case 'INVALID_WALLET_TYPE':
      return 'Please connect a Solana wallet to use this application.';
    case 'FUNDING_FAILED':
      return 'Unable to open funding options. Please try again.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
};

export const logError = (error: WalletError): void => {
  console.error(`[${error.type}] ${error.message}`, {
    timestamp: error.timestamp,
    originalError: error.originalError,
  });
};

export const handleAsyncError = <T>(
  promise: Promise<T>,
  errorType: WalletErrorType,
  fallbackMessage?: string
): Promise<T> => {
  return promise.catch((err) => {
    const walletError = createWalletError(
      errorType,
      fallbackMessage || err.message,
      err
    );
    logError(walletError);
    throw walletError;
  });
};