// Gasless transaction service for client-side fee payment
import {
    createTransferCheckedInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionInstruction
} from '@solana/web3.js';
import {Program, AnchorProvider, BN} from '@coral-xyz/anchor';
import {FeePayerWallet} from '@/utils/feePayerWallet';
import {ENV_CONFIG} from '@/config/environment';
import {Fymoney} from '@/types/fymoney';
import {YieldVault} from "@/types/yield_vault.ts";
import * as crypto from 'crypto';
// Import the IDL
import FymoneyIDL from '@/idl/fymoney.json';
import YieldVaultIDL from '@/idl/yield_vault.json'

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

// Error mapping interface for consistent error handling
interface ErrorMapping {
    [key: string]: string;
}

export class TransactionService {
    private static connection = new Connection(ENV_CONFIG.solanaRpcUrl, 'confirmed');
    private static escrowProgramId = new PublicKey('9PbXHvSA4k86YpoJonchC9LHaFNuGv7XiEf8MdD4ZYNp');
    private static vaultProgramId = new PublicKey('4ccPktiGRVAS5vmuPj8W7CcR534mQn88KmtHaMTdeQVs')
    private static usdcMintAddress = new PublicKey(ENV_CONFIG.usdcMintAddress);

    // Common error mappings
    private static readonly COMMON_ERROR_MAPPINGS: ErrorMapping = {
        'insufficient': 'Insufficient funds. Please check your balance.',
        'Invalid': 'Invalid transaction details. Please check your input.',
        'invalid': 'Invalid transaction details. Please check your input.',
        'network': 'Network error. Please try again.',
        'connection': 'Network error. Please try again.',
    };

    private static readonly ESCROW_ERROR_MAPPINGS: ErrorMapping = {
        ...this.COMMON_ERROR_MAPPINGS,
        'Amount must be greater than 0': 'Amount must be greater than 0',
        'Valid recipient email is required': 'Valid recipient email is required',
    };

    private static readonly CLAIM_ERROR_MAPPINGS: ErrorMapping = {
        ...this.COMMON_ERROR_MAPPINGS,
        'Escrow account not found': 'Escrow not found. It may have already been claimed or expired.',
        'EscrowNotActive': 'This escrow is no longer active and cannot be claimed.',
        'EscrowExpired': 'This escrow has expired and can no longer be claimed.',
        'InvalidRecipient': 'You are not authorized to claim this escrow.',
    };

    private static readonly TRANSFER_ERROR_MAPPINGS: ErrorMapping = {
        ...this.COMMON_ERROR_MAPPINGS,
        'does not have a USDC account': 'Recipient does not have a USDC account. They need to create one first.',
    };

    private static readonly VAULT_ERROR_MAPPINGS: ErrorMapping = {
        ...this.COMMON_ERROR_MAPPINGS,
        'InvalidAmount': 'Amount must be greater than 0',
        'InsufficientFunds': 'Insufficient funds in your vault deposit',
        'Invalid amount: must be greater than 0': 'Amount must be greater than 0',
        'Not enough funds in user deposit': 'Insufficient funds in your vault deposit',
    };

    /**
     * Create a minimal read-only provider for instruction building
     */
    private static createReadOnlyProvider(): AnchorProvider {
        const feePayer = FeePayerWallet.getFeePayerKeypair();
        return new AnchorProvider(this.connection, {
            publicKey: feePayer.publicKey,
            signTransaction: async () => {
                throw new Error('Read-only operation');
            },
            signAllTransactions: async () => {
                throw new Error('Read-only operation');
            }
        }, {commitment: 'confirmed'});
    }

    /**
     * Create a program instance using the read-only provider
     */
    private static createEscrowProgram(): Program<Fymoney> {
        const provider = this.createReadOnlyProvider();
        return new Program<Fymoney>(FymoneyIDL as Fymoney, provider);
    }

    private static createYieldVaultProgram(): Program<YieldVault> {
        const provider = this.createReadOnlyProvider();
        return new Program<YieldVault>(YieldVaultIDL as YieldVault, provider);
    }

