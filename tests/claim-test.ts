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
import { findNextNonce, getEscrowPDA } from "./utils/nonce-helper";

describe("Claim Escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Fymoney as Program<Fymoney>;
  const payer = provider.wallet as anchor.Wallet;
  
  let tokenMint: PublicKey;
  let senderTokenAccount: PublicKey;
  let recipientKeypair: Keypair;
  let escrowPDA: PublicKey;
  let escrowBump: number;
  let escrowNonce: number;
  let escrowTokenAccount: PublicKey;
  
  const ESCROW_AMOUNT = new BN(1_000_000); // 1 USDC (6 decimals)
  const RECIPIENT_EMAIL = "test@example.com";
  const RECIPIENT_EMAIL_HASH = Array.from(
    crypto.createHash('sha256').update(RECIPIENT_EMAIL.toLowerCase().trim()).digest()
  );

  before(async () => {
    console.log("🚀 Setting up claim test environment...");
    
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

      // Create recipient keypair and airdrop SOL for transaction fees
      recipientKeypair = Keypair.generate();
      await provider.connection.requestAirdrop(recipientKeypair.publicKey, 1000000000); // 1 SOL
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for airdrop
      console.log("✅ Recipient created:", recipientKeypair.publicKey.toString());

      // Create an escrow first
      console.log("📝 Creating escrow for claim test...");
      
      // Find next available nonce and generate PDA
      escrowNonce = await findNextNonce(payer.publicKey, RECIPIENT_EMAIL_HASH, program);
      [escrowPDA, escrowBump] = getEscrowPDA(
        payer.publicKey,
        RECIPIENT_EMAIL_HASH,
        escrowNonce,
        program.programId
      );
      console.log("✅ Escrow PDA:", escrowPDA.toString(), "bump:", escrowBump, "nonce:", escrowNonce);
      
      const expiresAt = new BN(Math.floor(Date.now() / 1000) + 86400); // 1 day

      escrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        escrowPDA,
        true
      );

      const createTx = await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          RECIPIENT_EMAIL_HASH,
          expiresAt,
          new BN(escrowNonce)
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

      console.log("✅ Escrow created for testing:", createTx);
      console.log("- Escrow account:", escrowPDA.toString());
      
      // Verify escrow was created
      const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
      console.log("📋 Escrow details:");
      console.log("- Amount:", escrowAccount.amount.toString());
      console.log("- Status:", escrowAccount.status);
      
    } catch (error) {
      console.error("❌ Setup failed:", error);
      throw error;
    }
  });

  it("Allows recipient to claim escrow", async () => {
    console.log("\n🎯 Starting claim escrow test...");
    
    try {
      // Get recipient token account (will be created if needed)
      const recipientTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        recipientKeypair.publicKey
      );
      console.log("📝 Recipient token account:", recipientTokenAccount.toString());

      console.log("📋 Claim transaction accounts:");
      const accounts = {
        escrowAccount: escrowPDA,
        escrowTokenAccount: escrowTokenAccount,
        recipientTokenAccount: recipientTokenAccount,
        tokenMint: tokenMint,
        recipient: recipientKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      };
      
      Object.entries(accounts).forEach(([key, value]) => {
        console.log(`  ${key}: ${value.toString()}`);
      });

      console.log("📝 Sending claim transaction...");
      const tx = await program.methods
        .claimEscrow()
        .accounts(accounts)
        .signers([recipientKeypair]) // Recipient must sign
        .rpc();

      console.log("✅ Claim transaction successful!");
      console.log("📄 Transaction signature:", tx);

      // Verify escrow status updated
      console.log("📝 Checking escrow status...");
      const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
      console.log("📋 Updated escrow status:", escrowAccount.status);
      console.log("📋 Claimed by wallet:", escrowAccount.recipientWallet?.toString());

      // Verify tokens were transferred
      console.log("📝 Checking recipient token balance...");
      const recipientBalance = await provider.connection.getTokenAccountBalance(
        recipientTokenAccount
      );
      console.log("💰 Recipient balance:", recipientBalance.value.uiAmount, "USDC");

      // Assertions
      assert.equal(escrowAccount.status.claimed !== undefined, true, "Escrow should be marked as claimed");
      assert.equal(
        escrowAccount.recipientWallet?.toString(),
        recipientKeypair.publicKey.toString(),
        "Recipient wallet should be set"
      );
      assert.equal(
        recipientBalance.value.amount,
        ESCROW_AMOUNT.toString(),
        "Recipient should have received the escrowed tokens"
      );

      console.log("✅ All claim assertions passed!");

    } catch (error) {
      console.error("❌ Claim test failed:", error);
      
      if (error.error) {
        console.error("Program error:", error.error);
      }
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      
      throw error;
    }
  });

  it("Fails to claim already claimed escrow", async () => {
    console.log("\n🎯 Testing double claim prevention...");
    
    try {
      const recipientTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        recipientKeypair.publicKey
      );

      // Try to claim the already claimed escrow
      await program.methods
        .claimEscrow()
        .accounts({
          escrowAccount: escrowPDA,
          escrowTokenAccount: escrowTokenAccount,
          recipientTokenAccount: recipientTokenAccount,
          tokenMint: tokenMint,
          recipient: recipientKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([recipientKeypair])
        .rpc();
      
      // Should not reach here
      assert.fail("Should have failed claiming already claimed escrow");
      
    } catch (error) {
      console.log("✅ Expected error caught:", error.toString());
      assert.include(error.toString(), "EscrowNotActive", "Should fail with EscrowNotActive error");
      console.log("✅ Double claim prevention working correctly!");
    }
  });
});