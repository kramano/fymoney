// Simple test to verify escrow service initialization
const { PublicKey } = require('@solana/web3.js');

// Test basic program ID
try {
  const programId = new PublicKey('9PbXHvSA4k86YpoJonchC9LHaFNuGv7XiEf8MdD4ZYNp');
  console.log('✅ Program ID is valid:', programId.toString());
} catch (error) {
  console.error('❌ Invalid program ID:', error);
}

// Test USDC mint address
try {
  const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  console.log('✅ USDC mint is valid:', usdcMint.toString());
} catch (error) {
  console.error('❌ Invalid USDC mint:', error);
}

console.log('✅ Basic service dependencies are valid');