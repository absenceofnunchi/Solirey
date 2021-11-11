const Auction = artifacts.require("IndividualAuction");
const mintContract = artifacts.require("MintContract")
const helper = require("./helpers/truffleTestHelper");
const { toBN } = web3.utils;

contract("Individual Auction", (accounts) => {
    describe("One or more bidding", async() => {
        let auctionInstance, startingBidInput, initialTokenId, admin, auctionDeployer, firstBidder, secondBidder, finalBidder, adminFee;
        before(async () => {
            initialTokenId = 1;

            admin = accounts[0]
            auctionDeployer = accounts[5]
            firstBidder = accounts[6]
            secondBidder = accounts[7]
            finalBidder = accounts[9]
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

        it("successfully transfer a token into the contract", async () => {
            // Attempt to transfer a token into the aucton by a non-beneficiary.
            try {
                await mintContractInstance.mintNft(auctionInstance.address, { from: accounts[4] })
            } catch (error) {
                assert.equal(error.reason, "Unauthorized")
            }

            // Successfully transfer
            try {
                await mintContractInstance.mintNft(auctionInstance.address, { from: auctionDeployer })
            } catch (error) {
                console.log("error", error)
            }

            // Attempt to transfer a token into the contract from an unknown contract, but only after a token has already been transferred.
            try {
                await auctionInstance.onERC721Received(
                    accounts[4],
                    accounts[0],
                    initialTokenId,
                    [0x01, 0x02],
                    { from: auctionDeployer }
                )
            } catch (error) {
                assert.equal(error.reason, "The auction already has a token.")
            }

            const tokenId = await auctionInstance.tokenId.call();
            const beneficiary = await auctionInstance.beneficiary.call();
        
            assert.equal(tokenId.toNumber(), 1, "The token ID is incorrect.");
            assert.equal(beneficiary, auctionDeployer, "Only the beneficiary can transfer the token")
        });

        it("bid fails due to minimum bidding requirement", async () => {
            try {
                await auctionInstance.bid({ from: firstBidder, value: 1 })
            } catch (error) {
                assert.equal(error.reason, "Too low")
            }
        })
    
        it("bid fails due to the beneficiary bidding in their own auction.", async () => {
            try {
                const bidAmount = web3.utils.toWei("2", "ether");
                await auctionInstance.bid({ from: auctionDeployer, value: bidAmount });
            } catch (error) {
                assert.equal(error.reason, "Can't bid on your own auction");
            }
        })
    
        it("successfully bids.", async () => {
            const bidAmount = web3.utils.toWei("2", "ether");
            try {
                await auctionInstance.bid({ from: firstBidder, value: bidAmount });
            } catch (error) {
                console.log(error)
            }
            
            const highestBid = await auctionInstance.highestBid.call();
            const highestBidder = await auctionInstance.highestBidder.call();
            const pendingReturns = await auctionInstance.pendingReturns.call(highestBidder);
        
            assert.equal(highestBid, bidAmount, "The bid is not registered as the highest bid amount.");
            assert.equal(highestBidder, firstBidder, "The highest bidder is incorrect.");
            assert.equal(pendingReturns, 0, "Incorrect bid amount in pending returns."); // change pendingReturns to public
        })
    
        it("highest bid becomes pending returns", async () => {
            const bidAmount = web3.utils.toWei("3", "ether");
            await auctionInstance.bid({ from: secondBidder, value: bidAmount });
        
            const highestBid = await auctionInstance.highestBid.call();
            const pendingReturns = await auctionInstance.pendingReturns.call(firstBidder); // change pendingReturns to public
            const highestBidder = await auctionInstance.highestBidder.call();
            const previousBidAmount = web3.utils.toWei("2", "ether");
        
            assert.equal(highestBid, bidAmount, "The bid not registered as the highest bid amount.");
            assert.equal(highestBidder, secondBidder, "The highest bidder is incorrect.");
            assert.equal(pendingReturns, previousBidAmount, "Incorrect bid amount in pending returns.");
        })

        it("multiple bidding", async () => {
            // multiple bidding
            let moreBids = web3.utils.toWei("4", "ether");
            try {
                await auctionInstance.bid({ from: accounts[4], value: moreBids });
            } catch (error) {
                console.log(error)
            }

            moreBids = web3.utils.toWei("5", "ether");
            try {
                await auctionInstance.bid({ from: accounts[6], value: moreBids });
            } catch (error) {
                console.log(error)
            }

            moreBids = web3.utils.toWei("6", "ether");
            try {
                await auctionInstance.bid({ from: accounts[7], value: moreBids });
            } catch (error) {
                console.log(error)
            }

            moreBids = web3.utils.toWei("7", "ether");
            try {
                await auctionInstance.bid({ from: finalBidder, value: moreBids });
            } catch (error) {
                console.log(error)
            }
        })
    
        it("fails to withdraw", async() => {
            try {
                await auctionInstance.withdraw({ from: secondBidder });
            } catch (error) {
                assert.equal(error.reason, "You are currently the hightest bidder");
            }
        })
    
        it("fails to transfer a token into the contract", async () => {
            try {
                await auctionInstance.onERC721Received(
                    accounts[4],
                    accounts[5],
                    10,
                    [0x01, 0x02],
                    { from: accounts[0] }
                );
            } catch (error) {
                assert.equal(error.reason, "Unauthorized");
            }
    
            // token ID is till the same even after the failed attempt to transfer another one into the account
            const tokenId = await auctionInstance.tokenId.call();
            assert.equal(tokenId.toNumber(), 1, "Incorrent tokenId");
        
            try {
                await auctionInstance.onERC721Received(
                    accounts[4],
                    accounts[0],
                    2,
                    [0x01, 0x02],
                    { from: auctionDeployer }
                );
            } catch (error) {
                assert.equal(error.reason, "The auction already has a token.");
            }
        })
    
        it("successfully end auction", async() => {
        // ending the auction before the bid time
            try {    
                await auctionInstance.auctionEnd({ from: accounts[3] });
            } catch (error) {
                assert.equal(error.reason, "Auction has not yet ended.");
            } 
        
            // trying the withdrawal the highest bid before the auction ended
            try { 
                await auctionInstance.getTheHighestBid({ from: auctionDeployer });
            } catch (error) {
                assert.equal(error.reason, "Active auction");
            }
        
            // trying to transfer the token before the time expired
            // try {
            //     await auctionInstance.transferToken({ from: finalBidder });
            // } catch (error) {
            //     assert.equal(error.reason, "Bidding time has not expired.");
            // }
        
            const advancement = 600;
            const newBlock = await helper.advanceTimeAndBlock(advancement);
            const originalBlock = web3.eth.getBlock('latest');
            const timeDiff = newBlock.timestamp - originalBlock.timestamp;
        
            // // trying to transfer the token before the auction ended
            // try {
            //     await auctionInstance.transferToken({ from: accounts[1] });
            // } catch (error) {
            //     assert.equal(error.reason, "Auction has not yet ended.");
            // }
        
            let tx = await auctionInstance.auctionEnd({ from: accounts[1] });
            assert.isTrue(tx.receipt.status, "auctionEnded status is not true");
        
            // trying to end the auction twice
            try {    
                await auctionInstance.auctionEnd({ from: accounts[3] });
            } catch (error) {
                assert.equal(error.reason, "Auction has already been ended.");
            } 
        })
    
        it("beneficiary takes out the bid", async () => {
            try {
                await auctionInstance.getTheHighestBid({ from: accounts[7] });
            } catch (error) {
                assert.equal(error.reason, "You are not the beneficiary");
            }
        
            const balanceBefore = await web3.eth.getBalance(auctionDeployer)
            const adminBalanceBefore = await web3.eth.getBalance(admin)

            let result;
            try {
                result = await auctionInstance.getTheHighestBid({ from: auctionDeployer });
            } catch (error) {
                console.log(error)
            } 

            // seller expected
            const highestBid = await auctionInstance.highestBid.call()
            const commission = toBN(highestBid).mul(toBN(adminFee)).div(toBN(100))
            const expectedPayout =  toBN(highestBid).sub(toBN(commission))

            // seller actual
            const balanceAfter = await web3.eth.getBalance(auctionDeployer)
            const diff = toBN(balanceAfter).sub(toBN(balanceBefore));
            const totalGasCost = await helper.getTotalGasCost(result)
            const actualPayout = toBN(diff).add(toBN(totalGasCost))

            // admin actual
            const adminBalanceAfter = await web3.eth.getBalance(admin)
            const adminDiff = toBN(adminBalanceAfter).sub(toBN(adminBalanceBefore))

            assert.equal(actualPayout.toString(), expectedPayout.toString(), "The seller payout is incorrect.")
            assert.equal(adminDiff.toString(), commission.toString(), "The admin commission is incorrect.")

            try {
                await auctionInstance.getTheHighestBid({ from: auctionDeployer });
            } catch (error) {
                assert.equal(error.reason, "Already withdrawn")
            } 
        })
    
        // it("transferring the token", async () => {
        //     const owner = await mintContractInstance.ownerOf(initialTokenId)
        //     assert.equal(owner, auctionInstance.address, "The owner before the transfer should be the auction deployer.")

        //     // an unauthorized attempt to transfer the token
        //     try {
        //         await auctionInstance.transferToken({ from: accounts[3] });
        //     } catch (error) {
        //         assert.equal(error.reason, "You are not the highest bidder");
        //     }

        //     // successful transfer of the token
        //     try {
        //         await auctionInstance.transferToken({ from: finalBidder });
        //     } catch (error) {
        //         console.log(error)
        //     }

        //     const newOwner = await mintContractInstance.ownerOf(initialTokenId)
        //     assert.equal(newOwner, finalBidder, "The owner before the transfer should be the auction deployer.")
        // })
  })
});
