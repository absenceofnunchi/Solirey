const auction = artifacts.require("Auction");
const solirey = artifacts.require("Solirey");
const helper = require("./helpers/truffleTestHelper");

contract("After Auction", (accounts) => {
    let contract, solireyContract, admin, initialSeller, initialId, initialBiddingTime, initialStartingBid, initialAuctionEndTime;
    before(async () => {
        admin = accounts[0];
        secondBuyer = accounts[2];
        contract = await auction.deployed({ from: admin });
        solireyContract = await solirey.deployed({ from: admin });

        initialSeller = accounts[3];
        initialBiddingTime = 100
        initialStartingBid = 100
    })

    it("Successfully create an auction.", async () => {
        // Successfully create an auction
        let result;
        try {
            // Calculate auction end time at the same time as the auction creat time
            let initialBiddingTimeInMilliSeconds = initialBiddingTime * 1000
            const timeObject = new Date(); 
            initialAuctionEndTime = new Date(timeObject.getTime() + initialBiddingTimeInMilliSeconds);

            result = await contract.createAuction(initialBiddingTime, initialStartingBid, { from: initialSeller });
        } catch (error) {
            console.log("error", error)
        }

        initialId = result.logs[0].args["id"]
    })

    it("Successfully execute auctionEnd and transfer the token's ownership back to the beneficiary", async () => {
        const advancement = 600;
        await helper.advanceTime(advancement);

        // Successfully end the auction and transfer the token
        let result;
        try {
            result = await contract.auctionEnd(initialId)
        } catch (error) {
            console.log(error)
        }

        // Unsuccessfully bid by bidding after the auctionEnd had already been invoked
        try {
            const ended = await contract.auctionEnd(initialId)
        } catch (error) {
            assert.equal(error.reason, "Already ended")
        }

        const auctionInfo = await contract._auctionInfo(initialId);
        const tokenId = auctionInfo["tokenId"]
        const beneficiary = auctionInfo["beneficiary"]
        const owner = await solireyContract.ownerOf(tokenId)
        assert.equal(owner, beneficiary, "The new owner of the token should be the beneficiary.")
        assert.isTrue(result.receipt.status, "The status for the auctionEnd method call has to be true.")
    })
})