// Service to handle user registration when embedded wallet is created
import { isSolanaWallet } from '@dynamic-labs/solana';
import EmailWalletService from '@/services/emailWallet';

// Track registration attempts to prevent duplicates
const registrationAttempts = new Set<string>();

/**
 * Handle authentication success event and register user
 * This should be called from Dynamic SDK's onAuthSuccess event
 */
export const handleAuthSuccess = async (args: any) => {
  console.log('🎉 onAuthSuccess event triggered');
  console.log('📋 Auth args:', args);
  
  // Extract data from onAuthSuccess args
  const { user, primaryWallet, isAuthenticated } = args;
  
  console.log('🔍 Extracted wallet info:', {
    email: user?.email,
    walletAddress: primaryWallet?.address,
    walletType: primaryWallet?.connector?.name,
    isSolana: primaryWallet ? isSolanaWallet(primaryWallet) : false,
    isAuthenticated
  });
  
  if (isAuthenticated && user?.email && primaryWallet?.address && isSolanaWallet(primaryWallet)) {
    // Create unique key for this email-wallet combination
    const registrationKey = `${user.email}-${primaryWallet.address}`;
    
    // Check if we've already attempted registration for this combination
    if (registrationAttempts.has(registrationKey)) {
      console.log('⏭️ Registration already attempted for:', registrationKey);
      return;
    }
    
    console.log('🚀 Starting registration process for:', registrationKey);
    
    // Mark as attempting registration
    registrationAttempts.add(registrationKey);
    
    try {
      console.log('📞 Calling EmailWalletService.registerEmailWallet...');
      
      const registrationInfo = await EmailWalletService.registerEmailWallet({
        email: user.email,
        walletAddress: primaryWallet.address
      });
      
      console.log('✅ User registered successfully via auth success event:', registrationInfo);
    } catch (error) {
      console.error('❌ Failed to register user via auth success event:', error);
      // Remove from attempts set on failure so it can be retried
      registrationAttempts.delete(registrationKey);
    }
  } else {
    console.log('⏭️ Skipping registration - missing required data or not Solana wallet:', {
      isAuthenticated,
      hasEmail: !!user?.email,
      hasWallet: !!primaryWallet?.address,
      isSolana: primaryWallet ? isSolanaWallet(primaryWallet) : false
    });
  }
};

/**
 * Clear registration attempts (for testing purposes)
 */
export const clearRegistrationAttempts = () => {
  registrationAttempts.clear();
  console.log('🧹 Registration attempts cleared');
};

export default {
  handleAuthSuccess,
  clearRegistrationAttempts
};