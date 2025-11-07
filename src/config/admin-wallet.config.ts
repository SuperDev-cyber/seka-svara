/**
 * Admin Wallet Configuration
 * 
 * These wallet addresses receive user deposits.
 * All deposits (TRC20 USDT and BEP20 USDT) are transferred to these addresses.
 * 
 * ⚠️ IMPORTANT: Replace these with actual admin wallet addresses before production!
 */

export const ADMIN_WALLETS = {
  // Binance Smart Chain (BEP20) - BSC Network
  BEP20: {
    address: '0x684ac954a4b55340d539656d7a93a09724067b66', // ✅ Deposit address - all deposits go here
    network: 'BSC',
    chainId: 56, // BSC Mainnet
    testnetChainId: 97, // BSC Testnet
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    testnetRpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    USDTContractAddress: '0x55d398326f99059fF775485246999027B3197955', // USDT on BSC Mainnet
    testnetUSDTContractAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', // USDT on BSC Testnet
  },

  // TRON Network (TRC20)
  TRC20: {
    address: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', // 🔴 REPLACE WITH ACTUAL TRC20 WALLET
    network: 'TRON',
    rpcUrl: 'https://api.trongrid.io',
    testnetRpcUrl: 'https://api.shasta.trongrid.io',
    USDTContractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT on TRON Mainnet
    testnetUSDTContractAddress: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs', // USDT on TRON Testnet (Shasta)
  },
};

/**
 * Get admin wallet address for specific network
 */
export function getAdminWalletAddress(network: 'BEP20' | 'TRC20'): string {
  const wallet = ADMIN_WALLETS[network];
  if (!wallet) {
    throw new Error(`Unsupported network: ${network}`);
  }
  return wallet.address;
}

/**
 * Get USDT contract address for specific network
 */
export function getUSDTContractAddress(network: 'BEP20' | 'TRC20', isTestnet: boolean = false): string {
  const wallet = ADMIN_WALLETS[network];
  if (!wallet) {
    throw new Error(`Unsupported network: ${network}`);
  }
  
  if (network === 'BEP20') {
    return isTestnet ? wallet.testnetUSDTContractAddress : wallet.USDTContractAddress;
  } else {
    return isTestnet ? wallet.testnetUSDTContractAddress : wallet.USDTContractAddress;
  }
}

/**
 * Validate that admin wallets are configured (not default addresses)
 */
export function validateAdminWallets(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check BEP20
  if (ADMIN_WALLETS.BEP20.address === '0x0000000000000000000000000000000000000000') {
    errors.push('BEP20 admin wallet address is not configured (using default zero address)');
  }

  // Check TRC20 (simplified check - just ensure it's not the placeholder)
  if (ADMIN_WALLETS.TRC20.address === 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb') {
    errors.push('TRC20 admin wallet address is not configured (using placeholder address)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export default for convenience
export default ADMIN_WALLETS;

