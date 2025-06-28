import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Fymoney } from "../target/types/fymoney";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { assert } from "chai";
import * as crypto from "crypto";

describe("Reclaim Expired Escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Fymoney as Program<Fymoney>;
  const payer = provider.wallet as anchor.Wallet;
  
  let tokenMint: PublicKey;
  let senderTokenAccount: PublicKey;
  let escrowPDA: PublicKey;
  let escrowBump: number;
  let escrowTokenAccount: PublicKey;
  
  const ESCROW_AMOUNT = new BN(2_000_000); // 2 USDC (6 decimals)
  const RECIPIENT_EMAIL = "reclaim-test@example.com";
  const RECIPIENT_EMAIL_HASH = Array.from(
    crypto.createHash('sha256').update(RECIPIENT_EMAIL.toLowerCase().trim()).digest()
  );

  before(async () => {
    console.log("🚀 Setting up reclaim expired test environment...");
    
    try {
      // Create a test token mint
      tokenMint = await createMint(
        provider.connection,
        payer.payer,
        payer.publicKey,
        payer.publicKey,
        6
      );
      console.log("✅ Token mint created:", tokenMint.toString());

      // Create sender's token account and mint tokens
      senderTokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer.payer,
        tokenMint,
        payer.publicKey
      );
      
      await mintTo(
        provider.connection,
        payer.payer,
        tokenMint,
        senderTokenAccount,
        payer.payer,
        10_000_000 // 10 USDC
      );
      console.log("✅ 10 USDC minted to sender");

      // Generate PDA for escrow account
      [escrowPDA, escrowBump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          payer.publicKey.toBuffer(),
          Buffer.from(RECIPIENT_EMAIL_HASH)
        ],
        program.programId
      );
      console.log("✅ Escrow PDA:", escrowPDA.toString(), "bump:", escrowBump);

      escrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        escrowPDA,
        true
      );

      console.log("✅ Test setup complete!");
    } catch (error) {
      console.error("❌ Setup failed:", error);
      throw error;
    }
  });

  it("Creates an escrow that will expire soon", async () => {
    console.log("\n🎯 Creating escrow with short expiration...");
    
    const expiresAt = new BN(Math.floor(Date.now() / 1000) + 1); // 1 second
    
    console.log("📋 Parameters:");
    console.log("- Amount:", ESCROW_AMOUNT.toString(), "(2 USDC)");
    console.log("- Expires in: 1 second");
    console.log("- Expires at:", new Date(expiresAt.toNumber() * 1000).toISOString());

    try {
      const createTx = await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          RECIPIENT_EMAIL_HASH,
          expiresAt
        )
        .accounts({
          escrowAccount: escrowPDA,
          escrowTokenAccount: escrowTokenAccount,
          senderTokenAccount: senderTokenAccount,
          tokenMint: tokenMint,
          sender: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("✅ Escrow created:", createTx);
      
      // Verify escrow was created
      const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
      console.log("📋 Escrow status:", escrowAccount.status);
      console.log("📋 Amount:", escrowAccount.amount.toString());
      
      assert.equal(escrowAccount.amount.toString(), ESCROW_AMOUNT.toString());
      assert.equal(escrowAccount.status.active !== undefined, true);
      
      console.log("✅ Short-lived escrow created successfully!");
      console.log("⏳ Waiting for expiration...");
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2500));
      console.log("✅ Escrow should now be expired");
      
    } catch (error) {
      console.error("❌ Failed to create expiring escrow:", error);
      throw error;
    }
  });

  it("Allows sender to reclaim expired escrow", async () => {
    console.log("\n🎯 Testing expired escrow reclaim...");
    
    try {
      // Get initial balance
      const initialBalance = await provider.connection.getTokenAccountBalance(senderTokenAccount);
      console.log("💰 Initial sender balance:", initialBalance.value.uiAmount, "USDC");

      console.log("📝 Sending reclaim transaction...");
      const reclaimTx = await program.methods
        .reclaimExpiredEscrow()
        .accounts({
          escrowAccount: escrowPDA,
          escrowTokenAccount: escrowTokenAccount,
          senderTokenAccount: senderTokenAccount,
          tokenMint: tokenMint,
          sender: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Reclaim transaction successful!");
      console.log("📄 Transaction signature:", reclaimTx);

      // Verify tokens were returned
      const finalBalance = await provider.connection.getTokenAccountBalance(senderTokenAccount);
      console.log("💰 Final sender balance:", finalBalance.value.uiAmount, "USDC");
      
      const balanceIncrease = new BN(finalBalance.value.amount).sub(
        new BN(initialBalance.value.amount)
      );
      console.log("📈 Balance increase:", balanceIncrease.toString(), "base units");
      
      assert.equal(balanceIncrease.toString(), ESCROW_AMOUNT.toString());
      console.log("✅ Correct amount reclaimed!");

      // Verify escrow account was closed (should fail to fetch)
      console.log("📝 Verifying escrow account closure...");
      try {
        await program.account.escrowAccount.fetch(escrowPDA);
        assert.fail("Escrow account should have been closed");
      } catch (error) {
        console.log("✅ Escrow account successfully closed");
      }

      console.log("🎉 Expired escrow reclaim test passed!");

    } catch (error) {
      console.error("❌ Reclaim test failed:", error);
      
      if (error.error) {
        console.error("Program error:", error.error);
      }
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      
      throw error;
    }
  });

  it("Fails to reclaim non-expired escrow", async () => {
    console.log("\n🎯 Testing premature reclaim prevention...");
    
    try {
      // Create a new escrow that won't expire soon
      const futureExpiresAt = new BN(Math.floor(Date.now() / 1000) + 86400); // 1 day
      
      // Generate new PDA for this test
      const newEmail = "future-test@example.com";
      const newEmailHash = Array.from(
        crypto.createHash('sha256').update(newEmail.toLowerCase().trim()).digest()
      );
      
      const [newEscrowPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          payer.publicKey.toBuffer(),
          Buffer.from(newEmailHash)
        ],
        program.programId
      );

      const newEscrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        newEscrowPDA,
        true
      );

      // Create the non-expired escrow
      console.log("📝 Creating non-expired escrow...");
      await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          newEmailHash,
          futureExpiresAt
        )
        .accounts({
          escrowAccount: newEscrowPDA,
          escrowTokenAccount: newEscrowTokenAccount,
          senderTokenAccount: senderTokenAccount,
          tokenMint: tokenMint,
          sender: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("✅ Non-expired escrow created");

      // Try to reclaim before expiration (should fail)
      console.log("📝 Attempting premature reclaim...");
      await program.methods
        .reclaimExpiredEscrow()
        .accounts({
          escrowAccount: newEscrowPDA,
          escrowTokenAccount: newEscrowTokenAccount,
          senderTokenAccount: senderTokenAccount,
          tokenMint: tokenMint,
          sender: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      // Should not reach here
      assert.fail("Should have failed reclaiming non-expired escrow");
      
    } catch (error) {
      console.log("✅ Expected error caught:", error.toString());
      assert.include(error.toString(), "EscrowNotExpired", "Should fail with EscrowNotExpired error");
      console.log("✅ Premature reclaim prevention working correctly!");
    }
  });
});