    /**
     * Create and setup a base transaction with fee payer
     */
    private static async createBaseTransaction(): Promise<{
        transaction: Transaction;
        blockhash: string;
        lastValidBlockHeight: number;
        feePayer: PublicKey;
    }> {
        const feePayer = FeePayerWallet.getFeePayerKeypair();

        console.log('🔗 Getting latest blockhash...');
        const {blockhash, lastValidBlockHeight} = await this.connection.getLatestBlockhash('confirmed');

        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = feePayer.publicKey;

        return {
            transaction,
            blockhash,
            lastValidBlockHeight,
            feePayer: feePayer.publicKey
        };
    }

    /**
     * Sign transaction with fee payer and return it
     */
    private static signTransactionWithFeePayer(transaction: Transaction): Transaction {
        const feePayer = FeePayerWallet.getFeePayerKeypair();
        console.log('✍️ Fee payer signing transaction...');
        transaction.partialSign(feePayer);
        return transaction;
    }

    /**
     * Handle errors with appropriate error mapping
     */
    private static handleError(error: unknown, errorMappings: ErrorMapping, fallbackMessage: string): never {
        console.error('❌ Operation failed:', error);

        if (error instanceof Error) {
            // Check for specific error patterns
            for (const [pattern, message] of Object.entries(errorMappings)) {
                if (error.message.includes(pattern)) {
                    throw new Error(message);
                }
            }
        }

        // Generic fallback message
        throw new Error(fallbackMessage);
    }

    /**
     * Get associated token address with error handling
     */
    private static async getTokenAccount(mint: PublicKey, owner: PublicKey, allowPda = false): Promise<PublicKey> {
        return getAssociatedTokenAddress(mint, owner, allowPda);
    }

