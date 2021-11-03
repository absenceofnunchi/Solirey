// SPDX-License-Identifier: MIT
// pragma solidity >=0.4.22 <0.7.0;
pragma solidity ^0.8.0;

import "../../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../node_modules/@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract IndividualAuction is IERC721Receiver {
    // Parameters of the auction. Times are either
    // absolute unix timestamps (seconds since 1970-01-01)
    // or time periods in seconds.
    address payable public beneficiary;
    uint public auctionEndTime;
    uint256 public tokenId;
    ERC721 nftContract;
    uint public startingBid;
    bool tokenAdded;
    address payable broker;

    // Current state of the auction.
    address public highestBidder;
    uint public highestBid;

    // Allowed withdrawals of previous bids
    mapping(address => uint) public pendingReturns;

    // Set to true at the end, disallows any change.
    // By default initialized to `false`.
    bool public ended;

    // Events that will be emitted on changes.
    event HighestBidIncreased(address bidder, uint amount);
    event AuctionEnded(address winner, uint amount);

    // The following is a so-called natspec comment,
    // recognizable by the three slashes.
    // It will be shown when the user is asked to
    // confirm a transaction.

    /// Create a simple auction with `_biddingTime`
    /// seconds bidding time on behalf of the
    /// beneficiary address `_beneficiary`.
    constructor(
        uint _biddingTime,
        uint _startingBid,
        address _artist
    ) payable {
        beneficiary = payable(msg.sender);
        auctionEndTime = block.timestamp + _biddingTime;
        highestBidder = address(0);
        startingBid = _startingBid;
    }

    /// Bid on the auction with the value sent
    /// together with this transaction.
    /// The value will only be refunded if the
    /// auction is not won.
    function bid() public payable {
        require(
            tokenAdded == true,
            "Token must be added first."
        );

        require(
            block.timestamp <= auctionEndTime,
            "Auction already ended."
        );

        require(
            msg.value > highestBid,
            "Higher bid already exists."
        );
        
        require(
            msg.value > startingBid,
            "The bid has to be higher than the specified starting bid."
        );
        
        require(
            msg.sender != beneficiary,
            "You cannot bid on your own auction."
        );

        if (highestBid != 0) {
            pendingReturns[highestBidder] += highestBid;
        }
        
        highestBidder = msg.sender;
        highestBid = msg.value;
        emit HighestBidIncreased(msg.sender, msg.value);
    }

    function withdraw() public returns (bool) {
        uint amount = pendingReturns[msg.sender];
        if (amount > 0) {
            
            pendingReturns[msg.sender] = 0;

            if (!payable(msg.sender).send(amount)) {
                // No need to call throw here, just reset the amount owing
                pendingReturns[msg.sender] = amount;
                return false;
            }
        }
        return true;
    }

    function auctionEnd() public {
        require(block.timestamp >= auctionEndTime, "Auction has not yet ended.");
        require(ended == false, "Auction has already been ended.");

        ended = true;
        emit AuctionEnded(highestBidder, highestBid);
    }
    
    function getTheHighestBid() public {
        require(block.timestamp >= auctionEndTime, "Auction bidding time has not expired.");
        require(ended, "Auction has not yet ended.");
        require(msg.sender == beneficiary, "You are not the beneficiary");
        
        beneficiary.transfer(highestBid);
    }
    
    function transferToken() public {
        require(block.timestamp >= auctionEndTime, "Bidding time has not expired.");
        require(ended, "Auction has not yet ended.");
        
        if (highestBidder == address(0)) {
            highestBidder = beneficiary;
        }
        
        require(msg.sender == highestBidder, "You are not the highest bidder");

        nftContract.safeTransferFrom(address(this), highestBidder, tokenId);
    }
    
    // function onERC721Received(address, address _from, uint256 _tokenId, bytes calldata) external override returns(bytes4) {
    //     require(beneficiary == _from, "Only the beneficiary can transfer the token into the auction.");
    //     require(tokenAdded == false, "The auction already has a token.");
        
    //     nftContract = ERC721(msg.sender);
    //     tokenId = _tokenId;
    //     tokenAdded = true;

    //     return 0x150b7a02;
    // }
    
    function onERC721Received(address, address, uint256 _tokenId, bytes memory) public virtual override returns (bytes4) {
        require(beneficiary == tx.origin, "Only the beneficiary can transfer the token into the auction.");
        require(tokenAdded == false, "The auction already has a token.");
        
        nftContract = ERC721(msg.sender);
        tokenId = _tokenId;
        tokenAdded = true;
        return this.onERC721Received.selector;
    }
}