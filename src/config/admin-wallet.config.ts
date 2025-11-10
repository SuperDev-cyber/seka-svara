/**
 * Admin Wallet Configuration
 * 
 * These wallet addresses receive user deposits.
 * All deposits (BEP20 USDT) are transferred to these addresses.
 * 
 * ⚠️ IMPORTANT: Replace these with actual admin wallet addresses before production!
 */

export const ADMIN_WALLETS = {
  // Binance Smart Chain (BEP20) - BSC Network
  BEP20: {
    address: '0x684ac954a4b55340d539656d7a93a09724067b66', // ✅ Deposit address - all deposits go here
    network: 'BSC',
    chainId: 56, // BSC Mainnet
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    USDTContractAddress: '0x55d398326f99059fF775485246999027B3197955', // USDT on BSC Mainnet
  },
};

/**
 * Get admin wallet address for specific network
 */
export function getAdminWalletAddress(network: 'BEP20'): string {
  const wallet = ADMIN_WALLETS[network];
  if (!wallet) {
    throw new Error(`Unsupported network: ${network}`);
  }
  return wallet.address;
}

/**
 * Get USDT contract address for specific network
 */
export function getUSDTContractAddress(network: 'BEP20'): string {
  const wallet = ADMIN_WALLETS[network];
  if (!wallet) {
    throw new Error(`Unsupported network: ${network}`);
  }
  
  return wallet.USDTContractAddress;
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


  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export default for convenience
export default ADMIN_WALLETS;

