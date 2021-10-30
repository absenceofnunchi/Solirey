const auction = artifacts.require("Auction");
const helper = require("./helpers/truffleTestHelper");
const { toBN } = web3.utils;

contract("Auction before the end time", (accounts) => {
    let contract, admin, initialSeller, initialId, initialBiddingTime, initialStartingBid, initialAuctionEndTime, firstBuyer, secondBuyer, initialBid, secondBid;
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

        secondBid = toBN(initialBid).add(toBN('100')).toString()
    })

    it("Successfully deployed", async () => {
        const retrievedAdmin = await contract.getAdmin.call();
        assert.equal(retrievedAdmin, admin, "The admin is incorrect.");
    });

    it("Create an auction", async () => {
        let result;
        try {
            // Calculate auction end time at the same time as the auction creat time
            let initialBiddingTimeInMilliSeconds = initialBiddingTime * 1000
            const timeObject = new Date(); 
            initialAuctionEndTime = new Date(timeObject.getTime() + initialBiddingTimeInMilliSeconds);

            result = await contract.createAuction(initialId, initialBiddingTime, initialStartingBid, { from: initialSeller });
        } catch (error) {
            console.log("error", error)
        }

        const auctionInfo = await contract.getAuctionInfo(initialId);
        
        const beneficiary = auctionInfo["beneficiary"]
        const auctionEndTime = auctionInfo["auctionEndTime"]
        const startingBid = auctionInfo["startingBid"]
        const tokenId = auctionInfo["tokenId"]
        const highestBidder = auctionInfo["highestBidder"]
        const highestBid = auctionInfo["highestBid"]
        const ended = auctionInfo["ended"]
        
        const dateObject = new Date(auctionEndTime.toNumber() * 1000);

        assert.isTrue(result.receipt.status, "The status for the createAuction method isn't true.");
        assert.equal(beneficiary, initialSeller, "The seller and the beneficiary aren't the same.");
        assert.equal(dateObject.toString(), initialAuctionEndTime.toString(), "The initialAuctionEndTime and the auctionEndTime aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(tokenId.toNumber(), 1, "Wrong token ID number");
        assert.equal(highestBidder, 0, "The highestBidder should be default.");
        assert.equal(highestBid, 0, "The highestBid should be at 0.");
        assert.isFalse(ended, "The ended variable should be false by default.");
    })

    it("Bid", async () => {
        // underbid than the minimum bid
        try {
            await contract.bid(initialId, { from: firstBuyer, value: 50 });
        } catch(error) {
            assert.equal(error.reason, "The bid has to be higher than the specified starting bid.", "The underbid should fail.");
        }

        // bid on your own auction
        try {
            await contract.bid(initialId, { from: initialSeller, value: 150 });
        } catch(error) {
            assert.equal(error.reason, "You cannot bid on your own auction.", "The underbid should fail.");
        }

        // bid on an uninitiated ID
        try {
            await contract.bid("random id", { from: initialSeller, value: 150 });
        } catch(error) {
            assert.equal(error.reason, "Auction already ended.", "Should fail due to due to the lack of the auction end time.");
        }
        
        // successful bidding
        let result;
        try {
            result = await contract.bid(initialId, { from: firstBuyer, value: initialBid });
        } catch(error) {
            assert.equal("error", error);
        }

        // The first time bidding shouldn't have anything in pending return.
        const pendingReturn = await contract.getPendingReturn(initialId, firstBuyer);

        const auctionInfo = await contract.getAuctionInfo(initialId);
        const beneficiary = auctionInfo["beneficiary"]
        const auctionEndTime = auctionInfo["auctionEndTime"]
        const startingBid = auctionInfo["startingBid"]
        const tokenId = auctionInfo["tokenId"]
        const highestBidder = auctionInfo["highestBidder"]
        const highestBid = auctionInfo["highestBid"]
        const ended = auctionInfo["ended"]
        
        const dateObject = new Date(auctionEndTime.toNumber() * 1000);

        assert.isTrue(result.receipt.status, "The status for the createAuction method isn't true.");
        assert.equal(pendingReturn.toString(), "0", "The pending return should be 0.");
        assert.equal(beneficiary, initialSeller, "The seller and the beneficiary aren't the same.");
        assert.equal(dateObject.toString(), initialAuctionEndTime.toString(), "The initialAuctionEndTime and the auctionEndTime aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(tokenId.toNumber(), 1, "Wrong token ID number");
        assert.equal(highestBidder, firstBuyer, "The highestBidder should be default.");
        assert.equal(highestBid, initialBid, "The highestBid should be at 0.");
        assert.isFalse(ended, "The ended variable should be false by default.");
    })

    it("Withdraws the proper outbid amount", async () => {
        // underbid the current highest bid
        try {
            await contract.bid(initialId, { from: secondBuyer, value: 50 });
        } catch(error) {
            assert.equal(error.reason, "Higher bid already exists.");
        }

        // successful bid from a second buyer
        try {
            await contract.bid(initialId, { from: secondBuyer, value: secondBid });
        } catch(error) {
            console.log(error)
        }

        // check the pending return for the first buyer
        const pendingReturnFirstBuyer = await contract.getPendingReturn(initialId, firstBuyer);
        assert.equal(pendingReturnFirstBuyer.toString(), initialBid, "Inaccurate pending return.");

        // check the pending return for the second buyer
        const pendingReturnSecondBuyer = await contract.getPendingReturn(initialId, secondBuyer);
        assert.equal(pendingReturnSecondBuyer.toString(), 0, "Inaccurate pending return.");

        // The difference between the balance before and after the withdraw should be the same amount from pendingReturn
        const firstBuyerBalanceBefore = await web3.eth.getBalance(firstBuyer)
        // the first buyer withdraws the bid amount since they have been outbid
        const result = await contract.withdraw(initialId, { from: firstBuyer })
        const firstBuyerBalanceAfter = await web3.eth.getBalance(firstBuyer)
        
        // calculate the total gas cost
        const gasUsed = result.receipt.gasUsed;
        const tx = await web3.eth.getTransaction(result.tx);
        const gasPrice = tx.gasPrice;
        const totalGasCost = gasUsed * gasPrice;
        
        let diff = toBN(firstBuyerBalanceAfter).sub(toBN(firstBuyerBalanceBefore))
        let final = diff.add(toBN(totalGasCost));
        assert.equal(final.toString(), initialBid.toString(), "The withdrawn amount from pendingReturn doesn't match the bid mount.");

        const firstBuyerFinalPendingReturn = await contract.getPendingReturn(initialId, firstBuyer);

        const auctionInfo = await contract.getAuctionInfo(initialId);
        const beneficiary = auctionInfo["beneficiary"]
        const auctionEndTime = auctionInfo["auctionEndTime"]
        const startingBid = auctionInfo["startingBid"]
        const tokenId = auctionInfo["tokenId"]
        const highestBidder = auctionInfo["highestBidder"]
        const highestBid = auctionInfo["highestBid"]
        const ended = auctionInfo["ended"]
        
        const dateObject = new Date(auctionEndTime.toNumber() * 1000);

        assert.isTrue(result.receipt.status, "The status for the createAuction method isn't true.");
        assert.equal(firstBuyerFinalPendingReturn.toString(), "0", "The pending return should be 0.");
        assert.equal(beneficiary, initialSeller, "The seller and the beneficiary aren't the same.");
        assert.equal(dateObject.toString(), initialAuctionEndTime.toString(), "The initialAuctionEndTime and the auctionEndTime aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(tokenId.toNumber(), 1, "Wrong token ID number");
        assert.equal(highestBidder, secondBuyer, "The highestBidder should be default.");
        assert.equal(highestBid, secondBid, "The highestBid should be at 0.");
        assert.isFalse(ended, "The ended variable should be false by default.");
    })

    it("Fail to end the auction before the end time", async () => {
        try {
            await contract.auctionEnd(initialId)
        } catch (error) {
            assert.equal(error.reason, "Auction has not yet ended.")
        }

        try {
            await contract.getTheHighestBid(initialId, { from: initialSeller })
        } catch(error) {
            assert.equal(error.reason, "Auction bidding time has not expired.")
        }
    })
})