    /**
     * Check if a token account exists
     */
    private static async tokenAccountExists(tokenAccount: PublicKey): Promise<boolean> {
        const accountInfo = await this.connection.getAccountInfo(tokenAccount);
        return !!accountInfo;
    }

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
        ], this.escrowProgramId);
    }

    /**
     * Find next available nonce for escrow creation
     */
    private static async findNextNonce(
        sender: PublicKey,
        emailHash: number[]
    ): Promise<number> {
        const program = this.createEscrowProgram();

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
     * Validate inputs for escrow creation
     */
    private static validateEscrowInputs(amount: number, recipientEmail: string): void {
        if (amount <= 0) {
            throw new Error('Amount must be greater than 0');
        }

        if (!recipientEmail || !recipientEmail.includes('@')) {
            throw new Error('Valid recipient email is required');
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
            this.validateEscrowInputs(amount, recipientEmail);

            console.log('💰 Using fee payer:', FeePayerWallet.getFeePayerKeypair().publicKey.toString());

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
            const senderTokenAccount = await this.getTokenAccount(this.usdcMintAddress, senderPubkey);
            const escrowTokenAccount = await this.getTokenAccount(this.usdcMintAddress, escrowPDA, true);

            const program = this.createEscrowProgram();
            const feePayer = FeePayerWallet.getFeePayerKeypair();

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

            // Create and setup transaction
            const {transaction} = await this.createBaseTransaction();
            transaction.add(anchorIx);

            // Sign with fee payer
            this.signTransactionWithFeePayer(transaction);

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
            this.handleError(error, this.ESCROW_ERROR_MAPPINGS, 'Escrow creation failed. Please try again.');
        }
    }

    /**
     * Create claim escrow transaction
     */
    static async claimEscrowTransaction(escrowPda: string, recipientWallet: string): Promise<TransactionResult> {
        console.log('🚀 Creating claim escrow transaction:', {escrowPda, recipientWallet});

        try {
            const escrowPDA = new PublicKey(escrowPda);
            const recipientPubkey = new PublicKey(recipientWallet);

            const program = this.createEscrowProgram();
            const feePayer = FeePayerWallet.getFeePayerKeypair();

            // Get escrow account to fetch token account
            const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
            if (!escrowAccount) {
                throw new Error('Escrow account not found');
            }

            // Get recipient token account
            const recipientTokenAccount = await this.getTokenAccount(this.usdcMintAddress, recipientPubkey);

            // Check if recipient token account exists
            const recipientTokenExists = await this.tokenAccountExists(recipientTokenAccount);
            console.log('📋 Recipient token account exists:', recipientTokenExists);

            const escrowTokenAccount = escrowAccount.escrowTokenAccount;
            const instructions: TransactionInstruction[] = [];

            // Create recipient token account if it doesn't exist
            if (!recipientTokenExists) {
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

            instructions.push(claimIx);

            // Create and setup transaction
            const {transaction, blockhash, lastValidBlockHeight} = await this.createBaseTransaction();

            // Add all instructions to transaction
            instructions.forEach(instruction => transaction.add(instruction));

            // Sign with fee payer
            this.signTransactionWithFeePayer(transaction);

            console.log('✅ Claim escrow transaction created successfully');
            console.log('📋 Claim details:', {
                escrowPDA: escrowPDA.toString(),
                recipient: recipientPubkey.toString(),
                recipientTokenAccount: recipientTokenAccount.toString(),
                feePayer: feePayer.publicKey.toString(),
                instructionCount: instructions.length,
                tokenAccountCreated: !recipientTokenExists,
                requiresUserSignature: true,
                feePayerSigned: true
            });

            return {
                transaction,
                blockhash,
                lastValidBlockHeight
            };
        } catch (error) {
            this.handleError(error, this.CLAIM_ERROR_MAPPINGS, 'Claim failed. Please try again.');
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

        const {senderAddress, recipientAddress, amount} = params;

        try {
            console.log('💰 Using fee payer:', FeePayerWallet.getFeePayerKeypair().publicKey.toString());

            // Convert addresses to PublicKey objects
            const sender = new PublicKey(senderAddress);
            const recipient = new PublicKey(recipientAddress);

            console.log('🔍 Getting token accounts...');

            // Get token accounts for sender and recipient
            const senderTokenAccount = await this.getTokenAccount(this.usdcMintAddress, sender);
            const recipientTokenAccount = await this.getTokenAccount(this.usdcMintAddress, recipient);

            console.log('📊 Token accounts:', {
                sender: senderTokenAccount.toString(),
                recipient: recipientTokenAccount.toString()
            });

            // Check if recipient token account exists
            const recipientTokenExists = await this.tokenAccountExists(recipientTokenAccount);
            console.log('📋 Recipient token account exists:', recipientTokenExists);

            // Fail if recipient doesn't have a USDC account (consistent with non-gasless flow)
            if (!recipientTokenExists) {
                throw new Error('Recipient does not have a USDC account. They need to create one first.');
            }

            // Add transfer instruction
            console.log('💸 Adding transfer instruction for amount:', amount);
            const transferInstruction = createTransferCheckedInstruction(
                senderTokenAccount,
                this.usdcMintAddress,
                recipientTokenAccount,
                sender, // Sender must sign for the transfer
                BigInt(amount),
                6 // USDC decimals
            );

            // Create and setup transaction
            const {transaction} = await this.createBaseTransaction();
            transaction.add(transferInstruction);

            // Sign with fee payer
            this.signTransactionWithFeePayer(transaction);

            console.log('✅ Gasless transaction created successfully');
            console.log('📋 Transaction details:', {
                feePayer: FeePayerWallet.getFeePayerKeypair().publicKey.toString(),
                instructionCount: 1,
                requiresUserSignature: true
            });

            return transaction;
        } catch (error) {
            this.handleError(error, this.TRANSFER_ERROR_MAPPINGS, 'Transaction failed. Please try again.');
        }
    }

    /**
     * Create deposit transaction for vault
     */
    static async createDepositTransaction(userWallet: PublicKey, amount: number): Promise<TransactionResult> {
        console.log('🚀 Creating vault deposit transaction:', { userWallet: userWallet.toString(), amount });

        if (!FeePayerWallet.isGaslessEnabled()) {
            throw new Error('Service temporarily unavailable. Please try again later.');
        }

        try {
            const feePayer = FeePayerWallet.getFeePayerKeypair();

            // Derive vault PDA
            const [vaultPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('vault')],
                this.vaultProgramId
            );

            // Derive user deposit PDA
            const [userDepositPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('user_deposit'), userWallet.toBuffer()],
                this.vaultProgramId
            );

            // Get token accounts
            const vaultTokenAccount = await this.getTokenAccount(this.usdcMintAddress, vaultPDA, true);
            const userTokenAccount = await this.getTokenAccount(this.usdcMintAddress, userWallet);

            // Check if user has USDC token account
            const userTokenExists = await this.tokenAccountExists(userTokenAccount);
            if (!userTokenExists) {
                throw new Error('You need a USDC token account to deposit. Please create one first.');
            }

            console.log('📋 Vault deposit details:', {
                vaultPDA: vaultPDA.toString(),
                userDepositPDA: userDepositPDA.toString(),
                vaultTokenAccount: vaultTokenAccount.toString(),
                userTokenAccount: userTokenAccount.toString(),
                amount: amount,
                amountLamports: new BN(amount).toString()
            });

            // Create instruction using snake_case names from IDL
            const depositIx = await this.createYieldVaultProgram().methods
                .deposit(new BN(amount))
                .accounts({
                    vaultAccount: vaultPDA,
                    userDepositAccount: userDepositPDA,
                    vaultTokenAccount,
                    userTokenAccount,
                    tokenMint: this.usdcMintAddress,
                    user: userWallet,
                    feePayer: feePayer.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .instruction();

            // Create and setup transaction
            const { transaction, blockhash, lastValidBlockHeight } = await this.createBaseTransaction();
            transaction.add(depositIx);

            // Sign with fee payer
            this.signTransactionWithFeePayer(transaction);

            console.log('✅ Vault deposit transaction created successfully');
            console.log('📋 Deposit transaction details:', {
                vaultPDA: vaultPDA.toString(),
                userDepositPDA: userDepositPDA.toString(),
                feePayer: feePayer.publicKey.toString(),
                requiresUserSignature: true,
                feePayerSigned: true
            });

            return {
                transaction,
                blockhash,
                lastValidBlockHeight
            };
        } catch (error) {
            this.handleError(error, this.VAULT_ERROR_MAPPINGS, 'Vault deposit failed. Please try again.');
        }
    }

    /**
     * Create withdraw transaction for vault
     */
    static async createWithdrawTransaction(userWallet: PublicKey, amount: number): Promise<TransactionResult> {
        console.log('🚀 Creating vault withdraw transaction:', { userWallet: userWallet.toString(), amount });

        if (!FeePayerWallet.isGaslessEnabled()) {
            throw new Error('Service temporarily unavailable. Please try again later.');
        }

        try {
            // Derive vault PDA
            const [vaultPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('vault')],
                this.vaultProgramId
            );

            // Derive user deposit PDA
            const [userDepositPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('user_deposit'), userWallet.toBuffer()],
                this.vaultProgramId
            );

            // Get token accounts
            const vaultTokenAccount = await this.getTokenAccount(this.usdcMintAddress, vaultPDA, true);
            const userTokenAccount = await this.getTokenAccount(this.usdcMintAddress, userWallet);

            // Check if user has USDC token account, create if needed
            const userTokenExists = await this.tokenAccountExists(userTokenAccount);
            const instructions: TransactionInstruction[] = [];

            if (!userTokenExists) {
                console.log('🔧 Creating user token account for withdrawal...');
                const feePayer = FeePayerWallet.getFeePayerKeypair();
                const createTokenAccountIx = createAssociatedTokenAccountInstruction(
                    feePayer.publicKey,
                    userTokenAccount,
                    userWallet,
                    this.usdcMintAddress,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                );
                instructions.push(createTokenAccountIx);
            }

            console.log('📋 Vault withdraw details:', {
                vaultPDA: vaultPDA.toString(),
                userDepositPDA: userDepositPDA.toString(),
                vaultTokenAccount: vaultTokenAccount.toString(),
                userTokenAccount: userTokenAccount.toString(),
                amount: amount,
                amountLamports: new BN(amount).toString(),
                willCreateTokenAccount: !userTokenExists
            });

            // Create withdraw instruction
            const withdrawIx = await this.createYieldVaultProgram().methods
                .withdraw(new BN(amount))
                .accounts({
                    vaultAccount: vaultPDA,
                    userDepositAccount: userDepositPDA,
                    vaultTokenAccount,
                    userTokenAccount,
                    tokenMint: this.usdcMintAddress,
                    user: userWallet,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction();

            instructions.push(withdrawIx);

            // Create and setup transaction
            const { transaction, blockhash, lastValidBlockHeight } = await this.createBaseTransaction();
            
            // Add all instructions
            instructions.forEach(instruction => transaction.add(instruction));

            // Sign with fee payer
            this.signTransactionWithFeePayer(transaction);

            console.log('✅ Vault withdraw transaction created successfully');
            console.log('📋 Withdraw transaction details:', {
                vaultPDA: vaultPDA.toString(),
                userDepositPDA: userDepositPDA.toString(),
                instructionCount: instructions.length,
                tokenAccountCreated: !userTokenExists,
                requiresUserSignature: true,
                feePayerSigned: true
            });

            return {
                transaction,
                blockhash,
                lastValidBlockHeight
            };
        } catch (error) {
            this.handleError(error, this.VAULT_ERROR_MAPPINGS, 'Vault withdraw failed. Please try again.');
        }
    }

    /**
     * Get user's vault deposit balance
     */
    static async getUserVaultBalance(userWallet: PublicKey): Promise<number> {
        try {
            // Derive user deposit PDA
            const [userDepositPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('user_deposit'), userWallet.toBuffer()],
                this.vaultProgramId
            );

            const program = this.createYieldVaultProgram();
            const userDeposit = await program.account.userDeposit.fetchNullable(userDepositPDA);
            
            if (!userDeposit) {
                return 0;
            }

            return userDeposit.amount.toNumber();
        } catch (error) {
            console.error('❌ Failed to get user vault balance:', error);
            return 0;
        }
    }

    /**
     * Get vault total deposits (for UI display)
     */
    static async getVaultTotalDeposits(): Promise<number> {
        try {
            // Derive vault PDA
            const [vaultPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('vault')],
                this.vaultProgramId
            );

            // Get vault token account balance
            const vaultTokenAccount = await this.getTokenAccount(this.usdcMintAddress, vaultPDA, true);
            
            // Check if vault token account exists first
            const accountExists = await this.tokenAccountExists(vaultTokenAccount);
            if (!accountExists) {
                // Vault token account doesn't exist yet (no deposits made)
                return 0;
            }
            
            const balance = await this.connection.getTokenAccountBalance(vaultTokenAccount);
            return parseInt(balance.value.amount);
        } catch (error) {
            console.error('❌ Failed to get vault total deposits:', error);
            return 0;
        }
    }

    /**
     * Check if user has an active vault deposit
     */
    static async hasVaultDeposit(userWallet: PublicKey): Promise<boolean> {
        try {
            const balance = await this.getUserVaultBalance(userWallet);
            return balance > 0;
        } catch (error) {
            console.error('❌ Failed to check vault deposit:', error);
            return false;
        }
    }

    /**
     * Get vault account PDAs for external use
     */
    static getVaultPDAs(userWallet: PublicKey): {
        vaultPDA: PublicKey;
        userDepositPDA: PublicKey;
    } {
        const [vaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault')],
            this.vaultProgramId
        );

        const [userDepositPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('user_deposit'), userWallet.toBuffer()],
            this.vaultProgramId
        );

        return { vaultPDA, userDepositPDA };
    }

    /**
     * Get the Solana connection instance
     */
    static getConnection(): Connection {
        return this.connection;
    }
}

export default TransactionService;