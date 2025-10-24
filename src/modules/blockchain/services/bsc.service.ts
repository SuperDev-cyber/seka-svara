import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

/**
 * Service for interacting with Binance Smart Chain (BEP20)
 */
@Injectable()
export class BscService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private usdtContract: ethers.Contract;
  private logger = new Logger('BscService');

  constructor(private configService: ConfigService) {
    this.initializeProvider();
  }

  private initializeProvider() {
    const rpcUrl = this.configService.get('BSC_RPC_URL');
    const privateKey = this.configService.get('BSC_PRIVATE_KEY');
    const usdtAddress = this.configService.get('BSC_USDT_CONTRACT');

    // Skip blockchain initialization if private key is not properly configured
    // This allows developers to work on non-blockchain features
    if (!privateKey || privateKey.length < 64) {
      this.logger.warn(
        'BSC private key not configured. Blockchain features will be disabled. ' +
        'This is normal for development if you are not working on blockchain features.',
      );
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      // USDT Token ABI (minimal for transfer and balanceOf)
      const usdtAbi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)',
      ];

      this.usdtContract = new ethers.Contract(usdtAddress, usdtAbi, this.wallet);
      this.logger.log('BSC service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize BSC service: ${error.message}`);
      this.logger.warn('Blockchain features will be disabled');
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.usdtContract.balanceOf(address);
      const decimals = await this.usdtContract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      this.logger.error(`Failed to get BSC balance: ${error.message}`);
      throw error;
    }
  }

  async transfer(to: string, amount: string): Promise<any> {
    try {
      // TODO: Implement USDT transfer on BSC
      const decimals = await this.usdtContract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);

      const tx = await this.usdtContract.transfer(to, amountInWei);
      const receipt = await tx.wait();

      this.logger.log(`BSC transfer successful: ${receipt.hash}`);
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      this.logger.error(`BSC transfer failed: ${error.message}`);
      throw error;
    }
  }

  async verifyTransaction(txHash: string): Promise<any> {
    try {
      // TODO: Verify transaction on BSC
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return { verified: false, message: 'Transaction not found' };
      }

      return {
        verified: receipt.status === 1,
        blockNumber: receipt.blockNumber,
        confirmations: await receipt.confirmations(),
        from: receipt.from,
        to: receipt.to,
      };
    } catch (error) {
      this.logger.error(`Failed to verify BSC transaction: ${error.message}`);
      throw error;
    }
  }

  async estimateGas(to: string, amount: string): Promise<string> {
    try {
      const decimals = await this.usdtContract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);
      const gasEstimate = await this.usdtContract.transfer.estimateGas(to, amountInWei);
      return gasEstimate.toString();
    } catch (error) {
      this.logger.error(`Failed to estimate gas: ${error.message}`);
      throw error;
    }
  }
}

