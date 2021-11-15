const Auction = artifacts.require("IndividualAuction");
const mintContract = artifacts.require("MintContract")
const helper = require("./helpers/truffleTestHelper");
const { toBN } = web3.utils;

contract("Abort Individual Auction", (accounts) => {
    let auctionInstance, startingBidInput, initialTokenId, admin, auctionDeployer, firstBidder, secondBidder, finalBidder, adminFee;
    before(async () => {
        initialTokenId = 1;

        admin = accounts[0]
        auctionDeployer = accounts[5]
        firstBidder = accounts[6]
        adminFee = 2

        startingBidInput = web3.utils.toWei("1", "ether");
        auctionInstance = await Auction.deployed(200, startingBidInput, { from: auctionDeployer });
        mintContractInstance = await mintContract.deployed({ from: admin })
    })

    it("deploys the contract and initializes 5 variables", async () => {
        const beneficiary = await auctionInstance.beneficiary.call();
        const auctionEndTime = await auctionInstance.auctionEndTime.call();
        const highestBidder = await auctionInstance.highestBidder.call();
        const startingBid = await auctionInstance.startingBid.call();
        const ended = await auctionInstance.ended.call();
    
        assert.equal(beneficiary, auctionDeployer, "The beneficiary is not the contract deployer.");
        assert.isNotNull(auctionEndTime, "The auction end time is incorrect.");
        assert.equal(highestBidder, 0, "The highest bidder account is not empty.");
        assert.equal(startingBid, startingBidInput, "The starting bid is incorrect.");
        assert.equal(ended, false, "The ended variable is incorrect");
    });

    it("Unsuccessfully abort", async () => {
        // Successfully transfer a token into the auction contract
        try {
            await mintContractInstance.mintNft(auctionInstance.address, { from: auctionDeployer })
        } catch (error) {
            console.log("error", error)
        }

        const tokenId = await auctionInstance.tokenId.call();
        const beneficiary = await auctionInstance.beneficiary.call();
    
        assert.equal(tokenId.toNumber(), 1, "The token ID is incorrect.");
        assert.equal(beneficiary, auctionDeployer, "Only the beneficiary can transfer the token");

        try {
            await auctionInstance.abort({ from: firstBidder })
        } catch (error) {
            assert.equal(error.reason, "Not authorized")
        }

        const owner = await mintContractInstance.ownerOf(tokenId)
        
        assert.equal(tokenId.toNumber(), 1, "The token ID is incorrect.");
        assert.equal(owner, auctionInstance.address, "Incorrect owner");
    })

    it("Successfully abort", async () => {
        try {
            await auctionInstance.abort({ from: auctionDeployer })
        } catch (error) {
            console.log(error);
        }

        const tokenId = await auctionInstance.tokenId.call();
        const owner = await mintContractInstance.ownerOf(tokenId)
        
        assert.equal(tokenId.toNumber(), 1, "The token ID is incorrect.");
        assert.equal(owner, auctionDeployer, "Incorrect owner");

        const advancement = 600;
        await helper.advanceTimeAndBlock(advancement);

        try {
            await auctionInstance.abort({ from: auctionDeployer })
        } catch (error) {
            assert.equal(error.reason, "Auction already expired")
        }
    })
})