// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./UserVault.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title VaultFactory
 * @dev Factory contract that creates per-user vaults using minimal proxy pattern (CREATE2)
 * Each user gets a unique, deterministic vault address
 */
contract VaultFactory is Ownable, Pausable {
    using Clones for address;
    
    address public immutable vaultImplementation; // Implementation contract for minimal proxies
    address public immutable USDTToken;
    address public gameContract; // Game contract address
    address public feeReceiver; // Fee receiver address
    
    mapping(address => address) public userVaults; // user => vault address
    mapping(address => address) public vaultUsers; // vault => user address
    address[] public allVaults; // All created vaults
    
    event VaultCreated(address indexed user, address indexed vault, uint256 timestamp);
    event GameContractUpdated(address oldContract, address newContract);
    event FeeReceiverUpdated(address oldReceiver, address newReceiver);
    
    constructor(address _USDTToken, address _feeReceiver) {
        USDTToken = _USDTToken;
        feeReceiver = _feeReceiver;
        
        // Deploy implementation contract
        UserVault implementation = new UserVault(_USDTToken, address(0), address(this));
        vaultImplementation = address(implementation);
    }
    
    /**
     * @dev Get or create user vault (CREATE2 deterministic address)
     * @param user User address
     * @return vaultAddress The user's vault address
     */
    function getOrCreateVault(address user) external returns (address vaultAddress) {
        require(user != address(0), "Invalid user address");
        require(!paused(), "Contract is paused");
        
        // Check if vault already exists
        if (userVaults[user] != address(0)) {
            return userVaults[user];
        }
        
        // Create deterministic address using CREATE2
        bytes32 salt = keccak256(abi.encodePacked(user));
        vaultAddress = Clones.cloneDeterministic(vaultImplementation, salt);
        
        // Initialize vault
        UserVault(vaultAddress).initialize(USDTToken, user, address(this));
        
        // Grant game role if game contract is set
        if (gameContract != address(0)) {
            UserVault(vaultAddress).grantGameRole(gameContract);
        }
        
        userVaults[user] = vaultAddress;
        vaultUsers[vaultAddress] = user;
        allVaults.push(vaultAddress);
        
        emit VaultCreated(user, vaultAddress, block.timestamp);
        
        return vaultAddress;
    }
    
    /**
     * @dev Get user vault address (view function, doesn't create)
     * @param user User address
     * @return vaultAddress The user's vault address (0 if not created)
     */
    function getUserVault(address user) external view returns (address vaultAddress) {
        if (userVaults[user] != address(0)) {
            return userVaults[user];
        }
        
        // Calculate deterministic address without creating
        bytes32 salt = keccak256(abi.encodePacked(user));
        vaultAddress = Clones.predictDeterministicAddress(vaultImplementation, salt);
        return vaultAddress;
    }
    
    /**
     * @dev Set game contract address
     * @param _gameContract Game contract address
     */
    function setGameContract(address _gameContract) external onlyOwner {
        address oldContract = gameContract;
        gameContract = _gameContract;
        
        // Grant game role to all existing vaults
        for (uint256 i = 0; i < allVaults.length; i++) {
            if (oldContract != address(0)) {
                UserVault(allVaults[i]).revokeGameRole(oldContract);
            }
            if (_gameContract != address(0)) {
                UserVault(allVaults[i]).grantGameRole(_gameContract);
            }
        }
        
        emit GameContractUpdated(oldContract, _gameContract);
    }
    
    /**
     * @dev Set fee receiver address
     * @param _feeReceiver Fee receiver address
     */
    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        address oldReceiver = feeReceiver;
        feeReceiver = _feeReceiver;
        emit FeeReceiverUpdated(oldReceiver, _feeReceiver);
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Get total number of vaults
     * @return Total vault count
     */
    function getVaultCount() external view returns (uint256) {
        return allVaults.length;
    }
}

