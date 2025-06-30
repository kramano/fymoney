import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createMint,
    createAssociatedTokenAccount,
    mintTo,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { YieldVault } from "../target/types/yield_vault";

describe("vault", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.YieldVault as Program<YieldVault>;

    let mint: PublicKey;
    let user: Keypair;
    let userTokenAccount: PublicKey;
    let vaultAccount: PublicKey;
    let vaultTokenAccount: PublicKey;
    const depositAmount = new BN(1_000_000); // 1 USDC assuming 6 decimals

    it("Setup: Create mint and accounts", async () => {
        user = Keypair.generate();

        // Airdrop some SOL to user
        await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

        // Create test USDC mint
        mint = await createMint(
            provider.connection,
            provider.wallet.payer,
            provider.wallet.publicKey,
            null,
            6
        );

        // Create user's ATA
        userTokenAccount = await createAssociatedTokenAccount(
            provider.connection,
            provider.wallet.payer,
            mint,
            user.publicKey
        );

        // Mint to user
        await mintTo(
            provider.connection,
            provider.wallet.payer,
            mint,
            userTokenAccount,
            provider.wallet.publicKey,
            5_000_000
        );

        assert.ok(userTokenAccount);
    });

    it("Deposit to vault", async () => {
        const [vaultPDA, _vaultBump] = PublicKey.findProgramAddressSync([
            Buffer.from("vault")
        ], program.programId);

        vaultAccount = vaultPDA;
        vaultTokenAccount = await getAssociatedTokenAddress(mint, vaultAccount, true);

        const tx = await program.methods.deposit(depositAmount).accounts({
            vaultAccount,
            vaultTokenAccount,
            userTokenAccount,
            tokenMint: mint,
            user: user.publicKey,
            feePayer: provider.wallet.publicKey,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        }).signers([user]).rpc();

        console.log("Deposit TX:", tx);
        assert.ok(tx);
    });

    it("Withdraw from vault", async () => {
        const tx = await program.methods.withdraw(depositAmount).accounts({
            vaultAccount,
            vaultTokenAccount,
            userTokenAccount,
            tokenMint: mint,
            user: user.publicKey,
            feePayer: provider.wallet.publicKey,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        }).signers([user]).rpc();

        console.log("Withdraw TX:", tx);
        assert.ok(tx);
    });
});
