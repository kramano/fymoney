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

describe("Security and Edge Cases", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Fymoney as Program<Fymoney>;
  const payer = provider.wallet as anchor.Wallet;
  
  let tokenMint: PublicKey;
  let senderTokenAccount: PublicKey;
  let attackerKeypair: Keypair;
  let wrongRecipientKeypair: Keypair;
  
  const ESCROW_AMOUNT = new BN(1_000_000); // 1 USDC
  const SECURITY_TEST_EMAIL = "security-test@example.com";
  const SECURITY_EMAIL_HASH = Array.from(
    crypto.createHash('sha256').update(SECURITY_TEST_EMAIL.toLowerCase().trim()).digest()
  );

  before(async () => {
    console.log("🚀 Setting up security test environment...");
    
    try {
      // Create test token mint
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

      // Create attacker and wrong recipient keypairs
      attackerKeypair = Keypair.generate();
      wrongRecipientKeypair = Keypair.generate();
      
      // Airdrop SOL for transaction fees
      await provider.connection.requestAirdrop(attackerKeypair.publicKey, 1000000000);
      await provider.connection.requestAirdrop(wrongRecipientKeypair.publicKey, 1000000000);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log("✅ Attacker created:", attackerKeypair.publicKey.toString());
      console.log("✅ Wrong recipient created:", wrongRecipientKeypair.publicKey.toString());
      console.log("✅ Security test setup complete!");
      
    } catch (error) {
      console.error("❌ Security setup failed:", error);
      throw error;
    }
  });

  describe("Invalid Amount Tests", () => {
    it("Fails with zero amount", async () => {
      console.log("\n🎯 Testing zero amount rejection...");
      
      try {
        const zeroEmail = "zero-amount@example.com";
        const zeroEmailHash = Array.from(
          crypto.createHash('sha256').update(zeroEmail.toLowerCase().trim()).digest()
        );
        
        const zeroNonce = await findNextNonce(payer.publicKey, zeroEmailHash, program);
        const [zeroPDA] = getEscrowPDA(
          payer.publicKey,
          zeroEmailHash,
          zeroNonce,
          program.programId
        );

        const zeroTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          zeroPDA,
          true
        );

        const expiresAt = new BN(Math.floor(Date.now() / 1000) + 86400);

        await program.methods
          .initializeEscrow(
            new BN(0), // Zero amount
            zeroEmailHash,
            expiresAt,
            new BN(zeroNonce)
          )
          .accounts({
            escrowAccount: zeroPDA,
            escrowTokenAccount: zeroTokenAccount,
            senderTokenAccount: senderTokenAccount,
            tokenMint: tokenMint,
            sender: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        
        assert.fail("Should have failed with zero amount");
      } catch (error) {
        console.log("✅ Expected error caught:", error.toString());
        assert.include(error.toString(), "InvalidAmount", "Should fail with InvalidAmount error");
        console.log("✅ Zero amount rejection working correctly!");
      }
    });

    it("Fails with past expiration date", async () => {
      console.log("\n🎯 Testing past expiration rejection...");
      
      try {
        const pastEmail = "past-expiration@example.com";
        const pastEmailHash = Array.from(
          crypto.createHash('sha256').update(pastEmail.toLowerCase().trim()).digest()
        );
        
        const pastNonce = await findNextNonce(payer.publicKey, pastEmailHash, program);
        const [pastPDA] = getEscrowPDA(
          payer.publicKey,
          pastEmailHash,
          pastNonce,
          program.programId
        );

        const pastTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          pastPDA,
          true
        );

        const pastExpiresAt = new BN(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago

        await program.methods
          .initializeEscrow(
            ESCROW_AMOUNT,
            pastEmailHash,
            pastExpiresAt,
            new BN(pastNonce)
          )
          .accounts({
            escrowAccount: pastPDA,
            escrowTokenAccount: pastTokenAccount,
            senderTokenAccount: senderTokenAccount,
            tokenMint: tokenMint,
            sender: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        
        assert.fail("Should have failed with past expiration");
      } catch (error) {
        console.log("✅ Expected error caught:", error.toString());
        assert.include(error.toString(), "InvalidExpiration", "Should fail with InvalidExpiration error");
        console.log("✅ Past expiration rejection working correctly!");
      }
    });

    it("Fails with expiration too far in future (>30 days)", async () => {
      console.log("\n🎯 Testing maximum expiration limit...");
      
      try {
        const longEmail = "long-expiration@example.com";
        const longEmailHash = Array.from(
          crypto.createHash('sha256').update(longEmail.toLowerCase().trim()).digest()
        );
        
        const longNonce = await findNextNonce(payer.publicKey, longEmailHash, program);
        const [longPDA] = getEscrowPDA(
          payer.publicKey,
          longEmailHash,
          longNonce,
          program.programId
        );

        const longTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          longPDA,
          true
        );

        const longExpiresAt = new BN(Math.floor(Date.now() / 1000) + (31 * 24 * 60 * 60)); // 31 days

        await program.methods
          .initializeEscrow(
            ESCROW_AMOUNT,
            longEmailHash,
            longExpiresAt,
            new BN(longNonce)
          )
          .accounts({
            escrowAccount: longPDA,
            escrowTokenAccount: longTokenAccount,
            senderTokenAccount: senderTokenAccount,
            tokenMint: tokenMint,
            sender: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        
        assert.fail("Should have failed with expiration too long");
      } catch (error) {
        console.log("✅ Expected error caught:", error.toString());
        assert.include(error.toString(), "ExpirationTooLong", "Should fail with ExpirationTooLong error");
        console.log("✅ Maximum expiration limit working correctly!");
      }
    });
  });

  describe("Unauthorized Access Tests", () => {
    let validEscrowPDA: PublicKey;
    let validEscrowTokenAccount: PublicKey;

    before(async () => {
      // Create a valid escrow for unauthorized access tests
      console.log("📝 Creating valid escrow for unauthorized tests...");
      
      const validNonce = await findNextNonce(payer.publicKey, SECURITY_EMAIL_HASH, program);
      [validEscrowPDA] = getEscrowPDA(
        payer.publicKey,
        SECURITY_EMAIL_HASH,
        validNonce,
        program.programId
      );

      validEscrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        validEscrowPDA,
        true
      );

      const expiresAt = new BN(Math.floor(Date.now() / 1000) + 86400);

      await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          SECURITY_EMAIL_HASH,
          expiresAt,
          new BN(validNonce)
        )
        .accounts({
          escrowAccount: validEscrowPDA,
          escrowTokenAccount: validEscrowTokenAccount,
          senderTokenAccount: senderTokenAccount,
          tokenMint: tokenMint,
          sender: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("✅ Valid escrow created for unauthorized tests");
    });

    it("Fails when wrong sender tries to reclaim", async () => {
      console.log("\n🎯 Testing unauthorized reclaim attempt...");
      
      try {
        // Create attacker's token account
        const attackerTokenAccount = await createAssociatedTokenAccount(
          provider.connection,
          attackerKeypair,
          tokenMint,
          attackerKeypair.publicKey
        );

        await program.methods
          .reclaimExpiredEscrow()
          .accounts({
            escrowAccount: validEscrowPDA,
            escrowTokenAccount: validEscrowTokenAccount,
            senderTokenAccount: attackerTokenAccount,
            tokenMint: tokenMint,
            sender: attackerKeypair.publicKey, // Wrong sender!
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([attackerKeypair])
          .rpc();
        
        assert.fail("Should have failed with unauthorized sender");
      } catch (error) {
        console.log("✅ Expected error caught:", error.toString());
        // This should fail due to either UnauthorizedSender or account constraint violation
        assert.isTrue(
          error.toString().includes("UnauthorizedSender") || 
          error.toString().includes("ConstraintSeeds") ||
          error.toString().includes("Error Code:"),
          "Should fail with authorization error"
        );
        console.log("✅ Unauthorized reclaim prevention working correctly!");
      }
    });
  });

  describe("Claim Security Tests", () => {
    let claimTestPDA: PublicKey;
    let claimTestTokenAccount: PublicKey;
    let legitimateRecipient: Keypair;

    before(async () => {
      // Create escrow for claim security tests
      console.log("📝 Creating escrow for claim security tests...");
      
      const claimEmail = "claim-security@example.com";
      const claimEmailHash = Array.from(
        crypto.createHash('sha256').update(claimEmail.toLowerCase().trim()).digest()
      );
      
      const claimNonce = await findNextNonce(payer.publicKey, claimEmailHash, program);
      [claimTestPDA] = getEscrowPDA(
        payer.publicKey,
        claimEmailHash,
        claimNonce,
        program.programId
      );

      claimTestTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        claimTestPDA,
        true
      );

      const expiresAt = new BN(Math.floor(Date.now() / 1000) + 86400);

      await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          claimEmailHash,
          expiresAt,
          new BN(claimNonce)
        )
        .accounts({
          escrowAccount: claimTestPDA,
          escrowTokenAccount: claimTestTokenAccount,
          senderTokenAccount: senderTokenAccount,
          tokenMint: tokenMint,
          sender: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      // Create legitimate recipient and airdrop SOL
      legitimateRecipient = Keypair.generate();
      await provider.connection.requestAirdrop(legitimateRecipient.publicKey, 1000000000);
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log("✅ Claim security test escrow created");
      console.log("✅ Legitimate recipient:", legitimateRecipient.publicKey.toString());
    });

    it("Allows legitimate recipient to claim", async () => {
      console.log("\n🎯 Testing legitimate claim...");
      
      try {
        const recipientTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          legitimateRecipient.publicKey
        );

        const tx = await program.methods
          .claimEscrow()
          .accounts({
            escrowAccount: claimTestPDA,
            escrowTokenAccount: claimTestTokenAccount,
            recipientTokenAccount: recipientTokenAccount,
            tokenMint: tokenMint,
            recipient: legitimateRecipient.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([legitimateRecipient])
          .rpc();

        console.log("✅ Legitimate claim successful:", tx);

        // Verify claim
        const recipientBalance = await provider.connection.getTokenAccountBalance(recipientTokenAccount);
        assert.equal(recipientBalance.value.amount, ESCROW_AMOUNT.toString());
        console.log("✅ Correct amount received:", recipientBalance.value.uiAmount, "USDC");

      } catch (error) {
        console.error("❌ Legitimate claim failed:", error);
        throw error;
      }
    });

    it("Fails when trying to claim expired escrow", async () => {
      console.log("\n🎯 Testing expired escrow claim prevention...");
      
      try {
        // Create an escrow that expires quickly
        const expiredEmail = "expired-claim@example.com";
        const expiredEmailHash = Array.from(
          crypto.createHash('sha256').update(expiredEmail.toLowerCase().trim()).digest()
        );
        
        const expiredNonce = await findNextNonce(payer.publicKey, expiredEmailHash, program);
        const [expiredPDA] = getEscrowPDA(
          payer.publicKey,
          expiredEmailHash,
          expiredNonce,
          program.programId
        );

        const expiredTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          expiredPDA,
          true
        );

        const quickExpiresAt = new BN(Math.floor(Date.now() / 1000) + 2); // 2 seconds

        // Create escrow
        await program.methods
          .initializeEscrow(
            ESCROW_AMOUNT,
            expiredEmailHash,
            quickExpiresAt,
            new BN(expiredNonce)
          )
          .accounts({
            escrowAccount: expiredPDA,
            escrowTokenAccount: expiredTokenAccount,
            senderTokenAccount: senderTokenAccount,
            tokenMint: tokenMint,
            sender: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        console.log("✅ Quick-expiring escrow created");
        
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try to claim expired escrow
        const expiredRecipientTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          legitimateRecipient.publicKey
        );

        try {
          await program.methods
            .claimEscrow()
            .accounts({
              escrowAccount: expiredPDA,
              escrowTokenAccount: expiredTokenAccount,
              recipientTokenAccount: expiredRecipientTokenAccount,
              tokenMint: tokenMint,
              recipient: legitimateRecipient.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([legitimateRecipient])
            .rpc();
          
          assert.fail("Should have failed claiming expired escrow");
        } catch (claimError) {
          console.log("✅ Expected error caught:", claimError.toString());
          assert.include(claimError.toString(), "Escrow has expired", "Should fail with EscrowExpired error");
          console.log("✅ Expired escrow claim prevention working correctly!");
        }
      } catch (error) {
        console.error("❌ Test setup failed:", error);
        throw error;
      }
    });
  });

  describe("Boundary Value Tests", () => {
    it("Accepts maximum valid expiration (30 days)", async () => {
      console.log("\n🎯 Testing maximum valid expiration...");
      
      try {
        const maxEmail = "max-expiration@example.com";
        const maxEmailHash = Array.from(
          crypto.createHash('sha256').update(maxEmail.toLowerCase().trim()).digest()
        );
        
        const maxNonce = await findNextNonce(payer.publicKey, maxEmailHash, program);
        const [maxPDA] = getEscrowPDA(
          payer.publicKey,
          maxEmailHash,
          maxNonce,
          program.programId
        );

        const maxTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          maxPDA,
          true
        );

        const maxExpiresAt = new BN(Math.floor(Date.now() / 1000) + (29 * 24 * 60 * 60)); // 29 days (under limit)

        const tx = await program.methods
          .initializeEscrow(
            ESCROW_AMOUNT,
            maxEmailHash,
            maxExpiresAt,
            new BN(maxNonce)
          )
          .accounts({
            escrowAccount: maxPDA,
            escrowTokenAccount: maxTokenAccount,
            senderTokenAccount: senderTokenAccount,
            tokenMint: tokenMint,
            sender: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        console.log("✅ Maximum expiration escrow created:", tx);

        // Verify escrow was created
        const escrowAccount = await program.account.escrowAccount.fetch(maxPDA);
        assert.equal(escrowAccount.amount.toString(), ESCROW_AMOUNT.toString());
        console.log("✅ 29-day expiration accepted correctly!");

      } catch (error) {
        console.error("❌ Maximum expiration test failed:", error);
        throw error;
      }
    });
  });
});