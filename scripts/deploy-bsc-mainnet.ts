import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Deploying Seka Svara contracts to BSC Mainnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "BNB\n");

  // Contract addresses on BSC Mainnet
  const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"; // USDT on BSC
  const FEE_RECEIVER = process.env.FEE_RECEIVER || deployer.address; // Fee receiver address

  console.log("📋 Configuration:");
  console.log("  USDT Address:", USDT_ADDRESS);
  console.log("  Fee Receiver:", FEE_RECEIVER);
  console.log("");

  // Step 1: Deploy UserVault implementation
  console.log("📦 Step 1: Deploying UserVault implementation...");
  const UserVault = await ethers.getContractFactory("UserVault");
  const vaultImplementation = await UserVault.deploy();
  await vaultImplementation.deployed();
  console.log("✅ UserVault implementation deployed to:", vaultImplementation.address);

  // Step 2: Deploy VaultFactory
  console.log("\n📦 Step 2: Deploying VaultFactory...");
  const VaultFactory = await ethers.getContractFactory("VaultFactory");
  const vaultFactory = await VaultFactory.deploy(USDT_ADDRESS, FEE_RECEIVER);
  await vaultFactory.deployed();
  console.log("✅ VaultFactory deployed to:", vaultFactory.address);

  // Step 3: Deploy SekaSvaraGame
  console.log("\n📦 Step 3: Deploying SekaSvaraGame...");
  const SekaSvaraGame = await ethers.getContractFactory("SekaSvaraGame");
  const gameContract = await SekaSvaraGame.deploy(USDT_ADDRESS, vaultFactory.address, FEE_RECEIVER);
  await gameContract.deployed();
  console.log("✅ SekaSvaraGame deployed to:", gameContract.address);

  // Step 4: Set game contract in factory
  console.log("\n🔗 Step 4: Linking game contract to factory...");
  const setGameTx = await vaultFactory.setGameContract(gameContract.address);
  await setGameTx.wait();
  console.log("✅ Game contract linked to factory");

  // Step 5: Grant SETTLER_ROLE to deployer (or specified address)
  const SETTLER_ADDRESS = process.env.SETTLER_ADDRESS || deployer.address;
  console.log("\n🔐 Step 5: Granting SETTLER_ROLE...");
  const SETTLER_ROLE = await gameContract.SETTLER_ROLE();
  const grantRoleTx = await gameContract.grantRole(SETTLER_ROLE, SETTLER_ADDRESS);
  await grantRoleTx.wait();
  console.log("✅ SETTLER_ROLE granted to:", SETTLER_ADDRESS);

  // Save deployment info
  const deploymentInfo = {
    network: "BSC Mainnet",
    chainId: 56,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      userVaultImplementation: vaultImplementation.address,
      vaultFactory: vaultFactory.address,
      gameContract: gameContract.address,
    },
    configuration: {
      usdtAddress: USDT_ADDRESS,
      feeReceiver: FEE_RECEIVER,
      settlerAddress: SETTLER_ADDRESS,
    },
    verification: {
      userVaultImplementation: `https://bscscan.com/address/${vaultImplementation.address}`,
      vaultFactory: `https://bscscan.com/address/${vaultFactory.address}`,
      gameContract: `https://bscscan.com/address/${gameContract.address}`,
    },
  };

  const outputPath = path.join(__dirname, "../deployments/bsc-mainnet.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📄 Deployment info saved to:", outputPath);
  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Contract Addresses:");
  console.log("  UserVault Implementation:", vaultImplementation.address);
  console.log("  VaultFactory:", vaultFactory.address);
  console.log("  SekaSvaraGame:", gameContract.address);
  console.log("\n🔍 Verify contracts on BSCScan:");
  console.log("  npx hardhat verify --network bscMainnet", vaultImplementation.address);
  console.log("  npx hardhat verify --network bscMainnet", vaultFactory.address, USDT_ADDRESS, FEE_RECEIVER);
  console.log("  npx hardhat verify --network bscMainnet", gameContract.address, USDT_ADDRESS, vaultFactory.address, FEE_RECEIVER);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

