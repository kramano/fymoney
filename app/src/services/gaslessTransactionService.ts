// Gasless transaction service for client-side fee payment
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { FeePayerWallet } from '@/utils/feePayerWallet';
import { ENV_CONFIG } from '@/config/environment';

export interface GaslessTransactionParams {
  senderAddress: string;
  recipientAddress: string;
  amount: number; // Amount in USDC base units (6 decimals)
}

export class GaslessTransactionService {
  private static connection = new Connection(ENV_CONFIG.solanaRpcUrl, 'confirmed');

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
}

export default GaslessTransactionService;