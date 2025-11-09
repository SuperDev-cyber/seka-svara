/**
 * Admin Wallet Configuration
 * 
 * These wallet addresses receive user deposits.
 * All deposits (BEP20 and ERC20 USDT) are transferred to these addresses.
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
  // Ethereum Mainnet (ERC20) - ETH Network
  ERC20: {
    address: '0x684ac954a4b55340d539656d7a93a09724067b66', // ✅ Deposit address - all deposits go here (same as BEP20 for now)
    network: 'ETH',
    chainId: 1, // Ethereum Mainnet
    testnetChainId: 5, // Goerli Testnet
    rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY', // Replace with actual Infura key
    testnetRpcUrl: 'https://goerli.infura.io/v3/YOUR_INFURA_KEY',
    USDTContractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum Mainnet
    testnetUSDTContractAddress: '0x...', // USDT on Goerli Testnet
  },
};

/**
 * Get admin wallet address for specific network
 */
export function getAdminWalletAddress(network: 'BEP20' | 'ERC20'): string {
  const wallet = ADMIN_WALLETS[network];
  if (!wallet) {
    throw new Error(`Unsupported network: ${network}`);
  }
  return wallet.address;
}

/**
 * Get USDT contract address for specific network
 */
export function getUSDTContractAddress(network: 'BEP20' | 'ERC20', isTestnet: boolean = false): string {
  const wallet = ADMIN_WALLETS[network];
  if (!wallet) {
    throw new Error(`Unsupported network: ${network}`);
  }
  
  return isTestnet ? wallet.testnetUSDTContractAddress : wallet.USDTContractAddress;
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

  // Check ERC20
  if (ADMIN_WALLETS.ERC20.address === '0x0000000000000000000000000000000000000000') {
    errors.push('ERC20 admin wallet address is not configured (using default zero address)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export default for convenience
export default ADMIN_WALLETS;

