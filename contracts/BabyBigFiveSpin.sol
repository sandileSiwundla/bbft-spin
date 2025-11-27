// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

interface IBBFT {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256); // Added this line
}

contract BabyBigFiveSpin is VRFConsumerBaseV2Plus {
    IBBFT public bbftToken;

    // Chainlink VRF V2+ variables
    bytes32 public keyHash = 0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314;
    uint32 public callbackGasLimit = 2500000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;
    uint256 public s_subscriptionId;
    
    uint256 public SPIN_COST = 1 * 1e18; // Fixed: 1 BBFT token (18 decimals)
    uint256 public constant WIN_RATIO = 40;
    uint256 public constant WIN_MULTIPLIER = 150;
    
    uint256 public totalSpins;
    uint256 public totalWins;
    uint256 public totalLosses;
    uint256 public totalPayouts;
    
    mapping(address => uint256) public playerSpins;
    mapping(address => uint256) public playerWins;
    mapping(address => uint256) public playerLosses;
    mapping(address => uint256) public playerPayouts;
    
    mapping(uint256 => address) public requestToPlayer;
    mapping(uint256 => bool) public requestFulfilled;
    mapping(uint256 => bool) public requestWon;
    mapping(uint256 => uint256) public requestWinAmount;

    event SpinRequested(address indexed player, uint256 requestId, uint256 paidAmount);
    event SpinResult(address indexed player, bool won, uint256 amountWon, uint256 spinNumber, uint256 requestId);
    event TokensDeposited(address indexed from, uint256 amount);
    event TokensWithdrawn(address indexed to, uint256 amount);
    event SubscriptionIdUpdated(uint256 newSubscriptionId);
    event SpinCostUpdated(uint256 newSpinCost);
    
    constructor(
        address _bbftToken,
        address _vrfCoordinator,
        uint256 _subscriptionId
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        bbftToken = IBBFT(_bbftToken);
        s_subscriptionId = _subscriptionId;
    }

    function setSpinCost(uint256 newCost) external onlyOwner {
        SPIN_COST = newCost;
        emit SpinCostUpdated(newCost);
    }
    
    function spin() external returns (uint256 requestId) {
        require(bbftToken.balanceOf(msg.sender) >= SPIN_COST, "Insufficient BBFT balance");
        require(bbftToken.allowance(msg.sender, address(this)) >= SPIN_COST, "Not enough allowance");
        
        require(bbftToken.transferFrom(msg.sender, address(this), SPIN_COST), "Token transfer failed");
        
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: s_subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: bytes("")
            })
        );
        
        requestToPlayer[requestId] = msg.sender;
        totalSpins++;
        playerSpins[msg.sender]++;
        
        emit SpinRequested(msg.sender, requestId, SPIN_COST);
        return requestId;
    }
    
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        require(!requestFulfilled[requestId], "Request already fulfilled");
        
        address player = requestToPlayer[requestId];
        require(player != address(0), "Invalid request ID");
        
        requestFulfilled[requestId] = true;
        
        uint256 randomNumber = randomWords[0];
        bool won;
        uint256 winAmount = 0;
        
        if ((randomNumber % 100) < WIN_RATIO) {
            won = true;
            winAmount = (SPIN_COST * WIN_MULTIPLIER) / 100;
            
            if (bbftToken.balanceOf(address(this)) >= winAmount) {
                require(bbftToken.transfer(player, winAmount), "Prize transfer failed");
                
                totalWins++;
                playerWins[player]++;
                totalPayouts += winAmount;
                playerPayouts[player] += winAmount;
            } else {
                won = false;
                totalLosses++;
                playerLosses[player]++;
            }
        } else {
            won = false;
            totalLosses++;
            playerLosses[player]++;
        }
        
        requestWon[requestId] = won;
        requestWinAmount[requestId] = winAmount;
        
        emit SpinResult(player, won, winAmount, totalSpins, requestId);
    }

    function getSpinResult(uint256 requestId) public view returns (bool won, uint256 winAmount) {
        require(requestFulfilled[requestId], "Result not ready yet");
        return (requestWon[requestId], requestWinAmount[requestId]);
    }

    function isRequestFulfilled(uint256 requestId) public view returns (bool) {
        return requestFulfilled[requestId];
    }

    function getRequestPlayer(uint256 requestId) public view returns (address) {
        return requestToPlayer[requestId];
    }

    function setKeyHash(bytes32 newKeyHash) external onlyOwner {
        keyHash = newKeyHash;
    }

    function setCallbackGasLimit(uint32 newCallbackGasLimit) external onlyOwner {
        callbackGasLimit = newCallbackGasLimit;
    }

    function setSubscriptionId(uint256 _subscriptionId) external onlyOwner {
        require(_subscriptionId != s_subscriptionId, "Same as current");
        s_subscriptionId = _subscriptionId;
        emit SubscriptionIdUpdated(_subscriptionId);
    }

    function getContractBalance() public view returns (uint256) {
        return bbftToken.balanceOf(address(this));
    }

    function getPlayerStats(address player) public view returns (
        uint256 spins,
        uint256 wins,
        uint256 losses,
        uint256 payouts,
        int256 profitLoss,
        uint256 winPercentage,
        uint256 availableSpins
    ) {
        spins = playerSpins[player];
        wins = playerWins[player];
        losses = playerLosses[player];
        payouts = playerPayouts[player];
        profitLoss = int256(payouts) - int256(spins * SPIN_COST);
        winPercentage = spins > 0 ? (wins * 100) / spins : 0;
        availableSpins = bbftToken.balanceOf(player) / SPIN_COST;
    }
    
    function depositTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Must deposit some tokens");
        require(bbftToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit TokensDeposited(msg.sender, amount);
    }
    
    function withdrawTokens(uint256 amount) external onlyOwner {
        require(amount <= getContractBalance(), "Insufficient contract balance");
        require(bbftToken.transfer(owner(), amount), "Transfer failed");
        emit TokensWithdrawn(owner(), amount);
    }
}