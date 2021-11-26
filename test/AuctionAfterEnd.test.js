const auction = artifacts.require("Auction");
const solirey = artifacts.require("Solirey");
const helper = require("./helpers/truffleTestHelper");
const { toBN } = web3.utils;

contract("After Auction", (accounts) => {
    let contract, solireyContract, admin, initialSeller, initialId, initialBiddingTime, initialStartingBid, initialAuctionEndTime, firstBuyer, initialBid;
    before(async () => {
        admin = accounts[0];
        firstBuyer = accounts[1];
        secondBuyer = accounts[2];
        contract = await auction.deployed({ from: admin });
        solireyContract = await solirey.deployed({ from: admin });

        initialSeller = accounts[3];
        initialBiddingTime = 100
        initialStartingBid = 100
        initialBid = web3.utils.toWei('1', 'ether')
    })

    it("Bidding fails due to the auction end date", async () => {
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

        // Successfully bid before the auction end time 
        try {
            await contract.bid(initialId, { from: firstBuyer, value: initialBid });
        } catch(error) {
            console.log(error)
        }

        // Attempt to collect the payment prior to the end of the auction
        try {
            await contract.getTheHighestBid(initialId, { from: initialSeller })
        } catch(error) {
            assert.equal(error.reason, "Auction bidding time has not expired")
        }

        const advancement = 600;
        await helper.advanceTime(advancement);

        // bid after the auction end time 
        try {
            await contract.bid(initialId, { from: firstBuyer, value: initialBid });
        } catch(error) {
            assert.equal(error.reason, "Auction already ended")
        }
    })  

    it("Unsuccesfully abort the auction", async () => {
        try {
            await contract.abort(initialId, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Cannot abort");
        }
    })

    it("Successfully execute auctionEnd and transfer the token's ownership to the buyer", async () => {
        // Successfully end the auction and transfer the token
        let result;
        try {
            result = await contract.auctionEnd(initialId)
        } catch (error) {
            console.log(error)
        }

        // Unsuccessfully bid by bidding after the auctionEnd had already been invoked
        try {
            await contract.auctionEnd(initialId)
        } catch (error) {
            assert.equal(error.reason, "Already ended")
        }

        const auctionInfo = await contract._auctionInfo(initialId);
        const tokenId = auctionInfo["tokenId"]
        // Check that the new owner of the token executed from auctionEnd is the firstBuyer
        const owner = await solireyContract.ownerOf(tokenId)
        assert.equal(owner, firstBuyer, "The new owner of the token should be the first buyer.")
        assert.isTrue(result.receipt.status, "The status for the auctionEnd method call has to be true.")
    })

    it("Successfully collect the payment by the seller.", async () => {
        // Attempt to collect the payment by an unauthorized account
        try {
            await contract.getTheHighestBid(initialId, { from: firstBuyer })
        } catch(error) {
            assert.equal(error.reason, "You are not the beneficiary")
        }

        // Successfully get the highest bid by the seller
        const balanceBefore = await web3.eth.getBalance(initialSeller)
        const adminBalanceBefore = await web3.eth.getBalance(admin)

        let getResult;
        try {
            getResult = await contract.getTheHighestBid(initialId, { from: initialSeller })
        } catch(error) {
            console.log(error)
        }

        const balanceAfter = await web3.eth.getBalance(initialSeller)
        const adminBalanceAfter = await web3.eth.getBalance(admin)

        // calculate the total gas cost
        const totalGasCost = await helper.getTotalGasCost(getResult)

        const diff = toBN(balanceAfter).sub(toBN(balanceBefore))
        const actualSellerBalanceDifference = toBN(diff).add(toBN(totalGasCost))

        const fee = toBN(initialBid).mul(toBN(2)).div(toBN(100))
        // Subtract the fee only once because the current seller is also the original artist which gets paid their own commission.
        const expectedSellerDifference = toBN(initialBid).sub(toBN(fee))

        const auctionInfo = await contract._auctionInfo(initialId);
        const beneficiary = auctionInfo["beneficiary"]
        // const auctionEndTime = auctionInfo["auctionEndTime"]
        const startingBid = auctionInfo["startingBid"]
        const tokenId = auctionInfo["tokenId"]
        const highestBidder = auctionInfo["highestBidder"]
        const highestBid = auctionInfo["highestBid"]
        const ended = auctionInfo["ended"]
        const transferred = auctionInfo["transferred"]
        // const dateObject = new Date(auctionEndTime.toNumber() * 1000);

        // Since no one has been outbid, there shouldn't be any pending return.
        const pendingReturn = await contract.getPendingReturn(initialId, { from: firstBuyer });

        // check the balance of the admin to confirm the new deposit
        const adminDiff = toBN(adminBalanceAfter).sub(toBN(adminBalanceBefore))

        assert.isTrue(getResult.receipt.status, "The status for the getTheHighestBid method has to be true.");
        assert.equal(pendingReturn.toString(), "0", "The pending return should be 0.");
        assert.equal(beneficiary, initialSeller, "The seller and the beneficiary aren't the same.");
        // assert.equal(dateObject.toString(), initialAuctionEndTime.toString(), "The initialAuctionEndTime and the auctionEndTime aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(tokenId.toNumber(), 1, "Wrong token ID number");
        assert.equal(highestBidder, firstBuyer, "The highestBidder should be default.");
        assert.equal(highestBid, initialBid, "The highestBid should be at 0.");
        assert.isTrue(ended, "The ended variable should be false by default.");
        assert.isTrue(transferred, "The transferred variable should be false by default.");
        assert.equal(actualSellerBalanceDifference.toString(), expectedSellerDifference.toString(), "The amount collected by the seller is different from the amount paid by the buyer.")
        assert.equal(adminDiff.toString(), fee.toString(), "The increased balance of the admin's account should match the newly deposited fee.")
    })

    it("Successfully resell", async () => {
        const auctionInfo = await contract._auctionInfo(initialId)
        const tokenId = auctionInfo["tokenId"]

        // Unsuccessfully attempt to resell by an unauthorized account
        try {
            const resellData = web3.eth.abi.encodeParameters(['uint', 'uint'], [initialBiddingTime, initialStartingBid]);
            await solireyContract.methods['safeTransferFrom(address,address,uint256,bytes)'](firstBuyer, contract.address, tokenId, resellData, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "ERC721: transfer caller is not owner nor approved")
        }

        // Successfully resell
        let resellResult;
        try {
            const resellData = web3.eth.abi.encodeParameters(['uint', 'uint'], [initialBiddingTime, initialStartingBid]);
            resellResult = await solireyContract.methods['safeTransferFrom(address,address,uint256,bytes)'](firstBuyer, contract.address, tokenId, resellData, { from: firstBuyer })
            const events = await contract.getPastEvents("AuctionCreated", {fromBlock: 0, toBlock: "latest"})
            for (let i = 0; i < events.length; i++) {
                const event = events[i]
                if (event.event == "AuctionCreated") {
                    if (event.returnValues.seller == firstBuyer) {
                        if (firstBuyer == event.returnValues.seller) {
                            initialId = event.returnValues.id
                        }
                    }
                }
            }
        } catch (error) {
            console.log(error)
        }

        const newAuctionInfo = await contract._auctionInfo(initialId)
        const beneficiary = newAuctionInfo["beneficiary"]
        const startingBid = newAuctionInfo["startingBid"]
        const newTokenId = newAuctionInfo["tokenId"]
        const highestBidder = newAuctionInfo["highestBidder"]
        const highestBid = newAuctionInfo["highestBid"]
        const ended = newAuctionInfo["ended"]
        const transferred = newAuctionInfo["transferred"]
        const owner = await solireyContract.ownerOf(newTokenId)

        assert.equal(beneficiary, firstBuyer, "The seller and the beneficiary aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(newTokenId.toNumber(), 1, "Wrong token ID number");
        assert.equal(highestBidder, "0x0000000000000000000000000000000000000000", "The highestBidder should be default.");
        assert.equal(highestBid, 0, "The highestBid should be at 0.");
        assert.isFalse(ended, "The ended variable should be false by default.");
        assert.isFalse(transferred, "The transferred variable should be false by default.");
        assert.equal(owner, contract.address, "The owner of the token to be resold should be the currnet auction contract.");
    })
})