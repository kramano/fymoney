// Gasless transaction service for client-side fee payment
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Connection, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { FeePayerWallet } from '@/utils/feePayerWallet';
import { ENV_CONFIG } from '@/config/environment';
import { Fymoney } from '@/types/fymoney';
import * as crypto from 'crypto';

// Import the IDL
import FymoneyIDL from '@/idl/fymoney.json';

export interface GaslessTransactionParams {
  senderAddress: string;
  recipientAddress: string;
  amount: number; // Amount in USDC base units (6 decimals)
}

export interface CreateEscrowParams {
  senderAddress: string;
  recipientEmail: string;
  amount: number; // Amount in USDC base units (6 decimals)
  expirationDays?: number; // Default 30 days
}

export interface EscrowResult {
  escrowPda: string;
  transaction: Transaction;
  escrowTokenAccount: string;
  nonce: number;
  emailHash: number[];
  expiresAt: Date;
}

export interface TransactionResult {
  transaction: Transaction;
  blockhash: string;
  lastValidBlockHeight: number;
}

export class GaslessTransactionService {
  private static connection = new Connection(ENV_CONFIG.solanaRpcUrl, 'confirmed');
  private static programId = new PublicKey('9PbXHvSA4k86YpoJonchC9LHaFNuGv7XiEf8MdD4ZYNp');
  private static usdcMintAddress = new PublicKey(ENV_CONFIG.usdcMintAddress);

  /**
   * Hash email to 32-byte array for escrow identification
   */
  private static hashEmail(email: string): number[] {
    const emailHash = crypto.createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest();
    return Array.from(emailHash);
  }

