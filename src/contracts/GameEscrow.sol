// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GameEscrow
 * @dev Escrow contract for Seka Svara game betting
 * Holds USDT until game winner is determined
 */
contract GameEscrow is ReentrancyGuard, Ownable {
    IERC20 public usdtToken;
    
    struct Game {
        uint256 totalPot;
        address[] players;
        mapping(address => uint256) deposits;
        address winner;
        bool isActive;
        bool isCompleted;
        uint256 createdAt;
    }
    
    mapping(bytes32 => Game) public games;
    uint256 public platformFeePercent = 5; // 5% platform fee
    address public platformWallet;
    
    event GameCreated(bytes32 indexed gameId, address[] players, uint256 totalPot);
    event DepositMade(bytes32 indexed gameId, address player, uint256 amount);
    event GameCompleted(bytes32 indexed gameId, address winner, uint256 payout);
    event GameCancelled(bytes32 indexed gameId);
    
    constructor(address _usdtToken, address _platformWallet) {
        usdtToken = IERC20(_usdtToken);
        platformWallet = _platformWallet;
    }
    
    /**
     * @dev Create a new game escrow
     * @param gameId Unique game identifier
     * @param players Array of player addresses
     */
    function createGame(bytes32 gameId, address[] memory players) external onlyOwner {
        require(!games[gameId].isActive, "Game already exists");
        require(players.length >= 2 && players.length <= 6, "Invalid number of players");
        
        Game storage game = games[gameId];
        game.players = players;
        game.isActive = true;
        game.createdAt = block.timestamp;
        
        emit GameCreated(gameId, players, 0);
    }
    
    /**
     * @dev Player deposits USDT into escrow
     * @param gameId Game identifier
     * @param amount Amount to deposit
     */
    function deposit(bytes32 gameId, uint256 amount) external nonReentrant {
        Game storage game = games[gameId];
        require(game.isActive, "Game not active");
        require(!game.isCompleted, "Game already completed");
        require(isPlayer(gameId, msg.sender), "Not a player in this game");
        
        require(usdtToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        game.deposits[msg.sender] += amount;
        game.totalPot += amount;
        
        emit DepositMade(gameId, msg.sender, amount);
    }
    
    /**
     * @dev Complete game and release funds to winner
     * @param gameId Game identifier
     * @param winner Winner address
     */
    function completeGame(bytes32 gameId, address winner) external onlyOwner nonReentrant {
        Game storage game = games[gameId];
        require(game.isActive, "Game not active");
        require(!game.isCompleted, "Game already completed");
        require(isPlayer(gameId, winner), "Winner not in game");
        
        uint256 platformFee = (game.totalPot * platformFeePercent) / 100;
        uint256 winnerPayout = game.totalPot - platformFee;
        
        game.winner = winner;
        game.isCompleted = true;
        game.isActive = false;
        
        require(usdtToken.transfer(platformWallet, platformFee), "Platform fee transfer failed");
        require(usdtToken.transfer(winner, winnerPayout), "Winner payout failed");
        
        emit GameCompleted(gameId, winner, winnerPayout);
    }
    
    /**
     * @dev Cancel game and refund all players
     * @param gameId Game identifier
     */
    function cancelGame(bytes32 gameId) external onlyOwner nonReentrant {
        Game storage game = games[gameId];
        require(game.isActive, "Game not active");
        require(!game.isCompleted, "Game already completed");
        
        for (uint i = 0; i < game.players.length; i++) {
            address player = game.players[i];
            uint256 depositAmount = game.deposits[player];
            
            if (depositAmount > 0) {
                game.deposits[player] = 0;
                require(usdtToken.transfer(player, depositAmount), "Refund failed");
            }
        }
        
        game.isActive = false;
        game.isCompleted = true;
        
        emit GameCancelled(gameId);
    }
    
    /**
     * @dev Check if address is a player in the game
     */
    function isPlayer(bytes32 gameId, address addr) public view returns (bool) {
        Game storage game = games[gameId];
        for (uint i = 0; i < game.players.length; i++) {
            if (game.players[i] == addr) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Update platform fee percentage
     */
    function setPlatformFee(uint256 _feePercent) external onlyOwner {
        require(_feePercent <= 10, "Fee too high");
        platformFeePercent = _feePercent;
    }
    
    /**
     * @dev Update platform wallet
     */
    function setPlatformWallet(address _platformWallet) external onlyOwner {
        platformWallet = _platformWallet;
    }
}

