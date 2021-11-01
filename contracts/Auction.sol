// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Solirey.sol";

contract Auction is Solirey {
    struct AuctionInfo {
        address payable beneficiary;
        // Parameters of the auction. Times are either
        // absolute unix timestamps (seconds since 1970-01-01)
        // or time periods in seconds.
        uint auctionEndTime;
        uint startingBid;
        uint256 tokenId;
        // Current state of the auction.
        address highestBidder;
        uint highestBid;
        // Allowed withdrawals of previous bids
        mapping(address => uint) pendingReturns;
        // Set to true at the end, disallows any change.
        bool ended;
        bool transferred;
    }
    
    using Counters for Counters.Counter;

    // mapping from item ID to AuctionInfo
    mapping(uint => AuctionInfo) public _auctionInfo;

    // Events that will be emitted on changes.
    event AuctionCreated(uint id);
    event HighestBidIncreased(uint id, address bidder, uint amount);
    event AuctionEnded(uint id);

    function createAuction(uint _biddingTime, uint _startingBid) public {
        uid++;

        emit AuctionCreated(uid);

        _tokenIds.increment();

        uint256 newTokenId = _tokenIds.current();
        _mint(address(this), newTokenId);

        _auctionInfo[uid].tokenId = newTokenId;
        _auctionInfo[uid].beneficiary = payable(msg.sender);
        _auctionInfo[uid].auctionEndTime = block.timestamp + _biddingTime;
        // _auctionInfo[uid].highestBidder = address(0);
        _auctionInfo[uid].startingBid = _startingBid;                        
    }
    
    function resell(uint _biddingTime, uint _startingBid, uint256 tokenId) public {
        require(
            ownerOf(tokenId) == msg.sender,
            "Not authorized"
        );

        uid++;

        emit AuctionCreated(uid);
        
        transferFrom(msg.sender, address(this), tokenId);
        
        _auctionInfo[uid].tokenId = tokenId;
        _auctionInfo[uid].beneficiary = payable(msg.sender);
        _auctionInfo[uid].auctionEndTime = block.timestamp + _biddingTime;
        _auctionInfo[uid].highestBidder = address(0);
        _auctionInfo[uid].startingBid = _startingBid;
    }
    
    function abort(uint id) public {
        require(
            msg.sender == _auctionInfo[id].beneficiary, 
            "Not authorized"
        );
        
        require(
            _auctionInfo[id].highestBidder == address(0),
            "Cannot abort"
        );
        
        require(
            _auctionInfo[id].highestBid == 0,
            "Cannot abort"
        );
        
        require(
            block.timestamp <= _auctionInfo[id].auctionEndTime,
            "Auction already ended"
        );
        
        require(
            _auctionInfo[id].ended == false,
            "The auction has ended"
        );
        
        _auctionInfo[id].ended = true;
        
        _transfer(address(this), _auctionInfo[id].beneficiary, _auctionInfo[id].tokenId);
    }

    /// Bid on the auction with the value sent
    /// The value will only be refunded if the auction is not won.
    function bid(uint id) public payable {
        require(
            block.timestamp <= _auctionInfo[id].auctionEndTime,
            "Auction already ended"
        );

        // To prevent bidding on an aborted auction.
        require(
            _auctionInfo[id].ended == false, 
            "Auction already ended"
        );

        require(
            msg.value > _auctionInfo[id].highestBid,
            "Higher bid already exists"
        );
        
        require(
            msg.value > _auctionInfo[id].startingBid,
            "The bid has to be higher than the specified starting bid"
        );

        if (_auctionInfo[id].highestBid != 0) {
            _auctionInfo[id].pendingReturns[_auctionInfo[id].highestBidder] += _auctionInfo[id].highestBid;
        }
        
        _auctionInfo[id].highestBidder = msg.sender;
        _auctionInfo[id].highestBid = msg.value;
        emit HighestBidIncreased(id, msg.sender, msg.value);
    }

    function withdraw(uint id) public returns (bool) {
        uint amount = _auctionInfo[id].pendingReturns[msg.sender];
        
        if (amount > 0) {
            _auctionInfo[id].pendingReturns[msg.sender] = 0;

            if (!payable(msg.sender).send(amount)) {
                // No need to call throw here, just reset the amount owing
                _auctionInfo[id].pendingReturns[msg.sender] = amount;
                return false;
            }
        }
        return true;
    }

    function auctionEnd(uint id) public {
        require(block.timestamp >= _auctionInfo[id].auctionEndTime, "Auction has not yet ended");
        require(_auctionInfo[id].ended == false, "auctionEnd has already been called");

        _auctionInfo[id].ended = true;
        
        _transfer(address(this), _auctionInfo[id].highestBidder, _auctionInfo[id].tokenId);
        
        emit AuctionEnded(id);
    }
    
    function getTheHighestBid(uint id) public payable {
        require(block.timestamp >= _auctionInfo[id].auctionEndTime, "Auction bidding time has not expired");
        require(msg.sender == _auctionInfo[id].beneficiary, "You are not the beneficiary");
        require(_auctionInfo[id].transferred == false, "Already transferred");
        
        _auctionInfo[id].transferred = true;

        uint fee = _auctionInfo[id].highestBid * 2 / 100;
        uint payment = _auctionInfo[id].highestBid - (fee * 2);

        address artist = _artist[_auctionInfo[id].tokenId];
        payable(artist).transfer(fee);    

        admin.transfer(fee);
        _auctionInfo[id].beneficiary.transfer(payment);
    }
 
    // for testing only 
    function getAdmin() public view returns (address) {
        return admin;
    }

    function getAuctionInfo(uint id) public view returns (address beneficiary, uint auctionEndTime, uint startingBid, uint256 tokenId, address highestBidder, uint highestBid, bool ended) {
        return (_auctionInfo[id].beneficiary, _auctionInfo[id].auctionEndTime, _auctionInfo[id].startingBid, _auctionInfo[id].tokenId, _auctionInfo[id].highestBidder, _auctionInfo[id].highestBid, _auctionInfo[id].ended);
    }

    function getPendingReturn(uint id, address bidder) public view returns (uint) {
        return _auctionInfo[id].pendingReturns[bidder];
    }
}