import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
  );
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We don't need session persistence for this use case
    autoRefreshToken: false,
  },
  db: {
    schema: 'public'
  }
});

// Database types based on our schema
export interface EmailWallet {
  id: string;
  email: string;
  email_hash: string;
  wallet_address: string;
  first_registered_at: string;
  last_updated_at: string;
  is_active: boolean;
}

export interface TransferIntent {
  id: string;
  sender_wallet: string;
  recipient_email: string;
  recipient_email_hash: string;
  claimed_by_wallet?: string;
  token_mint: string;
  token_symbol: string;
  amount: number;
  message?: string;
  status: 'pending' | 'claimed' | 'cancelled' | 'expired';
  creation_tx_hash?: string;
  claim_tx_hash?: string;
  expires_at: string;
  created_at: string;
  claimed_at?: string;
  cancelled_at?: string;
}

export interface TransferNotification {
  id: string;
  transfer_intent_id: string;
  notification_type: 'created' | 'reminder' | 'expired';
  email: string;
  sent_at: string;
  status: 'sent' | 'failed';
  error_message?: string;
}

// Type for the email hash generation function
export type EmailHashFunction = (email: string) => string;

export default supabase;