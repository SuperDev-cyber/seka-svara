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
  private USDTContract: ethers.Contract;
  private logger = new Logger('BscService');

  constructor(private configService: ConfigService) {
    this.initializeProvider();
  }

  private initializeProvider() {
    const rpcUrl = this.configService.get('BSC_RPC_URL');
    const privateKey = this.configService.get('BSC_PRIVATE_KEY');
    const USDTAddress = this.configService.get('BSC_USDT_CONTRACT');

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
      const USDTAbi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)',
      ];

      this.USDTContract = new ethers.Contract(USDTAddress, USDTAbi, this.wallet);
      this.logger.log('BSC service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize BSC service: ${error.message}`);
      this.logger.warn('Blockchain features will be disabled');
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      if (!this.USDTContract) {
        throw new Error('BSC service not initialized');
      }
      const balance = await this.USDTContract.balanceOf(address);
      let decimals = 18; // BSC USDT typically uses 18 decimals
      try {
        decimals = await this.USDTContract.decimals();
      } catch (error) {
        this.logger.warn(`Could not get decimals, using default 18: ${error.message}`);
      }
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      this.logger.error(`Failed to get BSC balance: ${error.message}`);
      throw error;
    }
  }

  async transfer(to: string, amount: string): Promise<any> {
    try {
      if (!this.USDTContract) {
        throw new Error('BSC service not initialized. Please configure BSC_PRIVATE_KEY and BSC_USDT_CONTRACT.');
      }

      // USDT on BSC typically uses 18 decimals
      // Try to get decimals from contract, fallback to 18 if it fails
      let decimals = 18;
      try {
        decimals = await this.USDTContract.decimals();
      } catch (error) {
        this.logger.warn(`Could not get decimals from contract, using default 18: ${error.message}`);
        decimals = 18; // BSC USDT typically uses 18 decimals
      }

      const amountInWei = ethers.parseUnits(amount, decimals);

      const tx = await this.USDTContract.transfer(to, amountInWei);
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

  /**
   * Verify USDT transfer transaction
   * Checks if the transaction is a USDT transfer to the specified recipient address
   */
  async verifyUSDTTransfer(txHash: string, expectedTo: string, expectedAmount?: string): Promise<any> {
    try {
      if (!this.USDTContract) {
        throw new Error('BSC service not initialized');
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return { verified: false, message: 'Transaction not found' };
      }

      if (receipt.status !== 1) {
        return { verified: false, message: 'Transaction failed' };
      }

      // Parse Transfer event from USDT contract
      const transferEventSignature = ethers.id('Transfer(address,address,uint256)');
      const usdtContractAddress = typeof this.USDTContract.target === 'string' 
        ? this.USDTContract.target 
        : await this.USDTContract.target.getAddress();
      const transferEvents = receipt.logs.filter(log => {
        // Check if this log is from USDT contract
        return log.address.toLowerCase() === usdtContractAddress.toLowerCase() &&
               log.topics[0] === transferEventSignature;
      });

      if (transferEvents.length === 0) {
        return { verified: false, message: 'No USDT transfer found in transaction' };
      }

      // Parse the Transfer event using contract interface
      // Transfer(address indexed from, address indexed to, uint256 value)
      // topics[0] = event signature
      // topics[1] = from address (indexed)
      // topics[2] = to address (indexed)
      // data = amount (uint256, not indexed)
      const transferEvent = transferEvents[0];
      const fromAddress = ethers.getAddress('0x' + transferEvent.topics[1].slice(-40));
      const toAddress = ethers.getAddress('0x' + transferEvent.topics[2].slice(-40));
      
      // Decode the amount from data (uint256)
      // data is a hex string, convert to BigInt
      const amountHex = transferEvent.data;
      const amount = BigInt(amountHex);

      // Get decimals
      let decimals = 18;
      try {
        decimals = await this.USDTContract.decimals();
      } catch (error) {
        this.logger.warn(`Could not get decimals, using default 18: ${error.message}`);
      }

      const amountFormatted = ethers.formatUnits(amount, decimals);

      // Verify recipient address matches (case-insensitive)
      const expectedToLower = expectedTo.toLowerCase();
      const toAddressLower = toAddress.toLowerCase();
      const recipientMatches = expectedToLower === toAddressLower;

      // Verify amount if provided
      let amountMatches = true;
      if (expectedAmount) {
        const expectedAmountBig = ethers.parseUnits(expectedAmount, decimals);
        // ✅ Convert both to BigInt for comparison to avoid mixing types
        const expectedAmountBigInt = typeof expectedAmountBig === 'bigint' 
          ? expectedAmountBig 
          : BigInt(expectedAmountBig.toString());
        const amountBigInt = typeof amount === 'bigint' ? amount : BigInt(amount.toString());
        
        // ✅ Convert tolerance calculation to BigInt properly
        const toleranceValue = 10 ** (decimals - 6);
        const tolerance = BigInt(Math.floor(toleranceValue)); // Allow small tolerance for rounding
        
        // ✅ All BigInt comparisons - no mixing
        amountMatches = (amountBigInt >= expectedAmountBigInt - tolerance) && (amountBigInt <= expectedAmountBigInt + tolerance);
      }

      // ✅ Get confirmations and convert to number to avoid BigInt mixing issues
      const confirmationsBigInt = await receipt.confirmations();
      const confirmations = Number(confirmationsBigInt);
      
      // ✅ Convert blockNumber to number to avoid BigInt mixing issues
      const blockNumber = typeof receipt.blockNumber === 'bigint' 
        ? Number(receipt.blockNumber) 
        : receipt.blockNumber;

      return {
        verified: receipt.status === 1 && recipientMatches && amountMatches,
        blockNumber: blockNumber, // ✅ Now a number, not BigInt
        confirmations: confirmations, // ✅ Now a number, not BigInt
        from: fromAddress,
        to: toAddress,
        amount: amountFormatted, // ✅ Already a string from formatUnits
        recipientMatches,
        amountMatches,
        message: recipientMatches && amountMatches 
          ? 'Transaction verified successfully' 
          : `Verification failed: recipient=${recipientMatches}, amount=${amountMatches}`,
      };
    } catch (error) {
      this.logger.error(`Failed to verify USDT transfer: ${error.message}`);
      throw error;
    }
  }

  async estimateGas(to: string, amount: string): Promise<string> {
    try {
      const decimals = await this.USDTContract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);
      const gasEstimate = await this.USDTContract.transfer.estimateGas(to, amountInWei);
      return gasEstimate.toString();
    } catch (error) {
      this.logger.error(`Failed to estimate gas: ${error.message}`);
      throw error;
    }
  }
}