  /**
   * Generate PDA for escrow account
   */
  private static getEscrowPDA(
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
  private static async findNextNonce(
    sender: PublicKey,
    emailHash: number[]
  ): Promise<number> {
    // Create a minimal provider for read-only operations
    const feePayer = FeePayerWallet.getFeePayerKeypair();
    const provider = new AnchorProvider(this.connection, { 
      publicKey: feePayer.publicKey,
      signTransaction: async () => { throw new Error('Read-only operation'); },
      signAllTransactions: async () => { throw new Error('Read-only operation'); }
    }, { commitment: 'confirmed' });

    const program = new Program<Fymoney>(FymoneyIDL as Fymoney, provider);

    let nonce = 0;
    while (true) {
      const [escrowPDA] = this.getEscrowPDA(sender, emailHash, nonce);
      
      try {
        const existing = await program.account.escrowAccount.fetchNullable(escrowPDA);
        if (!existing) {
          return nonce;
        }
        nonce++;
      } catch {
        // Account doesn't exist, nonce is available
        return nonce;
      }
    }
  }

  /**
   * Create escrow transaction with fee payer pre-signed
   */
  static async createEscrowTransaction(params: CreateEscrowParams): Promise<EscrowResult> {
    console.log('🚀 Creating escrow transaction:', params);

    if (!FeePayerWallet.isGaslessEnabled()) {
      throw new Error('Service temporarily unavailable. Please try again later.');
    }

    const {
      senderAddress,
      recipientEmail,
      amount,
      expirationDays = 30
    } = params;

    try {
      // Validate inputs
      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (!recipientEmail || !recipientEmail.includes('@')) {
        throw new Error('Valid recipient email is required');
      }

      // Get fee payer keypair
      const feePayer = FeePayerWallet.getFeePayerKeypair();
      console.log('💰 Using fee payer:', feePayer.publicKey.toString());

      const senderPubkey = new PublicKey(senderAddress);
      const emailHash = this.hashEmail(recipientEmail);
      
      // Find next available nonce
      const nonce = await this.findNextNonce(senderPubkey, emailHash);
      
      // Generate PDA
      const [escrowPDA] = this.getEscrowPDA(senderPubkey, emailHash, nonce);

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

      // Create a minimal provider for instruction building
      const provider = new AnchorProvider(this.connection, { 
        publicKey: feePayer.publicKey,
        signTransaction: async () => { throw new Error('Not used for instruction building'); },
        signAllTransactions: async () => { throw new Error('Not used for instruction building'); }
      }, { commitment: 'confirmed' });

      const program = new Program<Fymoney>(FymoneyIDL as Fymoney, provider);

      // Build escrow instruction
      const anchorIx = await (program.methods as any)
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
        .instruction();

      // Get latest blockhash
      console.log('🔗 Getting latest blockhash...');
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      // Create transaction
      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = feePayer.publicKey;

      // Add the escrow instruction
      transaction.add(anchorIx);

      // Partially sign with fee payer
      console.log('✍️ Fee payer signing transaction...');
      transaction.partialSign(feePayer);

      console.log('✅ Escrow transaction created successfully');
      console.log('📋 Escrow details:', {
        escrowPDA: escrowPDA.toString(),
        nonce,
        expiresAt,
        requiresUserSignature: true
      });

      return {
        escrowPda: escrowPDA.toString(),
        transaction,
        escrowTokenAccount: escrowTokenAccount.toString(),
        nonce,
        emailHash,
        expiresAt
      };
    } catch (error) {
      console.error('❌ Failed to create escrow transaction:', error);
      
      // Convert technical errors to user-friendly messages
      if (error instanceof Error) {
        if (error.message.includes('Amount must be greater than 0')) {
          throw new Error('Amount must be greater than 0');
        }
        if (error.message.includes('Valid recipient email is required')) {
          throw new Error('Valid recipient email is required');
        }
        if (error.message.includes('insufficient')) {
          throw new Error('Insufficient funds. Please check your balance.');
        }
        if (error.message.includes('Invalid') || error.message.includes('invalid')) {
          throw new Error('Invalid transaction details. Please check your input.');
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new Error('Network error. Please try again.');
        }
      }
      
      // Generic fallback message
      throw new Error('Escrow creation failed. Please try again.');
    }
  }

  /**
   * Create claim escrow transaction
   */
  static async claimEscrowTransaction(escrowPda: string, recipientWallet: string): Promise<TransactionResult> {
    console.log('🚀 Creating claim escrow transaction:', { escrowPda, recipientWallet });

    try {
      const escrowPDA = new PublicKey(escrowPda);
      const recipientPubkey = new PublicKey(recipientWallet);

      // Create a minimal provider for instruction building
      const feePayer = FeePayerWallet.getFeePayerKeypair();
      const provider = new AnchorProvider(this.connection, { 
        publicKey: feePayer.publicKey,
        signTransaction: async () => { throw new Error('Not used for instruction building'); },
        signAllTransactions: async () => { throw new Error('Not used for instruction building'); }
      }, { commitment: 'confirmed' });

      const program = new Program<Fymoney>(FymoneyIDL as Fymoney, provider);

      // Get escrow account to fetch token account
      const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
      if (!escrowAccount) {
        throw new Error('Escrow account not found');
      }

      // Get recipient token account
      const recipientTokenAccount = await getAssociatedTokenAddress(
        this.usdcMintAddress,
        recipientPubkey
      );

      // Check if recipient token account exists
      const recipientTokenInfo = await this.connection.getAccountInfo(recipientTokenAccount);
      console.log('📋 Recipient token account exists:', !!recipientTokenInfo);

      const escrowTokenAccount = escrowAccount.escrowTokenAccount;

      // Prepare instructions array
      const instructions = [];

      // Create recipient token account if it doesn't exist
      if (!recipientTokenInfo) {
        console.log('🔧 Creating recipient token account...');
        const createTokenAccountIx = createAssociatedTokenAccountInstruction(
          feePayer.publicKey, // Fee payer pays for account creation
          recipientTokenAccount,
          recipientPubkey,
          this.usdcMintAddress,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        instructions.push(createTokenAccountIx);
      }

      // Build claim instruction
      const claimIx = await (program.methods as any)
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
        .instruction();

      // Add claim instruction to the instructions array
      instructions.push(claimIx);

      // Get latest blockhash
      console.log('🔗 Getting latest blockhash...');
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      // Create transaction
      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = feePayer.publicKey;

      // Add all instructions to transaction
      instructions.forEach(instruction => transaction.add(instruction));

      // Pre-sign the transaction with the fee payer
      console.log('🔐 Pre-signing transaction with fee payer...');
      transaction.partialSign(feePayer);

      console.log('✅ Claim escrow transaction created successfully');
      console.log('📋 Claim details:', {
        escrowPDA: escrowPDA.toString(),
        recipient: recipientPubkey.toString(),
        recipientTokenAccount: recipientTokenAccount.toString(),
        feePayer: feePayer.publicKey.toString(),
        instructionCount: instructions.length,
        tokenAccountCreated: !recipientTokenInfo,
        requiresUserSignature: true,
        feePayerSigned: true
      });

      return {
        transaction,
        blockhash,
        lastValidBlockHeight
      };
    } catch (error) {
      console.error('❌ Failed to create claim escrow transaction:', error);
      
      // Convert technical errors to user-friendly messages
      if (error instanceof Error) {
        if (error.message.includes('Escrow account not found')) {
          throw new Error('Escrow not found. It may have already been claimed or expired.');
        }
        if (error.message.includes('EscrowNotActive')) {
          throw new Error('This escrow is no longer active and cannot be claimed.');
        }
        if (error.message.includes('EscrowExpired')) {
          throw new Error('This escrow has expired and can no longer be claimed.');
        }
        if (error.message.includes('InvalidRecipient')) {
          throw new Error('You are not authorized to claim this escrow.');
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new Error('Network error. Please try again.');
        }
      }
      
      // Generic fallback message
      throw new Error('Claim failed. Please try again.');
    }
  }

  /**
   * Create a gasless transaction with fee payer pre-signed
   */
  static async createGaslessTransaction(params: GaslessTransactionParams): Promise<Transaction> {
    console.log('🚀 Creating gasless transaction:', params);

    if (!FeePayerWallet.isGaslessEnabled()) {
      throw new Error('Service temporarily unavailable. Please try again later.');
    }

    const { senderAddress, recipientAddress, amount } = params;

    try {
      // Get fee payer keypair
      const feePayer = FeePayerWallet.getFeePayerKeypair();
      console.log('💰 Using fee payer:', feePayer.publicKey.toString());

      // Convert addresses to PublicKey objects
      const sender = new PublicKey(senderAddress);
      const recipient = new PublicKey(recipientAddress);
      const usdcMint = new PublicKey(ENV_CONFIG.usdcMintAddress);

      console.log('🔍 Getting token accounts...');

      // Get token accounts for sender and recipient
      const senderTokenAccount = await getAssociatedTokenAddress(usdcMint, sender);
      const recipientTokenAccount = await getAssociatedTokenAddress(usdcMint, recipient);

      console.log('📊 Token accounts:', {
        sender: senderTokenAccount.toString(),
        recipient: recipientTokenAccount.toString()
      });

      // Check if recipient token account exists
      const recipientTokenInfo = await this.connection.getAccountInfo(recipientTokenAccount);
      console.log('📋 Recipient token account exists:', !!recipientTokenInfo);

      // Fail if recipient doesn't have a USDC account (consistent with non-gasless flow)
      if (!recipientTokenInfo) {
        throw new Error('Recipient does not have a USDC account. They need to create one first.');
      }

      const instructions = [];

      // Add transfer instruction
      console.log('💸 Adding transfer instruction for amount:', amount);
      instructions.push(
        createTransferCheckedInstruction(
          senderTokenAccount,
          usdcMint,
          recipientTokenAccount,
          sender, // Sender must sign for the transfer
          BigInt(amount),
          6 // USDC decimals
        )
      );

      // Get latest blockhash
      console.log('🔗 Getting latest blockhash...');
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      // Create transaction
      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = feePayer.publicKey; // Fee payer pays the gas
      
      // Add all instructions
      instructions.forEach((instruction) => transaction.add(instruction));

      // Partially sign with fee payer
      console.log('✍️ Fee payer signing transaction...');
      transaction.partialSign(feePayer);

      console.log('✅ Gasless transaction created successfully');
      console.log('📋 Transaction details:', {
        feePayer: feePayer.publicKey.toString(),
        instructionCount: instructions.length,
        requiresUserSignature: true
      });

      return transaction;
    } catch (error) {
      console.error('❌ Failed to create gasless transaction:', error);
      
      // Convert technical errors to user-friendly messages
      if (error instanceof Error) {
        if (error.message.includes('does not have a USDC account')) {
          throw new Error('Recipient does not have a USDC account. They need to create one first.');
        }
        if (error.message.includes('insufficient')) {
          throw new Error('Transaction failed. Please try again.');
        }
        if (error.message.includes('Invalid') || error.message.includes('invalid')) {
          throw new Error('Invalid transaction details. Please check your input.');
        }
        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new Error('Network error. Please try again.');
        }
      }
      
      // Generic fallback message
      throw new Error('Transaction failed. Please try again.');
    }
  }

  /**
   * Get the Solana connection instance
   */
  static getConnection(): Connection {
    return this.connection;
  }
}

export default GaslessTransactionService;