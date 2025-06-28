// src/services/accountDeletion.ts
import { supabase } from '@/lib/supabase';

export interface AccountDeletionResult {
  success: boolean;
  error?: string;
  deletedData?: {
    userProfiles: number;
    transferIntents: number;
    emailMappings: number;
  };
}

export class AccountDeletionService {
  /**
   * Delete all user data from Supabase and clear local storage
   * This removes:
   * - User profile data
   * - Transfer intents
   * - Email-to-wallet mappings
   * - Any other associated data
   */
  static async deleteUserAccount(userEmail: string, walletAddress: string): Promise<AccountDeletionResult> {
    try {
      console.log('Starting account deletion for:', { userEmail, walletAddress });
      
      const deletedData = {
        userProfiles: 0,
        transferIntents: 0,
        emailMappings: 0
      };

      // Only proceed if Supabase is configured
      if (!this.isSupabaseConfigured()) {
        console.warn('Supabase not configured, skipping database cleanup');
        this.clearLocalData();
        return {
          success: true,
          deletedData
        };
      }

      // 1. Delete user profile data
      try {
        const { count: profileCount, error: profileError } = await supabase
          .from('user_profiles')
          .delete({ count: 'exact' })
          .or(`email.eq.${userEmail},wallet_address.eq.${walletAddress}`);

        if (profileError) {
          console.error('Error deleting user profiles:', profileError);
        } else {
          deletedData.userProfiles = profileCount || 0;
          console.log(`Deleted ${profileCount} user profile records`);
        }
      } catch (error) {
        console.error('Failed to delete user profiles:', error);
      }

      // 2. Delete transfer intents (if table exists)
      try {
        const { count: intentCount, error: intentError } = await supabase
          .from('transfer_intents')
          .delete({ count: 'exact' })
          .or(`sender_email.eq.${userEmail},recipient_email.eq.${userEmail},sender_address.eq.${walletAddress}`);

        if (intentError && !intentError.message.includes('does not exist')) {
          console.error('Error deleting transfer intents:', intentError);
        } else if (!intentError) {
          deletedData.transferIntents = intentCount || 0;
          console.log(`Deleted ${intentCount} transfer intent records`);
        }
      } catch (error) {
        console.error('Failed to delete transfer intents:', error);
      }

      // 3. Delete email wallet mappings (if table exists)
      try {
        const { count: emailCount, error: emailError } = await supabase
          .from('email_wallets')
          .delete({ count: 'exact' })
          .or(`email.eq.${userEmail},wallet_address.eq.${walletAddress}`);

        if (emailError && !emailError.message.includes('does not exist')) {
          console.error('Error deleting email mappings:', emailError);
        } else if (!emailError) {
          deletedData.emailMappings = emailCount || 0;
          console.log(`Deleted ${emailCount} email mapping records`);
        }
      } catch (error) {
        console.error('Failed to delete email mappings:', error);
      }

      // 4. Clear local data
      this.clearLocalData();

      console.log('Account deletion completed successfully:', deletedData);

      return {
        success: true,
        deletedData
      };

    } catch (error) {
      console.error('Account deletion failed:', error);
      
      // Still try to clear local data even if database deletion failed
      this.clearLocalData();

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during account deletion'
      };
    }
  }

  /**
   * Clear local storage and any cached data
   */
  private static clearLocalData(): void {
    try {
      // Clear localStorage items that might contain user data
      const keysToRemove = [
        'fy-user-settings',
        'fy-notification-preferences', 
        'fy-cached-balance',
        'fy-transaction-history',
        'fy-last-sync'
      ];

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      // Clear sessionStorage
      sessionStorage.clear();

      console.log('Local data cleared successfully');
    } catch (error) {
      console.error('Failed to clear local data:', error);
    }
  }

  /**
   * Check if Supabase is properly configured
   */
  private static isSupabaseConfigured(): boolean {
    return !!(
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );
  }

  /**
   * Validate user data before deletion
   */
  static validateDeletionData(userEmail: string, walletAddress: string): boolean {
    if (!userEmail || !walletAddress) {
      console.error('Invalid deletion data: email and wallet address are required');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      console.error('Invalid email format');
      return false;
    }

    // Basic wallet address validation (Solana addresses are typically 32-44 characters)
    if (walletAddress.length < 32 || walletAddress.length > 44) {
      console.error('Invalid wallet address format');
      return false;
    }

    return true;
  }

  /**
   * Get account data summary before deletion (for confirmation)
   */
  static async getAccountDataSummary(userEmail: string, walletAddress: string): Promise<{
    userProfiles: number;
    transferIntents: number;
    emailMappings: number;
  }> {
    const summary = {
      userProfiles: 0,
      transferIntents: 0,
      emailMappings: 0
    };

    if (!this.isSupabaseConfigured()) {
      return summary;
    }

    try {
      // Count user profiles
      const { count: profileCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .or(`email.eq.${userEmail},wallet_address.eq.${walletAddress}`);
      
      summary.userProfiles = profileCount || 0;

      // Count transfer intents
      const { count: intentCount } = await supabase
        .from('transfer_intents')
        .select('*', { count: 'exact', head: true })
        .or(`sender_email.eq.${userEmail},recipient_email.eq.${userEmail},sender_address.eq.${walletAddress}`);
      
      summary.transferIntents = intentCount || 0;

      // Count email mappings
      const { count: emailCount } = await supabase
        .from('email_wallets')
        .select('*', { count: 'exact', head: true })
        .or(`email.eq.${userEmail},wallet_address.eq.${walletAddress}`);
      
      summary.emailMappings = emailCount || 0;

    } catch (error) {
      console.error('Failed to get account data summary:', error);
    }

    return summary;
  }
}