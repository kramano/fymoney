import { Connection, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from '@solana/spl-token';
import { Program, AnchorProvider, BN, IdlAccounts } from '@coral-xyz/anchor';
import { Fymoney } from '../types/fymoney';
import * as crypto from 'crypto';

// Import the IDL
import FymoneyIDL from '../idl/fymoney.json';
import FeePayerWallet from "@/utils/feePayerWallet.ts";

export type EscrowAccount = IdlAccounts<Fymoney>['escrowAccount'];

export interface CreateEscrowParams {
  senderAddress: string;
  recipientEmail: string;
  amount: number; // Amount in base units (1 USDC = 1,000,000 base units)
  expirationDays?: number; // Default 7 days
}

export interface EscrowInfo {
  escrowPDA: PublicKey;
  escrowTokenAccount: PublicKey;
  nonce: number;
  bump: number;
  emailHash: number[];
  expiresAt: Date;
}

class EscrowService {
  private program: Program<Fymoney> | null = null;
  private connection: Connection;
  private programId: PublicKey;
  private usdcMintAddress: PublicKey;

  constructor() {
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.programId = new PublicKey('9PbXHvSA4k86YpoJonchC9LHaFNuGv7XiEf8MdD4ZYNp');
    this.usdcMintAddress = new PublicKey(
      import.meta.env.VITE_USDC_MINT_ADDRESS || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'
    );
  }

  /**
   * Initialize the Anchor program with a wallet/provider
   */
  initializeProgram(wallet: any) {
    // Create a minimal provider for read-only operations
    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed',
    });

    this.program = new Program(FymoneyIDL as Fymoney, provider);
  }

  /**
   * Hash email to 32-byte array for escrow identification
   */
  hashEmail(email: string): number[] {
    const emailHash = crypto.createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest();
    return Array.from(emailHash);
  }

  /**
   * Generate PDA for escrow account
   */
  getEscrowPDA(
    sender: PublicKey,
    emailHash: number[],
    nonce: number
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([
      Buffer.from('escrow'),
      sender.toBuffer(),
      Buffer.from(emailHash),
      new BN(nonce).toBuffer('le', 8)
    ], this.programId);
  }

  /**
   * Find next available nonce for escrow creation
   */
  async findNextNonce(
    sender: PublicKey,
    emailHash: number[]
  ): Promise<number> {
    if (!this.program) {
      throw new Error('Program not initialized. Call initializeProgram() first.');
    }

    let nonce = 0;
    while (true) {
      const [escrowPDA] = this.getEscrowPDA(sender, emailHash, nonce);
      
      try {
        const existing = await this.program.account.escrowAccount.fetchNullable(escrowPDA);
        if (!existing) {
          return nonce;
        }
        nonce++;
      } catch (error) {
        // Account doesn't exist, nonce is available
        return nonce;
      }
    }
  }

  /**
   * Prepare escrow creation transaction
   */
  async prepareCreateEscrowTransaction(params: CreateEscrowParams): Promise<{
    transaction: Transaction;
    escrowInfo: EscrowInfo;
  }> {
    if (!this.program) {
      throw new Error('Program not initialized. Call initializeProgram() first.');
    }

    const {
      senderAddress,
      recipientEmail,
      amount,
      expirationDays = 7
    } = params;

    // Validate inputs
    console.log("Amount to send:", amount);
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (!recipientEmail || !recipientEmail.includes('@')) {
      throw new Error('Valid recipient email is required');
    }

    const senderPubkey = new PublicKey(senderAddress);
    const emailHash = this.hashEmail(recipientEmail);
    
    // Find next available nonce
    const nonce = await this.findNextNonce(senderPubkey, emailHash);
    
    // Generate PDA
    const [escrowPDA, bump] = this.getEscrowPDA(senderPubkey, emailHash, nonce);

    // Calculate expiration timestamp
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
    const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);

    // Get token accounts
    const senderTokenAccount = await getAssociatedTokenAddress(
      this.usdcMintAddress,
      senderPubkey
    );

    const escrowTokenAccount = await getAssociatedTokenAddress(
      this.usdcMintAddress,
      escrowPDA,
      true
    );

    const feePayer = FeePayerWallet.getFeePayerKeypair();


    const anchorIx = await (this.program.methods as any)
        .initializeEscrow(
            new BN(amount),
            emailHash,
            new BN(expiresAtUnix),
            new BN(nonce)
        )
        .accounts({
          escrowAccount: escrowPDA,
          escrowTokenAccount: escrowTokenAccount,
          senderTokenAccount: senderTokenAccount,
          tokenMint: this.usdcMintAddress,
          sender: senderPubkey,
          feePayer: feePayer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .instruction(); // Get instruction, not transaction yet

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = feePayer.publicKey; // Fee payer pays the gas

    // Add the main escrow instruction
    transaction.add(anchorIx);

    transaction.partialSign(feePayer);

    const escrowInfo: EscrowInfo = {
      escrowPDA,
      escrowTokenAccount,
      nonce,
      bump,
      emailHash,
      expiresAt
    };
    return { transaction, escrowInfo };
  }

  /**
   * Get escrow account information
   */
  async getEscrowAccount(escrowPDA: PublicKey): Promise<EscrowAccount | null> {
    if (!this.program) {
      throw new Error('Program not initialized. Call initializeProgram() first.');
    }

    try {
      return await this.program.account.escrowAccount.fetch(escrowPDA);
    } catch (error) {
      console.log('Escrow account not found:', error);
      return null;
    }
  }

  /**
   * List all escrows for a sender
   */
  async getEscrowsForSender(senderAddress: string): Promise<{
    account: EscrowAccount;
    publicKey: PublicKey;
  }[]> {
    if (!this.program) {
      throw new Error('Program not initialized. Call initializeProgram() first.');
    }

    try {
      const accounts = await this.program.account.escrowAccount.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: senderAddress
          }
        }
      ]);

      return accounts;
    } catch (error) {
      console.error('Error fetching escrows for sender:', error);
      return [];
    }
  }

  /**
   * Find escrow by recipient email hash
   */
  async findEscrowByEmail(
    senderAddress: string,
    recipientEmail: string
  ): Promise<{
    account: EscrowAccount;
    publicKey: PublicKey;
  }[]> {
    const emailHash = this.hashEmail(recipientEmail);
    const senderEscrows = await this.getEscrowsForSender(senderAddress);
    
    return senderEscrows.filter(escrow => 
      Buffer.from(escrow.account.recipientEmailHash).equals(Buffer.from(emailHash))
    );
  }

  /**
   * Prepare claim escrow transaction
   */
  async prepareClaimEscrowTransaction(
    escrowPDA: PublicKey,
    recipientAddress: string
  ): Promise<Transaction> {
    if (!this.program) {
      throw new Error('Program not initialized. Call initializeProgram() first.');
    }

    const recipientPubkey = new PublicKey(recipientAddress);
    
    // Get escrow account to fetch token account
    const escrowAccount = await this.getEscrowAccount(escrowPDA);
    if (!escrowAccount) {
      throw new Error('Escrow account not found');
    }

    // Get recipient token account
    const recipientTokenAccount = await getAssociatedTokenAddress(
      this.usdcMintAddress,
      recipientPubkey
    );

    const escrowTokenAccount = escrowAccount.escrowTokenAccount;

    // Build transaction (bypass strict typing)
    const transaction = await (this.program.methods as any)
      .claimEscrow()
      .accounts({
        escrowAccount: escrowPDA,
        escrowTokenAccount: escrowTokenAccount,
        recipientTokenAccount: recipientTokenAccount,
        tokenMint: this.usdcMintAddress,
        recipient: recipientPubkey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .transaction();

    return transaction;
  }

  /**
   * Prepare reclaim expired escrow transaction
   */
  async prepareReclaimExpiredEscrowTransaction(
    escrowPDA: PublicKey,
    senderAddress: string
  ): Promise<Transaction> {
    if (!this.program) {
      throw new Error('Program not initialized. Call initializeProgram() first.');
    }

    const senderPubkey = new PublicKey(senderAddress);
    
    // Get escrow account to fetch token account
    const escrowAccount = await this.getEscrowAccount(escrowPDA);
    if (!escrowAccount) {
      throw new Error('Escrow account not found');
    }

    // Get sender token account
    const senderTokenAccount = await getAssociatedTokenAddress(
      this.usdcMintAddress,
      senderPubkey
    );

    const escrowTokenAccount = escrowAccount.escrowTokenAccount;

    // Build transaction (bypass strict typing)
    const transaction = await (this.program.methods as any)
      .reclaimExpiredEscrow()
      .accounts({
        escrowAccount: escrowPDA,
        escrowTokenAccount: escrowTokenAccount,
        senderTokenAccount: senderTokenAccount,
        tokenMint: this.usdcMintAddress,
        sender: senderPubkey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    return transaction;
  }

  /**
   * Check if escrow has expired
   */
  isEscrowExpired(escrowAccount: EscrowAccount): boolean {
    const now = Math.floor(Date.now() / 1000);
    return escrowAccount.expiresAt.toNumber() < now;
  }

  /**
   * Get escrow status string
   */
  getEscrowStatusString(escrowAccount: EscrowAccount): string {
    if (escrowAccount.status.active) {
      return this.isEscrowExpired(escrowAccount) ? 'expired' : 'active';
    }
    if (escrowAccount.status.claimed) return 'claimed';
    if (escrowAccount.status.expired) return 'expired';
    return 'unknown';
  }

  /**
   * Format amount from base units to USDC
   */
  formatAmount(amount: BN | number): string {
    const amountNum = typeof amount === 'number' ? amount : amount.toNumber();
    return (amountNum / 1_000_000).toFixed(6);
  }

  /**
   * Convert USDC to base units
   */
  parseAmount(usdcAmount: string): number {
    return Math.round(parseFloat(usdcAmount) * 1_000_000);
  }
}

// Export singleton instance
export const escrowService = new EscrowService();
export default EscrowService;