const Auction = artifacts.require("IndividualAuction");
const mintContract = artifacts.require("MintContract")
const helper = require("./helpers/truffleTestHelper");

contract("Individual Auction", (accounts) => {
    describe("One or more bidding", async() => {
        let auctionInstance, startingBidInput, initialTokenId, admin, auctionDeployer, firstBidder, secondBidder;
        before(async () => {
            initialTokenId = 1;

            admin = accounts[0]
            auctionDeployer = accounts[5]
            firstBidder = accounts[6]
            secondBidder = accounts[7]

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
                let result = await mintContractInstance.mintNft(auctionInstance.address, { from: accounts[4] })
            } catch (error) {
                assert.equal(error.reason, "Only the beneficiary can transfer the token into the auction.")
            }

            // Successfully transfer
            try {
                let result = await mintContractInstance.mintNft(auctionInstance.address, { from: auctionDeployer })
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
                assert.equal(error.reason, "The bid has to be higher than the specified starting bid.")
            }
        })
    
        it("bid fails due to the beneficiary bidding in their own auction.", async () => {
            try {
                const bidAmount = web3.utils.toWei("2", "ether");
                await auctionInstance.bid({ from: auctionDeployer, value: bidAmount });
            } catch (error) {
                assert.equal(error.reason, "You cannot bid on your own auction.");
            }
        })
    
        it("successfully bids.", async () => {
            const bidAmount = web3.utils.toWei("2", "ether");
            await auctionInstance.bid({ from: firstBidder, value: bidAmount });
            
            const highestBid = await auctionInstance.highestBid.call();
            const highestBidder = await auctionInstance.highestBidder.call();
            // const pendingReturns = await auctionInstance.pendingReturns.call(highestBidder);
        
            assert.equal(highestBid, bidAmount, "The bid not registered as the highest bid amount.");
            assert.equal(highestBidder, firstBidder, "The highest bidder is incorrect.");
            // assert.equal(pendingReturns, 0, "Incorrect bid amount in pending returns."); // change pendingReturns to public
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
                assert.equal(error.reason, "Only the beneficiary can transfer the token into the auction.");
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
                assert.equal(error.reason, "Auction bidding time has not expired.");
            }
        
            // trying to transfer the token before the time expired
            try {
                await auctionInstance.transferToken({ from: secondBidder });
            } catch (error) {
                assert.equal(error.reason, "Bidding time has not expired.");
            }
        
            const advancement = 600;
            const newBlock = await helper.advanceTimeAndBlock(advancement);
            const originalBlock = web3.eth.getBlock('latest');
            const timeDiff = newBlock.timestamp - originalBlock.timestamp;
        
            // trying to transfer the token before the auction ended
            try {
                await auctionInstance.transferToken({ from: accounts[1] });
            } catch (error) {
                assert.equal(error.reason, "Auction has not yet ended.");
            }
        
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
                await auctionInstance.getTheHighestBid({ from: accounts[5] });
            } catch (error) {
                assert.equal(error.reason, "You are not the beneficiary");
            }
        
            // const balanceBefore = await 
            try {
                await auctionInstance.getTheHighestBid({ from: auctionDeployer });
            } catch (error) {
                console.log(error)
            }
            
            
        })
    
        it("transferring the token", async () => {
            // const owner = await auctionInstance.nftContract.ownerOf(initialTokenId)
            // console.log("owner", owner)

            // console.log("acc0", accounts[0])
            // console.log("acc1", accounts[1])
            // console.log("acc2", accounts[2])
            // console.log("acc3", accounts[3])

        //   try {
        //     await auctionInstance.transferToken({ from: accounts[3] });
        //   } catch (error) {
        //     assert.equal(error.reason, "You are not the highest bidder");
        //   }
    
        //   try {
        //     let tx = await auctionInstance.transferToken({ from: accounts[2] });
        //     console.log("tx", tx)
        //     assert.isTrue(tx.receipt.status)
        //   } catch (error) {
        //     console.log("final error", error)
        //   }
        })
  })

  // describe("No bidding", async () => {
  //   let noBidAuctionInstance, startingBidInput;

  //   beforeEach(async () => {
  //     startingBidInput = web3.utils.toWei("1", "ether");
  //     noBidAuctionInstance = await Auction.deployed(10, startingBidInput, { from: accounts[0] });
  //   })

  //   it("transfer of token by the beneficiary", async () => {
  //     const advancement = 600;
  //     await helper.advanceTimeAndBlock(advancement);

  //     let tx = await noBidAuctionInstance.auctionEnd({ from: accounts[0] });
  //     // let tx = await auctionInstance2.transferToken({ from: accounts[0] });
  //     // console.log("tx", tx);
  //     console.log("status", tx.receipt.status)
  //   })
  // })
});



// contract("Auction", (accounts) => {
//   describe("One or more bidding", async() => {
//     let auctionInstance, startingBidInput;

//     beforeEach(async () => {
//       startingBidInput = web3.utils.toWei("1", "ether");
//       auctionInstance = await Auction.deployed(10, startingBidInput);
//     })

//     it("End auction", async () => {
//       const advancement = 600;
//       await helper.advanceTimeAndBlock(advancement);

//       let tx = await auctionInstance.auctionEnd({ from: accounts[0] });
//       assert.isTrue(tx.receipt.status, "auctionEnded status is not true");
//     })
//   })

//   describe("No bidding", async() => {
//     let noBidAuctionInstance, startingBidInput2;

//     beforeEach(async () => {
//       startingBidInput2 = web3.utils.toWei("1", "ether");
//       noBidAuctionInstance = await Auction.deployed(10, startingBidInput2);
//     })

//     it("End no bid auction", async () => {
//       const advancement = 600;
//       await helper.advanceTimeAndBlock(advancement);

//       let tx = await noBidAuctionInstance.auctionEnd({ from: accounts[0] });
//       assert.isTrue(tx.receipt.status, "auctionEnded status is not true");
//     })
//   })
// })