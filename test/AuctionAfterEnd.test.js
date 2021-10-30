const auction = artifacts.require("Auction");
const helper = require("./helpers/truffleTestHelper");
const { toBN } = web3.utils;

contract("Auction after ended", (accounts) => {
    let contract, admin, initialSeller, initialId, initialBiddingTime, initialStartingBid, initialAuctionEndTime, firstBuyer, initialBid;
    before(async () => {
        admin = accounts[0];
        firstBuyer = accounts[1];
        secondBuyer = accounts[2];
        contract = await auction.deployed({ from: admin });

        initialSeller = accounts[3];
        initialId = "id"
        initialBiddingTime = 100
        initialStartingBid = 100
        initialBid = web3.utils.toWei('1', 'ether')
    })

    it("Bidding fails due to the auction end date", async () => {
        try {
            // Calculate auction end time at the same time as the auction creat time
            let initialBiddingTimeInMilliSeconds = initialBiddingTime * 1000
            const timeObject = new Date(); 
            initialAuctionEndTime = new Date(timeObject.getTime() + initialBiddingTimeInMilliSeconds);

            await contract.createAuction(initialId, initialBiddingTime, initialStartingBid, { from: initialSeller });
        } catch (error) {
            console.log("error", error)
        }

        // bid before the auction end time 
        try {
            await contract.bid(initialId, { from: firstBuyer, value: initialBid });
        } catch(error) {
            console.log(error)
        }

        const advancement = 600;
        await helper.advanceTime(advancement);

        // bid after the auction end time 
        try {
            await contract.bid(initialId, { from: firstBuyer, value: initialBid });
        } catch(error) {
            assert.equal(error.reason, "Auction already ended.")
        }
    })  

    it("Successfully collect the payment by the seller.", async () => {
        try {
            await contract.getTheHighestBid(initialId, { from: initialSeller })
        } catch(error) {
            assert.equal(error.reason, "Auction has not yet ended.")
        }

        let result;
        try {
            result = await contract.auctionEnd(initialId)
        } catch (error) {
            console.log(error)
        }

        try {
            await contract.getTheHighestBid(initialId, { from: firstBuyer })
        } catch(error) {
            assert.equal(error.reason, "You are not the beneficiary")
        }

        const balanceBefore = await web3.eth.getBalance(initialSeller)
        let getResult;
        try {
            getResult = await contract.getTheHighestBid(initialId, { from: initialSeller })
        } catch(error) {
            console.log(error)
        }

        const balanceAfter = await web3.eth.getBalance(initialSeller)

        // calculate the total gas cost
        const gasUsed = getResult.receipt.gasUsed;
        const tx = await web3.eth.getTransaction(getResult.tx)
        const gasPrice = tx.gasPrice
        const totalGasCost = gasUsed * gasPrice; 

        const diff = toBN(balanceAfter).sub(toBN(balanceBefore))
        const final = diff.add(toBN(totalGasCost))

        const auctionInfo = await contract.getAuctionInfo(initialId);
        const beneficiary = auctionInfo["beneficiary"]
        const auctionEndTime = auctionInfo["auctionEndTime"]
        const startingBid = auctionInfo["startingBid"]
        const tokenId = auctionInfo["tokenId"]
        const highestBidder = auctionInfo["highestBidder"]
        const highestBid = auctionInfo["highestBid"]
        const ended = auctionInfo["ended"]
        const dateObject = new Date(auctionEndTime.toNumber() * 1000);

        // Since no one has been outbid, there shouldn't be any pending return.
        const pendingReturn = await contract.getPendingReturn(initialId, firstBuyer);

        assert.isTrue(getResult.receipt.status, "The status for the getTheHighestBid method has to be true.");
        assert.equal(pendingReturn.toString(), "0", "The pending return should be 0.");
        assert.equal(beneficiary, initialSeller, "The seller and the beneficiary aren't the same.");
        // assert.equal(dateObject.toString(), initialAuctionEndTime.toString(), "The initialAuctionEndTime and the auctionEndTime aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(tokenId.toNumber(), 1, "Wrong token ID number");
        assert.equal(highestBidder, firstBuyer, "The highestBidder should be default.");
        assert.equal(highestBid, initialBid, "The highestBid should be at 0.");
        assert.isTrue(ended, "The ended variable should be false by default.");
        assert.isTrue(result.receipt.status, "The status for the auctionEnd method call has to be true.")
        assert.equal(final.toString(), initialBid.toString(), "The amount collected by the seller is different from the amount paid by the buyer.")
        assert.equal(final.toString(), highestBid.toString(), "The amount collected by the seller has to be same as the highest bid.")
    })
})