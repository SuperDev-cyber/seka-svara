import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
const TronWeb = require('tronweb');

/**
 * Service for interacting with Tron Network (TRC20)
 */
@Injectable()
export class TronService {
  private tronWeb: any;
  private USDTContract: any;
  private logger = new Logger('TronService');

  constructor(private configService: ConfigService) {
    this.initializeTronWeb();
  }

  private async initializeTronWeb() {
    const fullNode = this.configService.get('TRON_FULL_NODE');
    const solidityNode = this.configService.get('TRON_SOLIDITY_NODE');
    const eventServer = this.configService.get('TRON_EVENT_SERVER');
    const privateKey = this.configService.get('TRON_PRIVATE_KEY');
    const USDTAddress = this.configService.get('TRON_USDT_CONTRACT');

    // Skip blockchain initialization if private key is not properly configured
    // This allows developers to work on non-blockchain features
    if (!privateKey || privateKey.length < 64) {
      this.logger.warn(
        'Tron private key not configured. Blockchain features will be disabled. ' +
        'This is normal for development if you are not working on blockchain features.',
      );
      return;
    }

    try {
      this.tronWeb = new TronWeb({
        fullHost: fullNode,
        headers: { 'TRON-PRO-API-KEY': this.configService.get('TRON_API_KEY') },
        privateKey: privateKey,
      });

      this.USDTContract = await this.tronWeb.contract().at(USDTAddress);
      this.logger.log('Tron service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Tron service: ${error.message}`);
      this.logger.warn('Blockchain features will be disabled');
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      if (!this.USDTContract || !this.tronWeb) {
        throw new Error('Tron service not initialized');
      }
      const balance = await this.USDTContract.balanceOf(address).call();
      let decimals = 6; // Default USDT decimals
      try {
        decimals = await this.USDTContract.decimals().call();
      } catch (error) {
        this.logger.warn(`Could not get decimals, using default 6: ${error.message}`);
      }
      return (balance / Math.pow(10, decimals)).toString();
    } catch (error) {
      this.logger.error(`Failed to get Tron balance: ${error.message}`);
      throw error;
    }
  }

  async transfer(to: string, amount: string): Promise<any> {
    try {
      if (!this.USDTContract || !this.tronWeb) {
        throw new Error('Tron service not initialized. Please configure TRON_PRIVATE_KEY and TRON_USDT_CONTRACT.');
      }

      // Check admin wallet TRX balance for gas fees
      const adminAddress = this.tronWeb.address.fromPrivateKey(this.configService.get('TRON_PRIVATE_KEY'));
      const trxBalance = await this.tronWeb.trx.getBalance(adminAddress);
      const trxBalanceInTRX = trxBalance / 1000000; // Convert from sun to TRX

      // TRC20 transfers require Energy or TRX for fees
      // Minimum recommended: 10 TRX for safety (covers Energy costs)
      if (trxBalanceInTRX < 10) {
        this.logger.warn(`⚠️ Low TRX balance: ${trxBalanceInTRX.toFixed(2)} TRX. Recommended: 10+ TRX for TRC20 transfers.`);
        this.logger.warn(`💡 Tip: Freeze TRX to get Energy (reduces gas costs) or ensure wallet has sufficient TRX.`);
      }

      // USDT on Tron uses 6 decimals
      // Try to get decimals from contract, fallback to 6 if it fails
      let decimals = 6;
      try {
        decimals = await this.USDTContract.decimals().call();
      } catch (error) {
        this.logger.warn(`Could not get decimals from contract, using default 6: ${error.message}`);
        decimals = 6; // USDT standard decimals
      }

      const amountInSun = parseFloat(amount) * Math.pow(10, decimals);

      this.logger.log(`📤 Initiating TRC20 transfer: ${amount} USDT to ${to}`);
      this.logger.log(`💰 Admin wallet TRX balance: ${trxBalanceInTRX.toFixed(2)} TRX`);

      // Attempt transfer - TronWeb will use Energy if available, otherwise burn TRX
      const tx = await this.USDTContract.transfer(to, amountInSun).send();

      this.logger.log(`✅ Tron transfer successful: ${tx}`);
      return {
        success: true,
        txHash: tx,
      };
    } catch (error) {
      // Enhanced error messages for common TRON issues
      let errorMessage = error.message || 'Unknown error';
      
      if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
        errorMessage = `Insufficient TRX balance for gas fees. Admin wallet needs TRX for TRC20 transfers. Current balance may be too low.`;
      } else if (errorMessage.includes('energy') || errorMessage.includes('bandwidth')) {
        errorMessage = `Insufficient Energy/Bandwidth. Consider freezing TRX to get Energy, or ensure wallet has sufficient TRX.`;
      }
      
      this.logger.error(`❌ Tron transfer failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Transfer USDT using user's private key (not admin wallet)
   * @param userPrivateKey User's private key from Web3Auth
   * @param toAddress Recipient address
   * @param amount Amount in USDT (will be converted to sun)
   */
  async transferWithUserKey(userPrivateKey: string, toAddress: string, amount: string): Promise<any> {
    try {
      const fullNode = this.configService.get('TRON_FULL_NODE');
      const USDTAddress = this.configService.get('TRON_USDT_CONTRACT');

      if (!fullNode || !USDTAddress) {
        throw new Error('Tron service not properly configured');
      }

      // Create TronWeb instance with user's private key
      const userTronWeb = new TronWeb({
        fullHost: fullNode,
        headers: { 'TRON-PRO-API-KEY': this.configService.get('TRON_API_KEY') },
        privateKey: userPrivateKey, // ✅ User's private key
      });

      // Get user's address
      const userAddress = userTronWeb.address.fromPrivateKey(userPrivateKey);
      this.logger.log(`📤 Transferring ${amount} USDT from user wallet ${userAddress} to ${toAddress}`);

      // Check user's TRX balance for gas
      const trxBalance = await userTronWeb.trx.getBalance(userAddress);
      const trxBalanceInTRX = trxBalance / 1000000; // Convert from sun to TRX

      // TRC20 transfers require Energy or TRX for fees
      // Minimum recommended: 10 TRX for safety
      if (trxBalanceInTRX < 10) {
        throw new Error(`Insufficient TRX for gas fees. User needs at least 10 TRX, but has ${trxBalanceInTRX.toFixed(2)} TRX.`);
      }

      this.logger.log(`💰 User wallet TRX balance: ${trxBalanceInTRX.toFixed(2)} TRX`);

      // Create USDT contract instance with user's TronWeb
      const usdtContract = await userTronWeb.contract().at(USDTAddress);

      // Get decimals (USDT on TRON uses 6)
      let decimals = 6;
      try {
        decimals = await usdtContract.decimals().call();
      } catch (error) {
        this.logger.warn(`Could not get decimals from contract, using default 6: ${error.message}`);
        decimals = 6;
      }

      // Check user's USDT balance
      const usdtBalance = await usdtContract.balanceOf(userAddress).call();
      const amountInSun = parseFloat(amount) * Math.pow(10, decimals);

      if (usdtBalance < amountInSun) {
        const balanceFormatted = (usdtBalance / Math.pow(10, decimals)).toString();
        throw new Error(`Insufficient USDT balance. User has ${balanceFormatted} USDT, but requested ${amount} USDT.`);
      }

      // Execute transfer
      this.logger.log(`🔄 Executing USDT transfer: ${amount} USDT (${amountInSun} sun)`);
      const tx = await usdtContract.transfer(toAddress, amountInSun).send();

      this.logger.log(`✅ Tron transfer with user key successful: ${tx}`);
      return {
        success: true,
        txHash: tx,
        from: userAddress,
        to: toAddress,
        amount: amount,
      };
    } catch (error) {
      // Enhanced error messages
      let errorMessage = error.message || 'Unknown error';
      
      if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
        errorMessage = `Insufficient balance. ${errorMessage}`;
      } else if (errorMessage.includes('energy') || errorMessage.includes('bandwidth')) {
        errorMessage = `Insufficient Energy/Bandwidth. Consider freezing TRX to get Energy, or ensure wallet has sufficient TRX.`;
      }
      
      this.logger.error(`❌ Tron transfer with user key failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  async verifyTransaction(txHash: string): Promise<any> {
    try {
      // TODO: Verify transaction on Tron
      const tx = await this.tronWeb.trx.getTransaction(txHash);
      if (!tx) {
        return { verified: false, message: 'Transaction not found' };
      }

      const txInfo = await this.tronWeb.trx.getTransactionInfo(txHash);
      return {
        verified: txInfo.receipt?.result === 'SUCCESS',
        blockNumber: txInfo.blockNumber,
        from: this.tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.owner_address),
        to: this.tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.to_address),
      };
    } catch (error) {
      this.logger.error(`Failed to verify Tron transaction: ${error.message}`);
      throw error;
    }
  }

  async estimateFee(to: string, amount: string): Promise<number> {
    try {
      // TRC20 token transfers on TRON require Energy
      // If Energy is available (from frozen TRX), fee is ~0.1-1 TRX
      // If no Energy, TRX is burned: typically 10-20 TRX for TRC20 transfers
      // We estimate conservatively at 15 TRX to ensure sufficient balance
      return 15; // Estimated fee in TRX (conservative estimate)
    } catch (error) {
      this.logger.error(`Failed to estimate fee: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if admin wallet has sufficient TRX for gas fees
   * Returns true if balance >= recommended minimum (10 TRX)
   */
  async checkGasBalance(): Promise<{ sufficient: boolean; balance: number; recommended: number }> {
    try {
      if (!this.tronWeb) {
        throw new Error('Tron service not initialized');
      }

      const adminAddress = this.tronWeb.address.fromPrivateKey(this.configService.get('TRON_PRIVATE_KEY'));
      const trxBalance = await this.tronWeb.trx.getBalance(adminAddress);
      const trxBalanceInTRX = trxBalance / 1000000; // Convert from sun to TRX
      const recommended = 10; // Minimum recommended TRX balance

      return {
        sufficient: trxBalanceInTRX >= recommended,
        balance: trxBalanceInTRX,
        recommended,
      };
    } catch (error) {
      this.logger.error(`Failed to check gas balance: ${error.message}`);
      throw error;
    }
  }
}

