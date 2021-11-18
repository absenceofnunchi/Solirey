// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../node_modules/@openzeppelin/contracts/utils/Counters.sol";

contract Solirey is ERC721 {
    using Counters for Counters.Counter;
    Counters.Counter internal _tokenIds;
    address payable internal admin; 
    // The original artist: token ID to the artist address
    mapping (uint256 => address) public _artist;
    uint uid;

    constructor() ERC721("Solirey", "SREY") {
        admin = payable(msg.sender);
    }
}

contract Old {
    function f1() external pure {

    }
}

contract New {
    Old OLD; // Intitilize old contract variable (empty)

    /**
    * Set the address for Old contract (We call this function and enter the address of the OLD contract)
    */
    function setOldContractAddress(address addr) public {
        OLD = Old(addr);
    }

    /**
    * Function that allows us to call f1() from the Old contract
    */
    function callOLDcontract() public view {
        OLD.f1();
    }
}