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

describe("Multiple Escrows Test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Fymoney as Program<Fymoney>;
  const payer = provider.wallet as anchor.Wallet;
  
  let tokenMint: PublicKey;
  let senderTokenAccount: PublicKey;
  
  const ESCROW_AMOUNT = new BN(500_000); // 0.5 USDC
  const RECIPIENT_EMAIL = "multi-test@example.com";
  const RECIPIENT_EMAIL_HASH = Array.from(
    crypto.createHash('sha256').update(RECIPIENT_EMAIL.toLowerCase().trim()).digest()
  );

  before(async () => {
    console.log("🚀 Setting up multiple escrows test environment...");
    
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
        20_000_000 // 20 USDC
      );
      console.log("✅ 20 USDC minted to sender");
      console.log("✅ Test setup complete!");
      
    } catch (error) {
      console.error("❌ Setup failed:", error);
      throw error;
    }
  });

  it("Creates multiple escrows for same sender-recipient pair", async () => {
    console.log("\n🎯 Testing multiple escrow creation...");
    
    const escrows = [];
    const numberOfEscrows = 3;
    
    for (let i = 0; i < numberOfEscrows; i++) {
      console.log(`\n📝 Creating escrow ${i + 1}/${numberOfEscrows}...`);
      
      // Find next available nonce
      const nonce = await findNextNonce(payer.publicKey, RECIPIENT_EMAIL_HASH, program);
      const [escrowPDA, escrowBump] = getEscrowPDA(
        payer.publicKey,
        RECIPIENT_EMAIL_HASH,
        nonce,
        program.programId
      );
      
      console.log(`- PDA: ${escrowPDA.toString()}`);
      console.log(`- Nonce: ${nonce}`);
      console.log(`- Bump: ${escrowBump}`);
      
      const escrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        escrowPDA,
        true
      );
      
      const expiresAt = new BN(Math.floor(Date.now() / 1000) + 86400); // 1 day
      
      try {
        const createTx = await program.methods
          .initializeEscrow(
            ESCROW_AMOUNT,
            RECIPIENT_EMAIL_HASH,
            expiresAt,
            new BN(nonce)
          )
          .accounts({
            escrowAccount: escrowPDA,
            escrowTokenAccount: escrowTokenAccount,
            senderTokenAccount: senderTokenAccount,
            tokenMint: tokenMint,
            sender: payer.publicKey,
            feePayer: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        console.log(`✅ Escrow ${i + 1} created successfully!`);
        console.log(`- Transaction: ${createTx}`);
        
        // Verify escrow was created
        const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
        assert.equal(escrowAccount.amount.toString(), ESCROW_AMOUNT.toString());
        assert.equal(escrowAccount.nonce.toString(), nonce.toString());
        assert.equal(escrowAccount.status.active !== undefined, true);
        
        escrows.push({
          pda: escrowPDA,
          nonce,
          bump: escrowBump,
          tokenAccount: escrowTokenAccount,
          transaction: createTx
        });
        
      } catch (error) {
        console.error(`❌ Failed to create escrow ${i + 1}:`, error);
        throw error;
      }
    }
    
    console.log(`\n✅ Successfully created ${numberOfEscrows} escrows!`);
    console.log("📋 Escrow summary:");
    
    escrows.forEach((escrow, index) => {
      console.log(`  ${index + 1}. PDA: ${escrow.pda.toString()}, Nonce: ${escrow.nonce}`);
    });
    
    // Verify all escrows are unique
    const uniquePDAs = new Set(escrows.map(e => e.pda.toString()));
    assert.equal(uniquePDAs.size, numberOfEscrows, "All escrow PDAs should be unique");
    
    const uniqueNonces = new Set(escrows.map(e => e.nonce));
    assert.equal(uniqueNonces.size, numberOfEscrows, "All nonces should be unique");
    
    console.log("✅ All escrows have unique PDAs and nonces!");
    console.log("🎉 Multiple escrows test passed!");
  });

  it("Demonstrates nonce collision prevention", async () => {
    console.log("\n🎯 Testing nonce collision prevention...");
    
    try {
      // Try to create an escrow with nonce 0 (should already exist)
      const existingNonce = 0;
      const [duplicatePDA] = getEscrowPDA(
        payer.publicKey,
        RECIPIENT_EMAIL_HASH,
        existingNonce,
        program.programId
      );
      
      const duplicateTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        duplicatePDA,
        true
      );
      
      const expiresAt = new BN(Math.floor(Date.now() / 1000) + 86400);
      
      await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          RECIPIENT_EMAIL_HASH,
          expiresAt,
          new BN(existingNonce)
        )
        .accounts({
          escrowAccount: duplicatePDA,
          escrowTokenAccount: duplicateTokenAccount,
          senderTokenAccount: senderTokenAccount,
          tokenMint: tokenMint,
          sender: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      
      assert.fail("Should have failed creating duplicate escrow");
    } catch (error) {
      console.log("✅ Expected error caught:", error.toString());
      assert.include(error.toString(), "already in use", "Should fail with 'already in use' error");
      console.log("✅ Nonce collision prevention working correctly!");
    }
  });
});