// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ParentSimplePayment.sol";

contract SimplePaymentDigital is ParentSimplePayment {
    using Counters for Counters.Counter;

    function createPayment(uint price) external {
        require(price > 0, "Wrong price");

        uid++;

        emit CreatePayment(uid);
        
        _tokenIds.increment();

        uint256 newTokenId = _tokenIds.current();
        _mint(address(this), newTokenId);
        
        // _forSale[newTokenId] = true;

        _simplePayment[uid].price = price;
        _simplePayment[uid].tokenId = newTokenId;
        _simplePayment[uid].seller = msg.sender;

        _artist[newTokenId] = msg.sender;
    }

    // id is the posting identifier
    function pay(uint id) external payable {
        Payment memory sp = _simplePayment[id];

        require(  
            sp.price != 0,
            "Not for sale"
        );

        require(
            msg.value == sp.price,
            "Incorrect price"
        );   
        
        // make a payment for the seller to withdraw
        uint _fee = msg.value * 2 / 100;
       sp.payment = msg.value - _fee - _fee;
       sp.fee = _fee;
        
        // not for sale anymore
        sp.price = 0; 

        // transfer the token
        uint256 tokenId = sp.tokenId;
        _transfer(address(this), msg.sender, tokenId);
        
        _simplePayment[id] = sp;

        emit PaymentMade(id);
    }
    
    function withdraw(uint id) external {
        Payment memory sp = _simplePayment[id];

        require(msg.sender == sp.seller, "Not authorized");
        require(sp.payment != 0, "Not authorized");

        _simplePayment[id].payment = 0;
        
        payable(_artist[sp.tokenId]).transfer(sp.fee);
        payable(msg.sender).transfer(sp.payment);
    }
}