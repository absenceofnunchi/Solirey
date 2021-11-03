// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../node_modules/@openzeppelin/contracts/utils/Counters.sol";

contract Solirey is ERC721 {
    using Counters for Counters.Counter;
    Counters.Counter internal _tokenIds;
    address payable internal admin; 
    // The original artist
    mapping (uint256 => address) public _artist;
    uint uid;

    constructor() ERC721("Solirey", "SREY") {
        admin = payable(msg.sender);
    }
}