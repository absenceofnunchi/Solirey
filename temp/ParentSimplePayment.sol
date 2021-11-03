// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Solirey.sol";

contract ParentSimplePayment is Solirey {
    struct Payment {
        uint payment;
        uint price;
        uint fee;
        uint256 tokenId;
        address seller;
    }
    
    using Counters for Counters.Counter;
    
    // Maps from a item ID to Payment
    mapping (uint => Payment) public _simplePayment;
    
    // // Maps from a tokenID to bool to indicate whether a token is currently on sale
    // // This is to prevent a token to be listed for sale only one instance at a time.
    // mapping (uint256 => bool) public _forSale;
    
    event CreatePayment(uint id);
    event PaymentMade(uint id);

    function abort(uint id) external {
        Payment memory sp = _simplePayment[id];
        require(msg.sender == sp.seller, "Unauthorized");
        require(sp.price != 0, "Not for sale");
        require(sp.payment == 0, "Already purchased");
        
        _transfer(address(this), sp.seller, sp.tokenId);
    }

    function resell(uint price, uint256 tokenId) external {
        require(
            price > 0,
            "Wrong pricing"
        );

        transferFrom(msg.sender, address(this), tokenId);

        uid++;
        emit CreatePayment(uid);

        // _forSale[tokenId] = true;
        _simplePayment[uid].price = price;
        _simplePayment[uid].tokenId = tokenId;
        _simplePayment[uid].seller = msg.sender;
    }

    function withdrawFee(uint id) external {
        require(
            admin == msg.sender,
            "Not authorized"
        );
        
        admin.transfer(_simplePayment[id].fee);
    }
}