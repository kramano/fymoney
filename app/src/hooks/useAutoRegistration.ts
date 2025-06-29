import { useEffect, useRef } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isSolanaWallet } from '@dynamic-labs/solana';
import EmailWalletService from '@/services/emailWallet';

/**
 * Hook to automatically handle user registration when both email and wallet become available
 * This acts as a backup to the onAuthSuccess event handler
 */
export const useAutoRegistration = () => {
  const { user, primaryWallet, sdkHasLoaded } = useDynamicContext();
  const registrationAttempted = useRef(new Set<string>());
  const retryCount = useRef(new Map<string, number>());
  const MAX_RETRIES = 10; // Increased retry count
  const RETRY_DELAY = 1000; // 1 second between retries

  useEffect(() => {
    if (!sdkHasLoaded) {
      console.log('🔄 useAutoRegistration: SDK not loaded yet, waiting...');
      return;
    }

    const attemptRegistration = async () => {
      console.log('🔄 useAutoRegistration: Checking registration conditions...', {
        sdkHasLoaded,
        hasUser: !!user,
        hasEmail: !!user?.email,
        hasWallet: !!primaryWallet?.address,
        isSolana: primaryWallet ? isSolanaWallet(primaryWallet) : false
      });

      // Only attempt if we have all required data
      if (!user?.email) {
        console.log('🔄 useAutoRegistration: User not authenticated or no email');
        return;
      }

      if (!primaryWallet?.address || !isSolanaWallet(primaryWallet)) {
        const email = user.email;
        const currentRetries = retryCount.current.get(email) || 0;
        
        if (currentRetries < MAX_RETRIES) {
          console.log(`🔄 useAutoRegistration: No wallet yet, retry ${currentRetries + 1}/${MAX_RETRIES} in ${RETRY_DELAY}ms for ${email}`);
          retryCount.current.set(email, currentRetries + 1);
          
          setTimeout(() => {
            attemptRegistration();
          }, RETRY_DELAY);
        } else {
          console.warn(`⚠️ useAutoRegistration: Max retries (${MAX_RETRIES}) reached for ${email}`);
          retryCount.current.delete(email);
        }
        return;
      }

      const registrationKey = `${user.email}-${primaryWallet.address}`;
      
      // Check if we've already attempted registration for this combination
      if (registrationAttempted.current.has(registrationKey)) {
        console.log('⏭️ useAutoRegistration: Registration already attempted for:', registrationKey);
        return;
      }

      console.log('🚀 useAutoRegistration: Attempting registration for:', registrationKey);
      
      // Mark as attempted
      registrationAttempted.current.add(registrationKey);
      // Clear retry count since we now have a wallet
      retryCount.current.delete(user.email);

      try {
        // Check if user is already registered first
        const existingUser = await EmailWalletService.getUserByEmail(user.email);
        
        if (existingUser) {
          console.log('✅ useAutoRegistration: User already registered:', existingUser);
          return;
        }

        // Attempt registration
        const registrationInfo = await EmailWalletService.registerEmailWallet({
          email: user.email,
          walletAddress: primaryWallet.address
        });
        
        console.log('✅ useAutoRegistration: Registration successful:', registrationInfo);
      } catch (error) {
        console.error('❌ useAutoRegistration: Registration failed:', error);
        // Remove from attempted set so it can be retried
        registrationAttempted.current.delete(registrationKey);
      }
    };

    // Try immediately
    attemptRegistration();
  }, [sdkHasLoaded, user?.email, primaryWallet?.address, primaryWallet]);

  // Clean up when user or wallet changes
  useEffect(() => {
    return () => {
      registrationAttempted.current.clear();
      retryCount.current.clear();
    };
  }, [user?.email]);
};

export default useAutoRegistration;