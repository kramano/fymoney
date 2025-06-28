import { supabase } from '@/lib/supabase';
import CryptoJS from 'crypto-js';

export interface RegisterEmailWalletParams {
  email: string;
  walletAddress: string;
}

export interface EmailWalletInfo {
  email: string;
  walletAddress: string;
  name?: string;
  verified: boolean;
  registeredAt: Date;
  lastUpdated: Date;
  isActive: boolean;
}

export class EmailWalletError extends Error {
  constructor(
    message: string,
    public code: 'EMAIL_EXISTS' | 'WALLET_EXISTS' | 'NOT_FOUND' | 'DATABASE_ERROR' | 'INVALID_INPUT',
    public originalError?: Error
  ) {
    super(message);
    this.name = 'EmailWalletError';
  }
}

/**
 * Service for managing email-to-wallet address mappings in Supabase
 */
export class EmailWalletService {
  // Track ongoing registration attempts to prevent race conditions
  private static pendingRegistrations = new Map<string, Promise<EmailWalletInfo>>();
  
  /**
   * Helper method to detect 406 "Not Acceptable" errors from Supabase
   * These often indicate RLS policy issues but the operation might still succeed
   */
  private static is406Error(error: any): boolean {
    console.log('🔍 Checking if error is 406:', {
      error,
      code: error?.code,
      status: error?.status,
      statusCode: error?.statusCode,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    
    const is406 = error && (
      error.code === '406' || 
      error.status === 406 ||
      error.statusCode === 406 ||
      (error.message && error.message.includes('406')) ||
      (error.message && error.message.includes('Not Acceptable')) ||
      (error.details && error.details.includes('406')) ||
      (error.hint && error.hint.includes('406'))
    );
    
    console.log('🔍 Is 406 error:', is406);
    return is406;
  }
  
  /**
   * Generate email hash for privacy-preserving lookups
   * Uses the same logic as the database trigger function:
   * encode(digest(lower(trim(email)), 'sha256'), 'hex')
   */
  private static generateEmailHash(email: string): string {
    // Normalize email exactly like PostgreSQL: lower(trim(email))
    const normalizedEmail = email.toLowerCase().trim();
    
    // Use SHA-256 to match PostgreSQL's digest(email, 'sha256')
    const hash = CryptoJS.SHA256(normalizedEmail);
    
    // Convert to hex string to match PostgreSQL's encode(..., 'hex')
    const hashHex = hash.toString(CryptoJS.enc.Hex);
    
    console.log('🔑 Email hash generation:', {
      originalEmail: email,
      normalizedEmail,
      generatedHash: hashHex,
      expectedForMaxRindon: '2f65bf9fa282d8c5ed3ad9948bdadadff769cb90665207fbb97f374003be8ade',
      matches: hashHex === '2f65bf9fa282d8c5ed3ad9948bdadadff769cb90665207fbb97f374003be8ade' && email.toLowerCase().trim() === 'max.rindon@gmail.com'
    });
    
    return hashHex;
  }

  /**
   * Get wallet address by email
   */
  static async getWalletByEmail(email: string): Promise<string | null> {
    try {
      if (!email || !email.includes('@')) {
        throw new EmailWalletError('Invalid email format', 'INVALID_INPUT');
      }

      const emailHash = this.generateEmailHash(email);
      
      const { data, error } = await supabase
        .from('email_wallets')
        .select('wallet_address')
        .eq('email_hash', emailHash)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Database error in getWalletByEmail:', error);
        throw new EmailWalletError(
          'Failed to query email wallet mapping',
          'DATABASE_ERROR',
          error
        );
      }

      return data?.wallet_address || null;
    } catch (error) {
      if (error instanceof EmailWalletError) {
        throw error;
      }
      
      console.error('Unexpected error in getWalletByEmail:', error);
      throw new EmailWalletError(
        'An unexpected error occurred while looking up wallet address',
        'DATABASE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get full user info by email
   */
  static async getUserByEmail(email: string): Promise<EmailWalletInfo | null> {
    try {
      if (!email || !email.includes('@')) {
        throw new EmailWalletError('Invalid email format', 'INVALID_INPUT');
      }

      const emailHash = this.generateEmailHash(email);
      
      const { data, error } = await supabase
        .from('email_wallets')
        .select('*')
        .eq('email_hash', emailHash)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Database error in getUserByEmail:', error);
        throw new EmailWalletError(
          'Failed to query user information',
          'DATABASE_ERROR',
          error
        );
      }

      if (!data) {
        return null;
      }

      return {
        email: data.email,
        walletAddress: data.wallet_address,
        verified: true, // All registered users are considered verified
        registeredAt: new Date(data.first_registered_at),
        lastUpdated: new Date(data.last_updated_at),
        isActive: data.is_active
      };
    } catch (error) {
      if (error instanceof EmailWalletError) {
        throw error;
      }
      
      console.error('Unexpected error in getUserByEmail:', error);
      throw new EmailWalletError(
        'An unexpected error occurred while looking up user information',
        'DATABASE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Register new email-to-wallet mapping (idempotent)
   * If the exact same email-wallet combination already exists, returns the existing record
   */
  static async registerEmailWallet(params: RegisterEmailWalletParams): Promise<EmailWalletInfo> {
    const { email, walletAddress } = params;
    
    console.log('🎯 EmailWalletService.registerEmailWallet called with:', { email, walletAddress });

    // Validate inputs
    if (!email || !email.includes('@')) {
      console.error('❌ Invalid email format:', email);
      throw new EmailWalletError('Invalid email format', 'INVALID_INPUT');
    }

    if (!walletAddress || walletAddress.length < 32) {
      console.error('❌ Invalid wallet address format:', walletAddress);
      throw new EmailWalletError('Invalid wallet address format', 'INVALID_INPUT');
    }

    // Create unique key for this registration attempt
    const registrationKey = `${email.toLowerCase().trim()}-${walletAddress}`;
    
    // Check if there's already a pending registration for this exact combination
    if (this.pendingRegistrations.has(registrationKey)) {
      console.log('⏳ Registration already in progress for:', registrationKey);
      return await this.pendingRegistrations.get(registrationKey)!;
    }

    console.log('🆕 Creating new registration promise for:', registrationKey);

    // Create the registration promise
    const registrationPromise = this._performRegistration(email, walletAddress);
    
    // Store the promise to prevent concurrent registrations
    this.pendingRegistrations.set(registrationKey, registrationPromise);
    
    try {
      const result = await registrationPromise;
      console.log('✅ Registration completed successfully for:', registrationKey);
      return result;
    } catch (error) {
      console.error('❌ Registration failed for:', registrationKey, error);
      throw error;
    } finally {
      // Clean up the pending registration
      this.pendingRegistrations.delete(registrationKey);
      console.log('🧹 Cleaned up pending registration for:', registrationKey);
    }
  }

  /**
   * Internal method to perform the actual registration
   */
  private static async _performRegistration(email: string, walletAddress: string): Promise<EmailWalletInfo> {
    try {
      console.log('🚀 Starting registration for:', { email, walletAddress });

      // First, check if this exact email-wallet combination already exists (idempotent check)
      let existingUserInfo: EmailWalletInfo | null = null;
      
      try {
        console.log('🔍 Checking if user already exists...');
        existingUserInfo = await this.getUserByEmail(email);
        console.log('✅ User lookup successful:', existingUserInfo);
      } catch (error) {
        console.log('❌ Error during user lookup:', error);
        
        // Handle 406 errors gracefully - might mean RLS issues but registration could still work
        if (this.is406Error(error)) {
          console.warn('⚠️ Got 406 error checking existing user, continuing with registration attempt');
          existingUserInfo = null;
        } else {
          console.error('💥 Non-406 error during user lookup, rethrowing:', error);
          throw error;
        }
      }

      if (existingUserInfo) {
        console.log('📋 User already exists, checking wallet match...');
        if (existingUserInfo.walletAddress === walletAddress) {
          // Exact same mapping already exists - return it (idempotent behavior)
          console.log('✅ Email-wallet mapping already exists, returning existing record');
          return existingUserInfo;
        } else {
          // Email registered with different wallet - this is an error
          console.error('❌ Email registered with different wallet:', {
            email,
            existingWallet: existingUserInfo.walletAddress,
            newWallet: walletAddress
          });
          throw new EmailWalletError(
            `Email ${email} is already registered with a different wallet address`,
            'EMAIL_EXISTS'
          );
        }
      }

      console.log('🔍 User not found, checking if wallet is used by another email...');

      // Check if wallet is registered with a different email
      const { data: existingWallet, error: checkError } = await supabase
        .from('email_wallets')
        .select('email')
        .eq('wallet_address', walletAddress)
        .eq('is_active', true)
        .single();

      console.log('📊 Wallet check result:', { existingWallet, checkError });

      if (checkError && !this.is406Error(checkError) && checkError.code !== 'PGRST116') {
        console.error('❌ Database error checking existing wallet:', checkError);
        throw new EmailWalletError(
          'Failed to check existing wallet mappings',
          'DATABASE_ERROR',
          checkError
        );
      }

      if (existingWallet && existingWallet.email.toLowerCase() !== email.toLowerCase()) {
        console.error('❌ Wallet already registered with different email:', {
          walletAddress,
          existingEmail: existingWallet.email,
          newEmail: email
        });
        throw new EmailWalletError(
          'Wallet address is already registered with another email',
          'WALLET_EXISTS'
        );
      }

      console.log('✅ Wallet available, proceeding with registration...');

      // Attempt to insert new mapping
      console.log('💾 Inserting new email-wallet mapping...');
      const { data, error } = await supabase
        .from('email_wallets')
        .insert({
          email: email.toLowerCase().trim(),
          wallet_address: walletAddress,
          is_active: true
        })
        .select()
        .single();

      console.log('📊 Insert result:', { data, error });

      if (error) {
        console.error('❌ Database error during insert:', error);
        
        // Handle specific constraint violations
        if (error.code === '23505') { // unique_violation
          console.log('🔄 Unique constraint violation detected, handling...');
          if (error.message.includes('email')) {
            console.log('📧 Email constraint violation, checking for race condition...');
            // Double-check if this is the same wallet (race condition handling)
            const existingInfo = await this.getUserByEmail(email).catch(() => null);
            if (existingInfo && existingInfo.walletAddress === walletAddress) {
              console.log('✅ Race condition detected, returning existing record');
              return existingInfo; // Idempotent - return existing record
            }
            console.error('❌ Email registered with different wallet during race condition');
            throw new EmailWalletError('Email is already registered with a different wallet', 'EMAIL_EXISTS', error);
          }
          if (error.message.includes('wallet_address')) {
            console.error('❌ Wallet constraint violation');
            throw new EmailWalletError('Wallet address is already registered with another email', 'WALLET_EXISTS', error);
          }
        }
        
        // Handle 406 errors - might be RLS issue but could have succeeded
        if (this.is406Error(error)) {
          console.warn('⚠️ Got 406 error during insert, checking if registration actually succeeded');
          const checkResult = await this.getUserByEmail(email).catch(() => null);
          if (checkResult && checkResult.walletAddress === walletAddress) {
            console.log('✅ Registration succeeded despite 406 error');
            return checkResult;
          }
          console.error('❌ Registration failed with 406 and no record found');
        }
        
        console.error('💥 Unhandled database error during registration');
        throw new EmailWalletError(
          'Failed to register email wallet mapping',
          'DATABASE_ERROR',
          error
        );
      }

      console.log('✅ Registration successful!', data);
      return {
        email: data.email,
        walletAddress: data.wallet_address,
        verified: true,
        registeredAt: new Date(data.first_registered_at),
        lastUpdated: new Date(data.last_updated_at),
        isActive: data.is_active
      };
    } catch (error) {
      if (error instanceof EmailWalletError) {
        throw error;
      }
      
      console.error('Unexpected error in _performRegistration:', error);
      throw new EmailWalletError(
        'An unexpected error occurred while registering email wallet mapping',
        'DATABASE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Update existing email-to-wallet mapping
   */
  static async updateWalletMapping(email: string, newWalletAddress: string): Promise<EmailWalletInfo> {
    try {
      if (!email || !email.includes('@')) {
        throw new EmailWalletError('Invalid email format', 'INVALID_INPUT');
      }

      if (!newWalletAddress || newWalletAddress.length < 32) {
        throw new EmailWalletError('Invalid wallet address format', 'INVALID_INPUT');
      }

      const emailHash = this.generateEmailHash(email);

      // Check if new wallet address is already in use by another email
      const { data: existingWallet, error: checkError } = await supabase
        .from('email_wallets')
        .select('email')
        .eq('wallet_address', newWalletAddress)
        .eq('is_active', true)
        .neq('email_hash', emailHash)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Database error checking existing wallet:', checkError);
        throw new EmailWalletError(
          'Failed to check existing wallet mappings',
          'DATABASE_ERROR',
          checkError
        );
      }

      if (existingWallet) {
        throw new EmailWalletError(
          'Wallet address is already registered with another email',
          'WALLET_EXISTS'
        );
      }

      // Update the mapping
      const { data, error } = await supabase
        .from('email_wallets')
        .update({ 
          wallet_address: newWalletAddress,
          last_updated_at: new Date().toISOString()
        })
        .eq('email_hash', emailHash)
        .eq('is_active', true)
        .select()
        .single();

      if (error) {
        console.error('Database error in updateWalletMapping:', error);
        
        if (error.code === 'PGRST116') {
          throw new EmailWalletError('Email not found in system', 'NOT_FOUND', error);
        }
        
        throw new EmailWalletError(
          'Failed to update wallet mapping',
          'DATABASE_ERROR',
          error
        );
      }

      return {
        email: data.email,
        walletAddress: data.wallet_address,
        verified: true,
        registeredAt: new Date(data.first_registered_at),
        lastUpdated: new Date(data.last_updated_at),
        isActive: data.is_active
      };
    } catch (error) {
      if (error instanceof EmailWalletError) {
        throw error;
      }
      
      console.error('Unexpected error in updateWalletMapping:', error);
      throw new EmailWalletError(
        'An unexpected error occurred while updating wallet mapping',
        'DATABASE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if email is registered in the system
   */
  static async isEmailRegistered(email: string): Promise<boolean> {
    try {
      const walletAddress = await this.getWalletByEmail(email);
      return walletAddress !== null;
    } catch (error) {
      if (error instanceof EmailWalletError && error.code === 'INVALID_INPUT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Deactivate email-wallet mapping (soft delete)
   */
  static async deactivateMapping(email: string): Promise<boolean> {
    try {
      if (!email || !email.includes('@')) {
        throw new EmailWalletError('Invalid email format', 'INVALID_INPUT');
      }

      const emailHash = this.generateEmailHash(email);

      const { error } = await supabase
        .from('email_wallets')
        .update({ 
          is_active: false,
          last_updated_at: new Date().toISOString()
        })
        .eq('email_hash', emailHash)
        .eq('is_active', true);

      if (error) {
        console.error('Database error in deactivateMapping:', error);
        throw new EmailWalletError(
          'Failed to deactivate email wallet mapping',
          'DATABASE_ERROR',
          error
        );
      }

      return true;
    } catch (error) {
      if (error instanceof EmailWalletError) {
        throw error;
      }
      
      console.error('Unexpected error in deactivateMapping:', error);
      throw new EmailWalletError(
        'An unexpected error occurred while deactivating mapping',
        'DATABASE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

export default EmailWalletService;