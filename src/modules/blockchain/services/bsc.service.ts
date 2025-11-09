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
  private usdtDecimals = 18;
  private initialized = false;
  private logger = new Logger('BscService');

  constructor(private configService: ConfigService) {
    // Initialize provider asynchronously
    this.initializeProvider().catch((error) => {
      this.logger.error(`Failed to initialize BSC service: ${error.message}`);
    });
  }

  private async initializeProvider() {
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
      try {
        this.usdtDecimals = await this.USDTContract.decimals();
      } catch (decimalsError) {
        this.logger.warn(`Could not fetch USDT decimals on init, using default 18: ${decimalsError.message}`);
        this.usdtDecimals = 18;
      }
      this.initialized = true;
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
      const decimals = await this.getUSDTDecimals();
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
      const decimals = await this.getUSDTDecimals();

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

  /**
   * Transfer USDT using user's private key (not admin wallet)
   * @param userPrivateKey User's private key from Web3Auth
   * @param toAddress Recipient address
   * @param amount Amount in USDT (will be converted to wei)
   */
  async transferWithUserKey(userPrivateKey: string, toAddress: string, amount: string): Promise<any> {
    try {
      if (!this.provider) {
        throw new Error('BSC provider not initialized');
      }

      // Create wallet from user's private key
      const userWallet = new ethers.Wallet(userPrivateKey, this.provider);
      const userAddress = userWallet.address;

      this.logger.log(`📤 Transferring ${amount} USDT from user wallet ${userAddress} to ${toAddress}`);

      // Check user's BNB balance for gas
      // USDT transfers on BSC typically cost ~0.0001-0.0003 BNB in gas fees
      // We set a conservative minimum of 0.0001 BNB to ensure transaction can proceed
      const bnbBalance = await this.provider.getBalance(userAddress);
      const bnbBalanceInBNB = parseFloat(ethers.formatEther(bnbBalance));

      if (bnbBalanceInBNB < 0.0001) {
        throw new Error(`Insufficient BNB for gas fees. You need at least 0.0001 BNB to pay for transaction fees, but your wallet has ${bnbBalanceInBNB.toFixed(6)} BNB. Please add BNB to your Web3Auth wallet to proceed with the withdrawal.`);
      }

      this.logger.log(`💰 User wallet BNB balance: ${bnbBalanceInBNB.toFixed(6)} BNB`);

      // Get USDT contract address
      const usdtAddress = this.configService.get('BSC_USDT_CONTRACT');
      if (!usdtAddress) {
        throw new Error('BSC_USDT_CONTRACT not configured');
      }

      // USDT Token ABI (minimal for transfer)
      const USDTAbi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)',
      ];

      // Create USDT contract instance with user's wallet
      const usdtContract = new ethers.Contract(usdtAddress, USDTAbi, userWallet);

      // Get decimals
      let decimals = 18;
      try {
        decimals = await usdtContract.decimals();
      } catch (error) {
        this.logger.warn(`Could not fetch USDT decimals, using default 18: ${error.message}`);
      }

      // Convert amount to wei
      const amountInWei = ethers.parseUnits(amount, decimals);

      // Check user's USDT balance
      const usdtBalance = await usdtContract.balanceOf(userAddress);
      if (usdtBalance < amountInWei) {
        const balanceFormatted = ethers.formatUnits(usdtBalance, decimals);
        throw new Error(`Insufficient USDT balance. User has ${balanceFormatted} USDT, but requested ${amount} USDT.`);
      }

      // Execute transfer
      this.logger.log(`🔄 Executing USDT transfer: ${amount} USDT (${amountInWei.toString()} wei)`);
      const tx = await usdtContract.transfer(toAddress, amountInWei);
      const receipt = await tx.wait();

      this.logger.log(`✅ BSC transfer with user key successful: ${receipt.hash}`);
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        from: userAddress,
        to: toAddress,
        amount: amount,
      };
    } catch (error) {
      this.logger.error(`❌ BSC transfer with user key failed: ${error.message}`);
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
      const decimals = await this.getUSDTDecimals();

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
          : BigInt(String(expectedAmountBig));
        const amountBigInt = typeof amount === 'bigint' ? amount : BigInt(String(amount));
        
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
      const decimals = await this.getUSDTDecimals();
      const amountInWei = ethers.parseUnits(amount, decimals);
      const gasEstimate = await this.USDTContract.transfer.estimateGas(to, amountInWei);
      return gasEstimate.toString();
    } catch (error) {
      this.logger.error(`Failed to estimate gas: ${error.message}`);
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
      throw new Error('BSC service not initialized');
    }
    if (!this.usdtDecimals) {
      try {
        this.usdtDecimals = await this.USDTContract.decimals();
      } catch (error) {
        this.logger.warn(`Could not fetch USDT decimals, defaulting to 18: ${error.message}`);
        this.usdtDecimals = 18;
      }
    }
    return this.usdtDecimals;
  }

  async getUSDTTransferEventsTo(
    toAddresses: string[],
    fromBlock: number,
    toBlock: number,
  ): Promise<{
    txHash: string;
    from: string;
    to: string;
    amountRaw: bigint;
    amount: number;
    blockNumber: number;
    logIndex: number;
  }[]> {
    if (!this.provider || !this.USDTContract) {
      throw new Error('BSC service not initialized');
    }

    if (!toAddresses || toAddresses.length === 0) {
      return [];
    }

    const normalizedAddresses = toAddresses
      .filter(Boolean)
      .map((addr) => ethers.getAddress(addr).toLowerCase());

    if (normalizedAddresses.length === 0) {
      return [];
    }

    const iface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);
    // Use ethers.id() to get the event topic hash (ethers v6 compatible)
    const topic = ethers.id('Transfer(address,address,uint256)');
    const addressTopicValues = normalizedAddresses.map((addr) =>
      ethers.zeroPadValue(addr, 32),
    );

    const usdtAddress = typeof this.USDTContract.target === 'string'
      ? this.USDTContract.target
      : await this.USDTContract.target.getAddress();

    const logs = await this.provider.getLogs({
      address: usdtAddress,
      fromBlock,
      toBlock,
      topics: [topic, null, addressTopicValues],
    });

    if (!logs || logs.length === 0) {
      return [];
    }

    const decimals = await this.getUSDTDecimals();

    return logs.map((log, index) => {
      const parsed = iface.parseLog(log);
      
      // Add null check for parsed
      if (!parsed) {
        throw new Error(`Failed to parse log at index ${index}`);
      }
      
      const rawAmount = parsed.args.value as bigint;
      const formattedAmount = Number(ethers.formatUnits(rawAmount, decimals));

      return {
        txHash: log.transactionHash,
        from: ethers.getAddress(parsed.args.from),
        to: ethers.getAddress(parsed.args.to),
        amountRaw: rawAmount,
        amount: formattedAmount,
        blockNumber: Number(log.blockNumber),
        // Use index as logIndex since log.logIndex doesn't exist in ethers v6
        logIndex: index,
      };
    });
  }
}

