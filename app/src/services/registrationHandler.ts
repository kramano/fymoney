// Service to handle Dynamic SDK events
// Note: Actual registration is handled by the useAutoRegistration hook
// These event handlers are mainly for logging and debugging
import { isSolanaWallet } from '@dynamic-labs/solana';

/**
 * Handle authentication success event 
 * Note: This event typically fires before embedded wallets are created,
 * so we rely on the useAutoRegistration hook for actual registration
 */
export const handleAuthSuccess = async (args: any) => {
  console.log('🎉 onAuthSuccess event triggered');
  console.log('📋 Auth args:', args);
  
  // Extract data from onAuthSuccess args (primaryWallet is often null here)
  const { user, primaryWallet, isAuthenticated } = args;
  
  console.log('🔍 Auth success info:', {
    email: user?.email,
    walletAddress: primaryWallet?.address,
    walletType: primaryWallet?.connector?.name,
    isSolana: primaryWallet ? isSolanaWallet(primaryWallet) : false,
    isAuthenticated
  });
  
  // Note: We don't attempt registration here because primaryWallet is usually null
  // The useAutoRegistration hook will handle registration when the wallet becomes available
  if (isAuthenticated && user?.email) {
    console.log('✅ User authenticated with email, registration will be handled by useAutoRegistration hook');
  } else {
    console.log('⏭️ Auth success but missing required data');
  }
};

/**
 * Handle embedded wallet creation event
 * Note: This event may also not have reliable access to wallet info in args,
 * so we primarily rely on the useAutoRegistration hook for registration
 */
export const handleEmbeddedWalletCreated = async (args: any) => {
  console.log('🔗 onEmbeddedWalletCreated event triggered');
  console.log('📋 Wallet creation args:', args);
  
  // Log whatever data we get from the event
  console.log('🔍 Embedded wallet creation info:', args);
  
  // Note: We don't attempt registration directly here either
  // The useAutoRegistration hook will handle registration more reliably
  console.log('✅ Embedded wallet creation event received, registration handled by useAutoRegistration hook');
};

export default {
  handleAuthSuccess,
  handleEmbeddedWalletCreated
};