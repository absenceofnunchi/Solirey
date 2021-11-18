const auction = artifacts.require("Auction");
const simplePayment = artifacts.require("SimplePaymentDigital");

contract("Combining Simple Payment and Auction", (accounts) => {
    let simpleContract, auctionContract, admin, initialSeller, initialValue, simpleUid, auctionUid, auctionTokenId, simpleTokenId, commissionRate;
    before(async () => {
        admin = accounts[0];
        initialSeller = accounts[1];
        initialValue = web3.utils.toWei("1", "ether");
        commissionRate = 2

        // auction
        initialBiddingTime = 100
        initialStartingBid = 100

        simpleContract = await simplePayment.deployed({ from: admin });
        auctionContract = await auction.deployed({ from: admin });
    });

    it("Create simple payment.", async () => {
        // Successfully create payment
        let result;
        try {
            result = await simpleContract.createPayment(initialValue, { from: initialSeller })
        } catch (error) {
            console.log(error)
        }

        // Get the uid of the newly created token so that the revelant _simplePayment could be retrieved.
        simpleUid = result.logs[0].args["id"].toString()
        const simplePayment = await simpleContract._simplePayment(simpleUid)
        const payment = simplePayment["payment"]
        const price = simplePayment["price"]
        const fee = simplePayment["fee"]
        const fetchedTokenId = simplePayment["tokenId"]
        const seller = simplePayment["seller"]

        simpleTokenId = result.logs[1].args["tokenId"].toString()
        // const onSale = await contract._forSale(tokenId);
        const owner = await simpleContract.ownerOf(simpleTokenId)
        const artist = await simpleContract._artist(simpleTokenId)

        // assert.isTrue(onSale, "The onSale for the current token ID should be true.")
        assert.equal(owner, simpleContract.address, "The owner of the current token ID should be identical to the initial seller.")
        assert.equal(payment.toString(), 0, "Payment should be zero.")
        assert.equal(price.toString(), initialValue.toString())
        assert.equal(fee.toString(), 0)
        assert.equal(fetchedTokenId.toString(), simpleTokenId.toString())
        assert.equal(simpleTokenId.toString(), 1, "Wrong simple token ID.")
        assert.equal(seller, initialSeller)
        assert.equal(artist, initialSeller)
    })

    it("Create an auction", async () => {
        // Successfully create an auction which is to be aborted later.
        let result;
        try {
            // Calculate auction end time at the same time as the auction creat time
            let initialBiddingTimeInMilliSeconds = initialBiddingTime * 1000
            const timeObject = new Date(); 
            initialAuctionEndTime = new Date(timeObject.getTime() + initialBiddingTimeInMilliSeconds);

            result = await auctionContract.createAuction(initialBiddingTime, initialStartingBid, { from: initialSeller });
        } catch (error) {
            console.log("error", error)
        }

        auctionUid = result.logs[0].args["id"]
        auctionTokenId = result.logs[1].args["2"]
        const auctionInfo = await auctionContract.getAuctionInfo(auctionUid);
        
        const beneficiary = auctionInfo["beneficiary"]
        const auctionEndTime = auctionInfo["auctionEndTime"]
        const startingBid = auctionInfo["startingBid"]
        const tokenId = auctionInfo["tokenId"]
        const highestBidder = auctionInfo["highestBidder"]
        const highestBid = auctionInfo["highestBid"]
        const ended = auctionInfo["ended"]
        
        // check that the owner of the newly minted token is the current contract
        const owner = await auctionContract.ownerOf(auctionTokenId);

        assert.isTrue(result.receipt.status, "The status for the createAuction method isn't true.");
        assert.equal(beneficiary, initialSeller, "The seller and the beneficiary aren't the same.");
        // assert.equal(dateObject.toString(), initialAuctionEndTime.toString(), "The initialAuctionEndTime and the auctionEndTime aren't the same.");
        assert.equal(startingBid, initialStartingBid, "The initialStartingBid and the startingBid aren't the same.");
        assert.equal(auctionTokenId.toNumber(), 1, "Wrong token ID number");
        assert.equal(highestBidder, 0, "The highestBidder should be default.");
        assert.equal(highestBid, 0, "The highestBid should be at 0.");
        assert.isFalse(ended, "The ended variable should be false by default.");
        assert.equal(owner, auctionContract.address, "The owner of the newly minted token is inaccurate. Should be the current auction contract.")
        assert.equal(auctionUid.toString(), 1, "Wrong initial Id.")
    })
})