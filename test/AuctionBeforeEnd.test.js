const auction = artifacts.require("Auction");
const { toBN } = web3.utils;

contract("During Auction", (accounts) => {
    let contract, admin, initialSeller, initialId, secondId, initialBiddingTime, initialStartingBid, initialAuctionEndTime, firstBuyer, secondBuyer, initialBid, secondBid, initialTokenId;
    before(async () => {
        admin = accounts[0];
        firstBuyer = accounts[1];
        secondBuyer = accounts[2];
        contract = await auction.deployed({ from: admin });

        initialSeller = accounts[3];
        prelimId = "prelimId"
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
        // Successfully create an auction which is to be aborted later.
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
    
        // Unsuccesfully attempt to create an auction under the identical ID
        try {
            // Calculate auction end time at the same time as the auction creat time
            let initialBiddingTimeInMilliSeconds = initialBiddingTime * 1000
            const timeObject = new Date(); 
            initialAuctionEndTime = new Date(timeObject.getTime() + initialBiddingTimeInMilliSeconds);

            await contract.createAuction(initialBiddingTime, initialStartingBid, { from: initialSeller });
        } catch (error) {
            assert.equal(error.reason, "This ID has already been used.", "The attempt to create an auction under the same ID should fail.")
        }

        initialId = result.logs[0].args["id"]
        initialTokenId = result.logs[1].args["2"]
        const auctionInfo = await contract.getAuctionInfo(initialId);
        
        const beneficiary = auctionInfo["beneficiary"]
        const auctionEndTime = auctionInfo["auctionEndTime"]
        const startingBid = auctionInfo["startingBid"]
        const tokenId = auctionInfo["tokenId"]
        const highestBidder = auctionInfo["highestBidder"]
        const highestBid = auctionInfo["highestBid"]
        const ended = auctionInfo["ended"]
        
        const dateObject = new Date(auctionEndTime.toNumber() * 1000);

        // check that the owner of the newly minted token is the current contract
        const owner = await contract.ownerOf(tokenId);

        assert.isTrue(result.receipt.status, "The status for the createAuction method isn't true.");
        assert.equal(beneficiary, initialSeller, "The seller and the beneficiary aren't the same.");
        // assert.equal(dateObject.toString(), initialAuctionEndTime.toString(), "The initialAuctionEndTime and the auctionEndTime aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(tokenId.toNumber(), 1, "Wrong token ID number");
        assert.equal(highestBidder, 0, "The highestBidder should be default.");
        assert.equal(highestBid, 0, "The highestBid should be at 0.");
        assert.isFalse(ended, "The ended variable should be false by default.");
        assert.equal(owner, contract.address, "The owner of the newly minted token is inaccurate. Should be the current auction contract.")
        assert.equal(initialId.toString(), 1, "Wrong initial Id.")
    })

    it("Unsuccesfully attempt to resell an item right after listing it on an auction.", async () => {
        const auctionInfo = await contract._auctionInfo(initialId);
        const tokenId = auctionInfo["tokenId"]

        // Should fail because the ownership has been transferred to the auction contract when a new auction was created.
        try {
            await contract.resell(initialBiddingTime, initialStartingBid, tokenId, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Not authorized")
        }
    })

    it("Get the proper auction info using the public variable _auctionInfo", async () => {
        const auctionInfo = await contract._auctionInfo(initialId);

        const beneficiary = auctionInfo["beneficiary"]
        const auctionEndTime = auctionInfo["auctionEndTime"]
        const startingBid = auctionInfo["startingBid"]
        const tokenId = auctionInfo["tokenId"]
        const highestBidder = auctionInfo["highestBidder"]
        const highestBid = auctionInfo["highestBid"]
        const ended = auctionInfo["ended"]
        const transferred = auctionInfo["transferred"]

        const dateObject = new Date(auctionEndTime.toNumber() * 1000);
        assert.equal(beneficiary, initialSeller, "The seller and the beneficiary aren't the same.");
        // assert.equal(dateObject.toString(), initialAuctionEndTime.toString(), "The initialAuctionEndTime and the auctionEndTime aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(tokenId.toNumber(), 1, "Wrong token ID number");
        assert.equal(highestBidder, 0, "The highestBidder should be default.");
        assert.equal(highestBid, 0, "The highestBid should be at 0.");
        assert.isFalse(ended, "The ended variable should be false by default.");
        assert.isFalse(transferred, "The transferred variable should be false by default.");
    })

    it("Successfully abort the auction", async () => {
        try {
            await contract.abort(initialId, { from: firstBuyer })
        } catch (error) {
            assert.equal(error.reason, "Not authorized");
        }

        let result;
        try {
            result = await contract.abort(initialId, { from: initialSeller })
        } catch (error) {
            console.log(error)
        }

        const auctionInfo = await contract._auctionInfo(initialId)
        const tokenId = auctionInfo["tokenId"]
        const owner = await contract.ownerOf(tokenId)
        const ended = auctionInfo["ended"]

        assert.isTrue(result.receipt.status, "The status of the transaction should be true.");
        assert.equal(owner, initialSeller, "The owner of the token ID 1 minted from prelimId should be the initialSeller.")
        assert.isTrue(ended, "The ended variable should say true.")
    })

    it("Bid", async () => {
        // Create another auction to bid on
        try {
            // Calculate auction end time at the same time as the auction create time
            let initialBiddingTimeInMilliSeconds = initialBiddingTime * 1000
            const timeObject = new Date(); 
            initialAuctionEndTime = new Date(timeObject.getTime() + initialBiddingTimeInMilliSeconds);

            let createResult = await contract.createAuction(initialBiddingTime, initialStartingBid, { from: initialSeller });
            secondId = createResult.logs[0].args["id"]
            initialTokenId = createResult.logs[1].args["2"]
        } catch (error) {
            console.log("error", error)
        }

        // underbid than the minimum bid
        try {
            await contract.bid(secondId, { from: firstBuyer, value: 50 });
        } catch(error) {
            assert.equal(error.reason, "The bid has to be higher than the specified starting bid", "The underbid should fail.");
        }

        // bid on an aborted auction
        try {
            await contract.bid(initialId, { from: firstBuyer, value: 50 });
        } catch(error) {
            assert.equal(error.reason, "Auction already ended");
        }

        // bid on an uninitiated ID
        try {
            await contract.bid(500, { from: initialSeller, value: 150 });
        } catch(error) {
            assert.equal(error.reason, "Auction already ended", "Should fail due to due to the lack of the auction end time variable.");
        }
        
        // successful bidding
        let result;
        try {
            result = await contract.bid(secondId, { from: firstBuyer, value: initialBid });
        } catch(error) {
            assert.equal("error", error);
        }

        // The first time bidding shouldn't have anything in pending return.
        const pendingReturn = await contract.getPendingReturn(secondId, { from: firstBuyer });

        const auctionInfo = await contract.getAuctionInfo(secondId);
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
        // assert.equal(dateObject.toString(), initialAuctionEndTime.toString(), "The initialAuctionEndTime and the auctionEndTime aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(tokenId.toNumber(), initialTokenId.toString(), "Wrong token ID number");
        assert.equal(highestBidder, firstBuyer, "The highestBidder should be default.");
        assert.equal(highestBid, initialBid, "The highestBid should be at 0.");
        assert.isFalse(ended, "The ended variable should be false by default.");
    })

    it("Unsuccesfully abort the auction", async () => {
        // A bid has already been made
        try {
            await contract.abort(secondId, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Cannot abort");
        }
    })

    it("Get the pending return value", async () => {
        // underbid the current highest bid
        try {
            await contract.bid(secondId, { from: secondBuyer, value: 50 });
        } catch(error) {
            assert.equal(error.reason, "Higher bid already exists");
        }

        // successful bid from a second buyer
        try {
            await contract.bid(secondId, { from: secondBuyer, value: secondBid });
        } catch(error) {
            console.log(error)
        }

        const pendingReturn = await contract.getPendingReturn(secondId, { from: firstBuyer })

        assert.equal(pendingReturn.toString(), initialBid, "Incorrect pending return amount.")
    })

    it("Withdraws the proper outbid amount", async () => {
        // check the pending return for the first buyer
        const pendingReturnFirstBuyer = await contract.getPendingReturn(secondId, { from: firstBuyer});
        assert.equal(pendingReturnFirstBuyer.toString(), initialBid, "Inaccurate pending return.");

        // check the pending return for the second buyer
        const pendingReturnSecondBuyer = await contract.getPendingReturn(secondId, { from: secondBuyer });
        assert.equal(pendingReturnSecondBuyer.toString(), 0, "Inaccurate pending return.");

        // The difference between the balance before and after the withdraw should be the same amount from pendingReturn
        const firstBuyerBalanceBefore = await web3.eth.getBalance(firstBuyer)
        // the first buyer withdraws the bid amount since they have been outbid
        const result = await contract.withdraw(secondId, { from: firstBuyer })
        const firstBuyerBalanceAfter = await web3.eth.getBalance(firstBuyer)
        
        // calculate the total gas cost
        const gasUsed = result.receipt.gasUsed;
        const tx = await web3.eth.getTransaction(result.tx);
        const gasPrice = tx.gasPrice;
        const totalGasCost = gasUsed * gasPrice;
        
        let diff = toBN(firstBuyerBalanceAfter).sub(toBN(firstBuyerBalanceBefore))
        let final = diff.add(toBN(totalGasCost));
        assert.equal(final.toString(), initialBid.toString(), "The withdrawn amount from pendingReturn doesn't match the bid mount.");

        const firstBuyerFinalPendingReturn = await contract.getPendingReturn(secondId, { from: firstBuyer });

        const auctionInfo = await contract.getAuctionInfo(secondId);
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
        // assert.equal(dateObject.toString(), initialAuctionEndTime.toString(), "The initialAuctionEndTime and the auctionEndTime aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(tokenId.toNumber(), initialTokenId.toString(), "Wrong token ID number");
        assert.equal(highestBidder, secondBuyer, "The highestBidder should be default.");
        assert.equal(highestBid, secondBid, "The highestBid should be at 0.");
        assert.isFalse(ended, "The ended variable should be false by default.");
    })

    it("Fail to end the auction before the end time", async () => {
        try {
            await contract.auctionEnd(secondId)
        } catch (error) {
            assert.equal(error.reason, "Auction has not yet ended")
        }

        try {
            await contract.getTheHighestBid(secondId, { from: initialSeller })
        } catch(error) {
            assert.equal(error.reason, "Auction bidding time has not expired")
        }
    })
})