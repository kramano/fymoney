// Environment configuration with validation
export const getEnvironmentConfig = () => {
  const config = {
    usdcMintAddress: import.meta.env.VITE_USDC_MINT_ADDRESS,
    solanaRpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com",
    dynamicEnvironmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
  };

  // Validate required environment variables
  const missingVars: string[] = [];
  
  if (!config.dynamicEnvironmentId) {
    missingVars.push('VITE_DYNAMIC_ENVIRONMENT_ID');
  }
  
  if (!config.usdcMintAddress) {
    console.warn('VITE_USDC_MINT_ADDRESS not set - USDC balance features will be disabled');
  }

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return config;
};

export const ENV_CONFIG = getEnvironmentConfig();