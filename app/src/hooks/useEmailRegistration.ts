import { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isSolanaWallet } from '@dynamic-labs/solana';
import EmailWalletService, { EmailWalletError, type EmailWalletInfo } from '@/services/emailWallet';
import { useToast } from '@/hooks/use-toast';

export interface UseEmailRegistrationOptions {
  onRegistrationSuccess?: (info: EmailWalletInfo) => void;
  onRegistrationError?: (error: EmailWalletError) => void;
}

export interface UseEmailRegistrationReturn {
  isRegistered: boolean | null; // null = checking, true/false = determined
  registrationInfo: EmailWalletInfo | null;
  isLoading: boolean;
  error: string | null;
  registerCurrentUser: () => Promise<void>;
  checkRegistration: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook to manage user email-to-wallet registration with Dynamic
 * Provides manual registration and status checking capabilities
 * Registration is automatically triggered via Dynamic events
 * Status checking must be called manually via checkRegistration()
 */
export const useEmailRegistration = (
  options: UseEmailRegistrationOptions = {}
): UseEmailRegistrationReturn => {
  const { primaryWallet, user } = useDynamicContext();
  const { toast } = useToast();
  
  const {
    onRegistrationSuccess,
    onRegistrationError
  } = options;

  // State
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [registrationInfo, setRegistrationInfo] = useState<EmailWalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if we have the required data
  const isSolana = primaryWallet && isSolanaWallet(primaryWallet);
  const hasEmail = user?.email;
  const hasWallet = primaryWallet?.address;
  const isReady = isSolana && hasEmail && hasWallet;

  /**
   * Check if current user is already registered
   */
  const checkRegistration = useCallback(async () => {
    if (!isReady) {
      setIsRegistered(null);
      setRegistrationInfo(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const userInfo = await EmailWalletService.getUserByEmail(user.email!);
      
      if (userInfo) {
        // Check if the registered wallet matches current wallet
        const walletMatches = userInfo.walletAddress === primaryWallet.address;
        
        if (walletMatches) {
          setIsRegistered(true);
          setRegistrationInfo(userInfo);
        } else {
          // Email is registered but with different wallet
          setIsRegistered(false);
          setRegistrationInfo(null);
          setError(`Email ${user.email} is registered with a different wallet address`);
        }
      } else {
        setIsRegistered(false);
        setRegistrationInfo(null);
      }
    } catch (err) {
      console.error('Failed to check registration:', err);
      
      const errorMessage = err instanceof EmailWalletError 
        ? err.message 
        : 'Failed to check registration status';
      
      setError(errorMessage);
      setIsRegistered(null);
      setRegistrationInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, user?.email, primaryWallet?.address]);

  /**
   * Register current user's email and wallet
   */
  const registerCurrentUser = useCallback(async () => {
    if (!isReady) {
      const errorMsg = 'Cannot register: missing email or wallet';
      setError(errorMsg);
      toast({
        title: "Registration Failed",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const registrationInfo = await EmailWalletService.registerEmailWallet({
        email: user.email!,
        walletAddress: primaryWallet.address
      });

      setIsRegistered(true);
      setRegistrationInfo(registrationInfo);

      toast({
        title: "Registration Successful! 🎉",
        description: `Your email ${user.email} is now linked to your wallet`,
      });

      onRegistrationSuccess?.(registrationInfo);
    } catch (err) {
      console.error('Failed to register user:', err);
      
      let errorMessage = 'Failed to register email and wallet';
      
      if (err instanceof EmailWalletError) {
        switch (err.code) {
          case 'EMAIL_EXISTS':
            errorMessage = `Email ${user.email} is already registered with another wallet`;
            break;
          case 'WALLET_EXISTS':
            errorMessage = 'This wallet is already registered with another email';
            break;
          case 'INVALID_INPUT':
            errorMessage = 'Invalid email or wallet address format';
            break;
          default:
            errorMessage = err.message;
        }
        
        onRegistrationError?.(err);
      }
      
      setError(errorMessage);
      setIsRegistered(false);
      setRegistrationInfo(null);

      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isReady, user?.email, primaryWallet?.address, toast, onRegistrationSuccess, onRegistrationError]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset state when wallet/email changes but don't auto-check
  useEffect(() => {
    if (!isReady) {
      // Reset state when not ready
      setIsRegistered(null);
      setRegistrationInfo(null);
      setError(null);
    }
    // Note: No automatic checkRegistration() call - must be called manually
  }, [isReady]);

  // Note: Auto-registration removed - registration now happens via Dynamic events

  return {
    isRegistered,
    registrationInfo,
    isLoading,
    error,
    registerCurrentUser,
    checkRegistration,
    clearError
  };
};

export default useEmailRegistration;