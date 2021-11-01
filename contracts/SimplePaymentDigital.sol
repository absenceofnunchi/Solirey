// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Solirey.sol";

contract SimplePaymentDigital is Solirey {
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
    
    // modifier onlySeller(uint id) {
    //     require(
    //         msg.sender == buyer,
    //         "Only buyer can call this."
    //     );
    //     _;
    // }

    function createPayment(uint price) public {
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

    function abort(uint id) public {
        Payment memory sp = _simplePayment[id];
        require(msg.sender == sp.seller, "Unauthorized");
        require(sp.price != 0, "Not for sale");
        require(sp.payment == 0, "Already purchased");
        
        _transfer(address(this), sp.seller, sp.tokenId);
    }

    function resell(uint price, uint256 tokenId) public {
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
    
    // id is the posting identifier
    function pay(uint id) public payable {
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
    
    function withdraw(uint id) public {
        Payment memory sp = _simplePayment[id];

        require(msg.sender == sp.seller, "Not authorized");
        require(sp.payment != 0, "Not authorized");

        _simplePayment[id].payment = 0;
        
        payable(_artist[sp.tokenId]).transfer(sp.fee);
        payable(msg.sender).transfer(sp.payment);
    }
    
    function withdrawFee(uint id) public {
        require(
            admin == msg.sender,
            "Not authorized"
        );
        
        admin.transfer(_simplePayment[id].fee);
    }
}