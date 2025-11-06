// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title UserVault
 * @dev Per-user vault contract for deposits and withdrawals
 * Each user has their own vault address with segregated funds
 */
contract UserVault is ReentrancyGuard, AccessControl, Initializable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    
    IERC20 public USDTToken;
    address public userAddress; // The user who owns this vault
    address public factory; // Factory that created this vault
    
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public totalWagered; // On-chain game volume tracking
    uint256 public playthroughMultiplier; // Configurable playthrough (default 0 = no requirement)
    
    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Withdraw(address indexed user, uint256 amount, uint256 timestamp);
    event BetPlaced(address indexed user, uint256 amount, bytes32 indexed gameId);
    event GameSettled(address indexed user, uint256 winnings, bytes32 indexed gameId);
    event PlaythroughUpdated(uint256 oldMultiplier, uint256 newMultiplier);
    
    bool private initialized;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Disable initialization in implementation contract
        _disableInitializers();
    }
    
    /**
     * @dev Initialize vault (called by factory)
     * @param _USDTToken USDT token address
     * @param _userAddress User address
     * @param _factory Factory address
     */
    function initialize(address _USDTToken, address _userAddress, address _factory) external {
        require(!initialized, "Already initialized");
        initialized = true;
        
        USDTToken = IERC20(_USDTToken);
        userAddress = _userAddress;
        factory = _factory;
        playthroughMultiplier = 0; // Default: no playthrough requirement
        
        _grantRole(DEFAULT_ADMIN_ROLE, _factory);
        _grantRole(ADMIN_ROLE, _factory);
    }
    
    /**
     * @dev Deposit USDT into user's vault
     * @param amount Amount to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(USDTToken.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        USDTToken.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        
        emit Deposit(userAddress, amount, block.timestamp);
    }
    
    /**
     * @dev Withdraw USDT from user's vault (automatic, no approval needed)
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(msg.sender == userAddress, "Only vault owner can withdraw");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 availableBalance = getAvailableBalance();
        require(availableBalance >= amount, "Insufficient available balance");
        
        totalWithdrawn += amount;
        USDTToken.safeTransfer(userAddress, amount);
        
        emit Withdraw(userAddress, amount, block.timestamp);
    }
    
    /**
     * @dev Place a bet (called by game contract)
     * @param amount Bet amount
     * @param gameId Game identifier
     */
    function placeBet(uint256 amount, bytes32 gameId) external onlyRole(GAME_ROLE) nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(USDTToken.balanceOf(address(this)) >= amount, "Insufficient vault balance");
        
        totalWagered += amount;
        emit BetPlaced(userAddress, amount, gameId);
    }
    
    /**
     * @dev Settle game (called by game contract)
     * @param winnings Winnings amount (can be 0 if lost)
     * @param gameId Game identifier
     */
    function settle(uint256 winnings, bytes32 gameId) external onlyRole(GAME_ROLE) nonReentrant {
        if (winnings > 0) {
            // Winnings are added to vault balance (already in contract from game settlement)
            emit GameSettled(userAddress, winnings, gameId);
        }
    }
    
    /**
     * @dev Get available balance (considering playthrough requirement)
     * @return Available balance for withdrawal
     */
    function getAvailableBalance() public view returns (uint256) {
        uint256 currentBalance = USDTToken.balanceOf(address(this));
        
        // If playthrough is 0, all balance is available
        if (playthroughMultiplier == 0) {
            return currentBalance;
        }
        
        // Calculate required wagering: (totalDeposited - totalWithdrawn) * playthroughMultiplier
        uint256 netDeposited = totalDeposited - totalWithdrawn;
        uint256 requiredWagering = netDeposited * playthroughMultiplier / 100;
        
        // If wagering requirement met, all balance available
        if (totalWagered >= requiredWagering) {
            return currentBalance;
        }
        
        // Otherwise, calculate available based on wagering progress
        uint256 wageringProgress = totalWagered * 100 / requiredWagering;
        return currentBalance * wageringProgress / 100;
    }
    
    /**
     * @dev Get user's turnover (total wagered)
     * @return Total amount wagered
     */
    function turnover() external view returns (uint256) {
        return totalWagered;
    }
    
    /**
     * @dev Update playthrough multiplier (only admin)
     * @param newMultiplier New playthrough multiplier (0 = no requirement, 130 = 1.3x)
     */
    function setPlaythroughMultiplier(uint256 newMultiplier) external onlyRole(ADMIN_ROLE) {
        require(newMultiplier <= 500, "Playthrough cannot exceed 5x");
        uint256 oldMultiplier = playthroughMultiplier;
        playthroughMultiplier = newMultiplier;
        emit PlaythroughUpdated(oldMultiplier, newMultiplier);
    }
    
    /**
     * @dev Grant game role to game contract
     */
    function grantGameRole(address gameContract) external onlyRole(ADMIN_ROLE) {
        _grantRole(GAME_ROLE, gameContract);
    }
    
    /**
     * @dev Revoke game role from game contract
     */
    function revokeGameRole(address gameContract) external onlyRole(ADMIN_ROLE) {
        _revokeRole(GAME_ROLE, gameContract);
    }
}

