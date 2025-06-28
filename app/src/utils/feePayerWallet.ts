// Fee payer wallet utilities for gasless transactions
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

export class FeePayerWallet {
  private static instance: Keypair | null = null;

  /**
   * Get the fee payer keypair from environment variable
   */
  static getFeePayerKeypair(): Keypair {
    if (this.instance) {
      return this.instance;
    }

    const privateKeyString = import.meta.env.VITE_FEE_PAYER_PRIVATE_KEY;
    
    if (!privateKeyString) {
      throw new Error('Service temporarily unavailable. Please try again later.');
    }

    try {
      // Decode base58 private key
      const privateKeyBuffer = bs58.decode(privateKeyString);
      this.instance = Keypair.fromSecretKey(new Uint8Array(privateKeyBuffer));
      
      console.log('💰 Fee payer wallet loaded:', this.instance.publicKey.toString());
      return this.instance;
    } catch (error) {
      console.error('❌ Failed to load fee payer wallet:', error);
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
  }

  /**
   * Get the fee payer public key
   */
  static getFeePayerPublicKey(): PublicKey {
    const keypair = this.getFeePayerKeypair();
    return keypair.publicKey;
  }

  /**
   * Check if gasless transactions are enabled
   */
  static isGaslessEnabled(): boolean {
    const enabled = import.meta.env.VITE_FEE_PAYER_ENABLED;
    const hasKey = !!import.meta.env.VITE_FEE_PAYER_PRIVATE_KEY;
    
    return enabled === 'true' && hasKey;
  }

  /**
   * Clear the cached keypair (for testing)
   */
  static clearCache(): void {
    this.instance = null;
  }
}

export default FeePayerWallet;