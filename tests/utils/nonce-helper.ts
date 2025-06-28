import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Fymoney } from "../../target/types/fymoney";

/**
 * Finds the next available nonce for creating an escrow
 * Uses simple sequential strategy: 0, 1, 2, etc.
 */
export async function findNextNonce(
  sender: PublicKey,
  emailHash: number[],
  program: Program<Fymoney>
): Promise<number> {
  let nonce = 0;
  
  while (true) {
    try {
      const [escrowPDA] = PublicKey.findProgramAddressSync([
        Buffer.from("escrow"),
        sender.toBuffer(),
        Buffer.from(emailHash),
        new BN(nonce).toBuffer('le', 8)
      ], program.programId);
      
      // Check if account exists
      const existing = await program.account.escrowAccount.fetchNullable(escrowPDA);
      if (!existing) {
        return nonce; // Found available nonce
      }
      
      nonce++;
    } catch (error) {
      return nonce; // Account doesn't exist, use this nonce
    }
  }
}

/**
 * Derives the PDA for an escrow given sender, email hash, and nonce
 */
export function getEscrowPDA(
  sender: PublicKey,
  emailHash: number[],
  nonce: number,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([
    Buffer.from("escrow"),
    sender.toBuffer(),
    Buffer.from(emailHash),
    new BN(nonce).toBuffer('le', 8)
  ], programId);
}

/**
 * Simple timestamp-based nonce (alternative strategy)
 */
export function generateTimestampNonce(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Test multiple escrows for same sender-recipient pair
 */
export async function createMultipleEscrows(
  sender: PublicKey,
  emailHash: number[],
  count: number,
  program: Program<Fymoney>
): Promise<Array<{ pda: PublicKey, nonce: number }>> {
  const escrows = [];
  
  for (let i = 0; i < count; i++) {
    const nonce = await findNextNonce(sender, emailHash, program);
    const [pda] = getEscrowPDA(sender, emailHash, nonce, program.programId);
    escrows.push({ pda, nonce });
  }
  
  return escrows;
}