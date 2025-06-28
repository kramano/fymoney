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

describe("Initialize Escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Fymoney as Program<Fymoney>;
  const payer = provider.wallet as anchor.Wallet;
  
  let tokenMint: PublicKey;
  let senderTokenAccount: PublicKey;
  
  const ESCROW_AMOUNT = new BN(1_000_000); // 1 USDC (6 decimals)
  const RECIPIENT_EMAIL = "initialize-test@example.com";
  const RECIPIENT_EMAIL_HASH = Array.from(
    crypto.createHash('sha256').update(RECIPIENT_EMAIL.toLowerCase().trim()).digest()
  );

  before(async () => {
    console.log("🚀 Setting up test environment...");
    console.log("Provider wallet:", payer.publicKey.toString());
    console.log("Program ID:", program.programId.toString());
    
    try {
      // Create a test token mint (simulating USDC)
      console.log("📝 Creating test token mint...");
      tokenMint = await createMint(
        provider.connection,
        payer.payer,
        payer.publicKey,
        payer.publicKey,
        6 // USDC has 6 decimals
      );
      console.log("✅ Token mint created:", tokenMint.toString());

      // Create sender's token account
      console.log("📝 Creating sender token account...");
      senderTokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer.payer,
        tokenMint,
        payer.publicKey
      );
      console.log("✅ Sender token account created:", senderTokenAccount.toString());

      // Mint tokens to sender
      console.log("📝 Minting test tokens...");
      await mintTo(
        provider.connection,
        payer.payer,
        tokenMint,
        senderTokenAccount,
        payer.payer,
        10_000_000 // 10 USDC
      );
      console.log("✅ 10 USDC minted to sender");

      // Check balance
      const balance = await provider.connection.getTokenAccountBalance(senderTokenAccount);
      console.log("💰 Sender balance:", balance.value.uiAmount, "USDC");
      
      console.log("✅ Test setup complete!");
    } catch (error) {
      console.error("❌ Setup failed:", error);
      throw error;
    }
  });

  it("Creates an escrow successfully", async () => {
    console.log("\n🎯 Starting escrow creation test...");
    
    const expiresAt = new BN(Math.floor(Date.now() / 1000) + 86400); // 1 day
    
    // Find next available nonce and generate PDA
    const nonce = await findNextNonce(payer.publicKey, RECIPIENT_EMAIL_HASH, program);
    const [escrowPDA, escrowBump] = getEscrowPDA(
      payer.publicKey,
      RECIPIENT_EMAIL_HASH,
      nonce,
      program.programId
    );
    
    console.log("📋 Test parameters:");
    console.log("- Escrow PDA:", escrowPDA.toString(), "bump:", escrowBump);
    console.log("- Nonce:", nonce);
    console.log("- Amount:", ESCROW_AMOUNT.toString(), "base units (1 USDC)");
    console.log("- Recipient email hash:", Buffer.from(RECIPIENT_EMAIL_HASH).toString('hex'));
    console.log("- Expires at:", new Date(expiresAt.toNumber() * 1000).toISOString());

    try {
      // Get escrow token account address
      console.log("📝 Computing escrow token account...");
      const escrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        escrowPDA,
        true // allowOwnerOffCurve
      );
      console.log("✅ Escrow token account:", escrowTokenAccount.toString());

      console.log("📝 Preparing transaction accounts...");
      const accounts = {
        escrowAccount: escrowPDA,
        escrowTokenAccount: escrowTokenAccount,
        senderTokenAccount: senderTokenAccount,
        tokenMint: tokenMint,
        sender: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      };
      
      console.log("📋 Transaction accounts:");
      Object.entries(accounts).forEach(([key, value]) => {
        console.log(`  ${key}: ${value.toString()}`);
      });

      console.log("📝 Sending transaction...");
      const tx = await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          RECIPIENT_EMAIL_HASH,
          expiresAt,
          new BN(nonce)
        )
        .accounts(accounts)
        .rpc();

      console.log("✅ Transaction successful!");
      console.log("📄 Transaction signature:", tx);

      // Verify escrow account state
      console.log("📝 Fetching escrow account state...");
      const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
      
      console.log("📋 Escrow account data:");
      console.log("- Sender:", escrowAccount.sender.toString());
      console.log("- Amount:", escrowAccount.amount.toString());
      console.log("- Token mint:", escrowAccount.tokenMint.toString());
      console.log("- Status:", escrowAccount.status);
      console.log("- Created at:", new Date(escrowAccount.createdAt.toNumber() * 1000).toISOString());
      console.log("- Expires at:", new Date(escrowAccount.expiresAt.toNumber() * 1000).toISOString());
      
      // Verify data integrity
      assert.equal(escrowAccount.sender.toString(), payer.publicKey.toString());
      assert.equal(escrowAccount.amount.toString(), ESCROW_AMOUNT.toString());
      assert.equal(escrowAccount.tokenMint.toString(), tokenMint.toString());
      assert.deepEqual(Array.from(escrowAccount.recipientEmailHash), RECIPIENT_EMAIL_HASH);

      console.log("✅ All assertions passed - escrow created successfully!");

    } catch (error) {
      console.error("❌ Test failed with error:", error);
      
      // Try to extract more detailed error info
      if (error.error) {
        console.error("Program error:", error.error);
      }
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      
      throw error;
    }
  });
});