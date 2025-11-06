// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./VaultFactory.sol";
import "./UserVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SekaSvaraGame
 * @dev Main game contract for Seka Svara betting and settlement
 * Handles game creation, betting, and automatic settlement
 */
contract SekaSvaraGame is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");
    
    VaultFactory public vaultFactory;
    IERC20 public USDTToken;
    address public feeReceiver;
    
    uint256 public platformFeePercent = 5; // 5% platform fee (configurable)
    
    struct Game {
        bytes32 gameId;
        address[] players;
        mapping(address => uint256) bets; // Player bet amounts
        mapping(address => bool) hasBet;
        uint256 totalPot;
        address winner;
        bool isActive;
        bool isSettled;
        uint256 createdAt;
    }
    
    mapping(bytes32 => Game) public games;
    bytes32[] public activeGames;
    
    event GameCreated(bytes32 indexed gameId, address[] players, uint256 timestamp);
    event BetPlaced(bytes32 indexed gameId, address indexed player, uint256 amount);
    event GameSettled(bytes32 indexed gameId, address indexed winner, uint256 payout, uint256 fee);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeReceiverUpdated(address oldReceiver, address newReceiver);
    
    constructor(address _USDTToken, address _vaultFactory, address _feeReceiver) {
        USDTToken = IERC20(_USDTToken);
        vaultFactory = VaultFactory(_vaultFactory);
        feeReceiver = _feeReceiver;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(SETTLER_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new game
     * @param gameId Unique game identifier
     * @param players Array of player addresses
     */
    function createGame(bytes32 gameId, address[] memory players) external onlyRole(ADMIN_ROLE) whenNotPaused {
        require(!games[gameId].isActive, "Game already exists");
        require(players.length >= 2 && players.length <= 6, "Invalid number of players");
        
        Game storage game = games[gameId];
        game.gameId = gameId;
        game.players = players;
        game.isActive = true;
        game.createdAt = block.timestamp;
        
        activeGames.push(gameId);
        
        emit GameCreated(gameId, players, block.timestamp);
    }
    
    /**
     * @dev Place a bet in a game
     * @param gameId Game identifier
     * @param amount Bet amount
     */
    function placeBet(bytes32 gameId, uint256 amount) external nonReentrant whenNotPaused {
        Game storage game = games[gameId];
        require(game.isActive, "Game not active");
        require(!game.isSettled, "Game already settled");
        
        // Check if player is in game
        bool isPlayer = false;
        for (uint256 i = 0; i < game.players.length; i++) {
            if (game.players[i] == msg.sender) {
                isPlayer = true;
                break;
            }
        }
        require(isPlayer, "Not a player in this game");
        
        // Get or create user vault
        address userVault = vaultFactory.getOrCreateVault(msg.sender);
        
        // Place bet from vault
        UserVault(userVault).placeBet(amount, gameId);
        
        // Transfer bet amount from vault to game contract
        IERC20(USDTToken).safeTransferFrom(userVault, address(this), amount);
        
        game.bets[msg.sender] += amount;
        game.hasBet[msg.sender] = true;
        game.totalPot += amount;
        
        emit BetPlaced(gameId, msg.sender, amount);
    }
    
    /**
     * @dev Settle game and distribute winnings
     * @param gameId Game identifier
     * @param winner Winner address
     */
    function settle(bytes32 gameId, address winner) external onlyRole(SETTLER_ROLE) nonReentrant {
        Game storage game = games[gameId];
        require(game.isActive, "Game not active");
        require(!game.isSettled, "Game already settled");
        
        // Verify winner is a player
        bool isPlayer = false;
        for (uint256 i = 0; i < game.players.length; i++) {
            if (game.players[i] == winner) {
                isPlayer = true;
                break;
            }
        }
        require(isPlayer, "Winner not in game");
        
        // Calculate fees and payout
        uint256 platformFee = (game.totalPot * platformFeePercent) / 100;
        uint256 winnerPayout = game.totalPot - platformFee;
        
        // Transfer platform fee
        if (platformFee > 0) {
            USDTToken.safeTransfer(feeReceiver, platformFee);
        }
        
        // Transfer winnings to winner's vault
        if (winnerPayout > 0) {
            address winnerVault = vaultFactory.getOrCreateVault(winner);
            USDTToken.safeTransfer(winnerVault, winnerPayout);
            UserVault(winnerVault).settle(winnerPayout, gameId);
        }
        
        game.winner = winner;
        game.isSettled = true;
        game.isActive = false;
        
        // Remove from active games
        for (uint256 i = 0; i < activeGames.length; i++) {
            if (activeGames[i] == gameId) {
                activeGames[i] = activeGames[activeGames.length - 1];
                activeGames.pop();
                break;
            }
        }
        
        emit GameSettled(gameId, winner, winnerPayout, platformFee);
    }
    
    /**
     * @dev Get user's turnover (total wagered)
     * @param user User address
     * @return Total amount wagered
     */
    function turnover(address user) external view returns (uint256) {
        address userVault = vaultFactory.getUserVault(user);
        if (userVault == address(0)) {
            return 0;
        }
        return UserVault(userVault).turnover();
    }
    
    /**
     * @dev Set platform fee percentage
     * @param newFee New fee percentage (e.g., 5 for 5%)
     */
    function setPlatformFee(uint256 newFee) external onlyRole(ADMIN_ROLE) {
        require(newFee <= 10, "Fee cannot exceed 10%");
        uint256 oldFee = platformFeePercent;
        platformFeePercent = newFee;
        emit PlatformFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Set fee receiver address
     * @param newReceiver New fee receiver address
     */
    function setFeeReceiver(address newReceiver) external onlyRole(ADMIN_ROLE) {
        require(newReceiver != address(0), "Invalid address");
        address oldReceiver = feeReceiver;
        feeReceiver = newReceiver;
        emit FeeReceiverUpdated(oldReceiver, newReceiver);
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Get game info
     * @param gameId Game identifier
     * @return totalPot Total pot amount
     * @return playerCount Number of players
     * @return winner Winner address
     * @return isActive Whether game is active
     * @return isSettled Whether game is settled
     */
    function getGameInfo(bytes32 gameId) external view returns (
        uint256 totalPot,
        uint256 playerCount,
        address winner,
        bool isActive,
        bool isSettled
    ) {
        Game storage game = games[gameId];
        return (
            game.totalPot,
            game.players.length,
            game.winner,
            game.isActive,
            game.isSettled
        );
    }
    
    /**
     * @dev Get player bet amount
     * @param gameId Game identifier
     * @param player Player address
     * @return Bet amount
     */
    function getPlayerBet(bytes32 gameId, address player) external view returns (uint256) {
        return games[gameId].bets[player];
    }
}

