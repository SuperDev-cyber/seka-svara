import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

/**
 * Service for interacting with Ethereum Mainnet (ERC20)
 */
@Injectable()
export class EthereumService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private USDTContract: ethers.Contract;
  private usdtDecimals = 6; // USDT on Ethereum uses 6 decimals
  private initialized = false;
  private logger = new Logger('EthereumService');

  constructor(private configService: ConfigService) {
    // Initialize provider asynchronously
    this.initializeProvider().catch((error) => {
      this.logger.error(`Failed to initialize Ethereum service: ${error.message}`);
    });
  }

  private async initializeProvider() {
    const rpcUrl = this.configService.get('ETH_RPC_URL') || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY';
    const privateKey = this.configService.get('ETH_PRIVATE_KEY');
    const USDTAddress = this.configService.get('ETH_USDT_CONTRACT') || '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // USDT on Ethereum Mainnet

    // Skip blockchain initialization if private key is not properly configured
    if (!privateKey || privateKey.length < 64) {
      this.logger.warn(
        'Ethereum private key not configured. Blockchain features will be disabled. ' +
        'This is normal for development if you are not working on blockchain features.',
      );
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      // USDT Token ABI (minimal for transfer and balanceOf)
      const USDTAbi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)',
      ];

      this.USDTContract = new ethers.Contract(USDTAddress, USDTAbi, this.wallet);
      
      // Get decimals
      try {
        this.usdtDecimals = await this.USDTContract.decimals();
      } catch (error) {
        this.logger.warn(`Could not fetch USDT decimals, defaulting to 6: ${error.message}`);
        this.usdtDecimals = 6; // USDT on Ethereum uses 6 decimals
      }

      this.initialized = true;
      this.logger.log('Ethereum service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Ethereum service: ${error.message}`);
      this.logger.warn('Blockchain features will be disabled');
    }
  }

  async getBalance(address: string): Promise<string> {
    if (!this.USDTContract) {
      throw new Error('Ethereum service not initialized');
    }

    try {
      const balance = await this.USDTContract.balanceOf(address);
      const decimals = await this.getUSDTDecimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      this.logger.error(`Failed to get USDT balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transfer USDT using user's private key (for withdrawals)
   * This allows users to withdraw from their own Web3Auth account
   */
  async transferWithUserKey(userPrivateKey: string, toAddress: string, amount: string): Promise<any> {
    try {
      if (!this.provider) {
        throw new Error('Ethereum service not initialized');
      }

      // Create wallet from user's private key
      const userWallet = new ethers.Wallet(userPrivateKey, this.provider);
      const userAddress = userWallet.address;

      // Check user's ETH balance for gas fees
      const ethBalance = await this.provider.getBalance(userAddress);
      const ethBalanceFormatted = ethers.formatEther(ethBalance);
      
      // Minimum ETH required for gas (conservative estimate: 0.001 ETH)
      const minEthRequired = ethers.parseEther('0.001');
      
      if (ethBalance < minEthRequired) {
        throw new Error(
          `Insufficient ETH for gas fees. You have ${ethBalanceFormatted} ETH, but need at least 0.001 ETH. ` +
          `Please add ETH to your wallet at ${userAddress} to cover transaction fees.`
        );
      }

      // Get USDT contract with user's wallet as signer
      const USDTAddress = this.configService.get('ETH_USDT_CONTRACT') || '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const USDTAbi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)',
      ];
      const usdtContract = new ethers.Contract(USDTAddress, USDTAbi, userWallet);

      // Get decimals and format amount
      const decimals = await usdtContract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);

      // Check user's USDT balance
      const userBalance = await usdtContract.balanceOf(userAddress);
      if (userBalance < amountInWei) {
        const userBalanceFormatted = ethers.formatUnits(userBalance, decimals);
        throw new Error(
          `Insufficient USDT balance. You have ${userBalanceFormatted} USDT, but requested ${amount} USDT.`
        );
      }

      // Execute transfer
      const tx = await usdtContract.transfer(toAddress, amountInWei);
      this.logger.log(`Transfer transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      this.logger.log(`Transfer confirmed in block ${receipt.blockNumber}`);

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        from: userAddress,
        to: toAddress,
        amount: amount,
      };
    } catch (error) {
      this.logger.error(`Failed to transfer USDT with user key: ${error.message}`);
      throw error;
    }
  }

  async verifyTransaction(txHash: string): Promise<any> {
    try {
      if (!this.provider) {
        throw new Error('Ethereum service not initialized');
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error('Transaction not found');
      }

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        confirmations: await receipt.confirmations(),
        from: receipt.from,
        to: receipt.to,
      };
    } catch (error) {
      this.logger.error(`Failed to verify Ethereum transaction: ${error.message}`);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized && !!this.provider && !!this.USDTContract;
  }

  getProvider(): ethers.JsonRpcProvider | null {
    return this.provider || null;
  }

  async getUSDTDecimals(): Promise<number> {
    if (!this.USDTContract) {
      throw new Error('Ethereum service not initialized');
    }
    if (!this.usdtDecimals) {
      try {
        this.usdtDecimals = await this.USDTContract.decimals();
      } catch (error) {
        this.logger.warn(`Could not fetch USDT decimals, defaulting to 6: ${error.message}`);
        this.usdtDecimals = 6;
      }
    }
    return this.usdtDecimals;
  }
}

