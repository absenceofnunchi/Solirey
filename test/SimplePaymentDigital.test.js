const simplePayment = artifacts.require("SimplePaymentDigital");
const solirey = artifacts.require("Solirey");
const helper = require("./helpers/truffleTestHelper");
const { toBN } = web3.utils;

contract("Simple Payment #1", (accounts) => {
    let contract, solireyContract, admin, initialBuyer, secondBuyer, initialSeller, initialValue, id, tokenId, commissionRate;
    before(async () => {
        admin = accounts[0];
        initialSeller = accounts[1];
        initialBuyer = accounts[2];
        secondBuyer = accounts[3]
        initialValue = web3.utils.toWei("1", "ether");
        commissionRate = 2

        contract = await simplePayment.deployed({ from: admin });
        solireyContract = await solirey.deployed({ from: admin });
    });

    it("Create simple payment", async () => {
        try {
            await contract.createPayment(0, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Wrong price")
        }

        // Successfully create payment
        let result;
        try {
            result = await contract.createPayment(initialValue, { from: initialSeller })
            // Since the Transfer event is emitted by the Solirey contract, not the Simple Payment contract, the event has to be separately captured.
            const events = await solireyContract.getPastEvents("Transfer", {fromBlock: 0, toBlock: "latest"})
            for (let i = 0; i < events.length; i++) {
                const event = events[i]
                if (event.event == "Transfer") {
                    tokenId = event.returnValues.tokenId
                }
            }
        } catch (error) {
            console.log(error)
        }

        // Get the uid of the newly created token so that the revelant _simplePayment could be retrieved.
        id = result.logs[0].args["id"].toString()
        const simplePayment = await contract._simplePayment(id)
        const payment = simplePayment["payment"]
        const price = simplePayment["price"]
        const fee = simplePayment["fee"]
        const fetchedTokenId = simplePayment["tokenId"]
        const seller = simplePayment["seller"]

        // const onSale = await contract._forSale(tokenId);
        const owner = await solireyContract.ownerOf(tokenId)
        const artist = await solireyContract._artist(tokenId)

        // assert.isTrue(onSale, "The onSale for the current token ID should be true.")
        assert.equal(owner, contract.address, "The owner of the current token ID should be identical to the initial seller.")
        assert.equal(payment.toString(), 0, "Payment should be zero.")
        assert.equal(price.toString(), initialValue.toString())
        assert.equal(fee.toString(), 0)
        assert.equal(fetchedTokenId.toString(), tokenId.toString())
        assert.equal(seller, initialSeller)
        assert.equal(artist, initialSeller)

        try {
            await contract.withdraw(id, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Not authorized")
        }
    })

    // it("Unsuccessfully attempt to resell" , async () => {
    //     try {
    //         await contract.resell(initialValue, tokenId, { from: initialSeller })
    //     } catch (error) {
    //         assert.equal(error.reason, "ERC721: transfer of token that is not own")
    //     }
    // })

    it("Pay", async () => {
        // Unsuccessfully attempt to pay for an item that's not for sale
        try {
            await contract.pay(100, { from: initialBuyer, value: initialValue })
        } catch (error) {
            assert.equal(error.reason, "Not for sale")
        }

        // Unsuccessfully attempt to pay the wrong amount
        try {
            await contract.pay(id, { from: initialBuyer, value: 100 })
        } catch (error) {
            assert.equal(error.reason, "Incorrect price")
        }

        const balanceBeforeBuyer = await web3.eth.getBalance(initialBuyer)

        // Successfully pay
        let result;
        try {
            result = await contract.pay(id, { from: initialBuyer, value: initialValue })
        } catch (error) {
            console.log(error)
        }

        const simplePayment = await contract._simplePayment(id)
        const payment = simplePayment["payment"]
        const price = simplePayment["price"]
        const fee = simplePayment["fee"]
        const fetchedTokenId = simplePayment["tokenId"]
        const seller = simplePayment["seller"]

        const balanceAfterBuyer = await web3.eth.getBalance(initialBuyer)
        const diff = toBN(balanceBeforeBuyer).sub(toBN(balanceAfterBuyer))
        const totalGasCost = await helper.getTotalGasCost(result)
        const finalDiff = toBN(diff).sub(toBN(totalGasCost))

        // What the fee is supposed to be.
        const expectedFee = toBN(initialValue).mul(toBN(2)).div(toBN(100))
        const expectedPayment = toBN(initialValue).sub(toBN(expectedFee)).sub(toBN(expectedFee))

        // const onSale = await contract._forSale(tokenId);
        const owner = await solireyContract.ownerOf(tokenId)

        // assert.isFalse(onSale, "The onSale for the current token ID should be false.")
        assert.equal(owner, initialBuyer, "The owner of the current token ID should be identical to the initial seller.")
        assert.equal(payment.toString(), expectedPayment.toString())
        assert.equal(price.toString(), 0, "The price should be set to 0 after the payment is made.")
        assert.equal(fee.toString(), expectedFee.toString())
        assert.equal(fetchedTokenId.toString(), tokenId.toString())
        assert.equal(seller.toString(), initialSeller.toString())
        assert.equal(finalDiff.toString(), initialValue.toString())
    })

    it("Unsuccessfully abort", async () => {
        try {
            await contract.abort(id, { from: initialBuyer })
        } catch(error) {
            assert.equal(error.reason, "Unauthorized")
        }

        try {
            await contract.abort(id, { from: initialSeller })
        } catch(error) {
            assert.equal(error.reason, "Not for sale")
        }
    })

    it("Withdraw", async () => {
        const simplePayment = await contract._simplePayment(id)
        const initialPayment = simplePayment["payment"]
        const price = simplePayment["price"]
        const fee = simplePayment["fee"]

        const expectedPayout = toBN(initialValue).sub(toBN(fee)).sub(toBN(fee))
        assert.equal(initialPayment.toString(), expectedPayout.toString())
        assert.equal(price.toString(), 0)

        // Unauthorized account
        try {
            await contract.withdraw(id, { from: initialBuyer })
        } catch (error) {
            assert.equal(error.reason, "Not authorized")
        }

        const balanceBefore = await web3.eth.getBalance(initialSeller)
        let result;
        try {
            result = await contract.withdraw(id, { from: initialSeller })
        } catch (error) {
            console.log(error)
        }
        const balanceAfter = await web3.eth.getBalance(initialSeller)

        // Second attempt to withdraw which should fail
        try {
            await contract.withdraw(id, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Not authorized")
        }

        const totalGasCost = await helper.getTotalGasCost(result)
        const diff = toBN(balanceAfter).sub(toBN(balanceBefore))
        const expectedPayout2 = toBN(initialValue).sub(toBN(fee)).sub(toBN(totalGasCost))

        const simplePayment2 = await contract._simplePayment(id)
        const payment = simplePayment2["payment"]
        const price2 = simplePayment2["price"]

        assert.equal(payment.toString(), 0)
        assert.equal(price2.toString(), 0)
        assert.equal(diff.toString(), expectedPayout2.toString())
    })

    it("Withdraw Fee", async () => {
        try {
            await contract.withdrawFee(id, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Not authorized")
        }

        const balanceBefore = await web3.eth.getBalance(admin)
        let result;
        try {
            result = await contract.withdrawFee(id, { from: admin })
        } catch (error) {
            console.log(error)
        }
        const balanceAfter = await web3.eth.getBalance(admin)
        const simplePayment = await contract._simplePayment(id)
        const fee = simplePayment["fee"]

        const totalGasCost = await helper.getTotalGasCost(result)
        const diff = toBN(balanceAfter).sub(toBN(balanceBefore)).add(toBN(totalGasCost))
        
        assert.equal(diff.toString(), fee.toString())
    })

    it("Resell", async () => {
        // Attempt to sell by an unauthorized account
        // try {
        //     await contract.resell(initialValue, tokenId, { from: initialSeller })
        // } catch (error) {
        //     console.log(error)
        //     assert.equal(error.reason, "ERC721: transfer caller is not owner nor approved")
        // }

        // The pricing has to be greater than 0
        try {
            await contract.resell(0, tokenId, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Wrong pricing")
        }

        const owner1 = await solireyContract.ownerOf(tokenId)

        // Successfully resell
        let result;
        try {
            result = await contract.resell(initialValue, tokenId, { from: initialBuyer })
            const events = await solireyContract.getPastEvents("Transfer", {fromBlock: 0, toBlock: "latest"})
            for (let i = 0; i < events.length; i++) {
                const event = events[i]
                if (event.event == "Transfer") {
                    tokenId = event.returnValues.tokenId
                }
            }
        } catch (error) {
            console.log(error)
        }

        // Attempt to resell multiple times
        try {
            await contract.resell(initialValue, tokenId, { from: initialBuyer })
        } catch (error) {
            console.log(error)
            assert.equal(error.reason, "ERC721: transfer caller is not owner nor approved")
        }

        id = result.logs[0].args["id"].toString()        
        console.log("id", id)
        const simplePayment = await contract._simplePayment(id)
        const payment = simplePayment["payment"]
        const price = simplePayment["price"]
        const fee = simplePayment["fee"]
        const fetchedTokenId = simplePayment["tokenId"]
        const seller = simplePayment["seller"]

        const owner = await solireyContract.ownerOf(tokenId)
        const artist = await solireyContract._artist(tokenId)

        console.log("owner", owner)
        console.log("contract.address", contract.address)
        console.log("initialSeller", initialSeller)
        console.log("initialBuyer", initialBuyer)

        assert.equal(owner, contract.address, "The owner of the current token ID should be identical to the initial seller.")
        assert.equal(payment.toString(), 0, "Payment should be zero.")
        assert.equal(price.toString(), initialValue.toString())
        assert.equal(fee.toString(), 0)
        assert.equal(fetchedTokenId.toString(), tokenId.toString())
        assert.equal(seller, initialBuyer)
        assert.equal(artist, initialSeller)
    })

    it("Successfully complete the purchase transaction of the resell.", async () => {
        // Pay with a wrong amount
        try {
            await contract.pay(id, { from: secondBuyer, value: 100 })
        } catch (error) {
            assert.equal(error.reason, "Incorrect price")
        }

        const artist = await contract._artist(tokenId)
        const balanceBeforeBuyer = await web3.eth.getBalance(secondBuyer)
        const balanceBeforeArtist = await web3.eth.getBalance(artist)

        // Successfully pay
        let result;
        try {
            result = await contract.pay(id, { from: secondBuyer, value: initialValue })
        } catch (error) {
            assert.equal(error.reason, "ERC721: transfer caller is not owner nor approved")
        }

        const simplePayment = await contract._simplePayment(id)
        const payment = simplePayment["payment"]
        const price = simplePayment["price"]
        const fee = simplePayment["fee"]
        const fetchedTokenId = simplePayment["tokenId"]
        const seller = simplePayment["seller"]

        const balanceAfterBuyer = await web3.eth.getBalance(secondBuyer)
        const diff = toBN(balanceBeforeBuyer).sub(toBN(balanceAfterBuyer))
        const totalGasCost = await helper.getTotalGasCost(result)
        const finalDiff = toBN(diff).sub(toBN(totalGasCost))

        // What the fee is supposed to be.
        const expectedFee = toBN(initialValue).mul(toBN(2)).div(toBN(100))
        const expectedPayment = toBN(initialValue).sub(toBN(expectedFee)).sub(toBN(expectedFee))

        // Get the owner of the token after the purchase
        const owner = await solireyContract.ownerOf(tokenId)

        // Check the balance of the original artist before and after the payout
        const balanceAfterArtist = await web3.eth.getBalance(artist)
        const artistDiff = toBN(balanceAfterArtist).sub(toBN(balanceBeforeArtist))
        
        assert.equal(owner, secondBuyer, "The owner of the current token ID should be identical to the initial seller.")
        assert.equal(payment.toString(), expectedPayment.toString())
        assert.equal(price.toString(), 0, "The price should be set to 0 after the payment is made.")
        assert.equal(fee.toString(), expectedFee.toString())
        assert.equal(fetchedTokenId.toString(), tokenId.toString())
        assert.equal(seller.toString(), initialBuyer.toString(), "The seller should be the initial buyer since the buyer is reselling the token.")
        assert.equal(finalDiff.toString(), initialValue.toString(), "The final difference of the reseller's balance + the gas")
        assert.equal(artistDiff.toString(), 0, "The original artist payout has not been paid yet.")
        assert.equal(artist, initialSeller, "The original artist should be the initial seller that listed the item.")
    })

    it("Correctly attributes the original artist", async () => {
        // Attempt to withdraw by an unauthorized account
        try {
            await contract.withdraw(id, { from: secondBuyer })
        } catch (error) {
            assert.equal(error.reason, "Not authorized")
        }
    
        const artist = await contract._artist(tokenId)
        const artistBalanceBefore = await web3.eth.getBalance(artist)

        // Successfully withdraw
        try {
            await contract.withdraw(id, { from: initialBuyer })
        } catch (error) {
            console.log(error)
        }

        // Attempt to withdraw multiple times
        try {
            await contract.withdraw(id, { from: initialBuyer })
        } catch (error) {
            assert.equal(error.reason, "Not authorized")
        }
        
        // calculate the balance difference for the original artist
        const artistBalanceAfter = await web3.eth.getBalance(artist)
        const diff = toBN(artistBalanceAfter).sub(toBN(artistBalanceBefore))

        const simplePayment = await contract._simplePayment(id)
        const fee = simplePayment["fee"]

        assert.equal(diff.toString(), fee.toString(), "The fee received by the original artist from the resale should be the same as the predetermined commission rate.")
    })

    it("Abort", async () => {
        try {
            let result = await contract.createPayment(initialValue, { from: secondBuyer })
            id = result.logs[0].args["id"].toString()
        } catch (error) {
            console.log(error)
        }

        // Fail to abort
        try {
            await contract.abort(id, { from: initialSeller })
        } catch(error) {
            assert.equal(error.reason, "Unauthorized")
        }

        // Successfully abort
        try {
            await contract.abort(id, { from: secondBuyer })
        } catch(error) {
            console.log(error)
        }

        const owner = await solireyContract.ownerOf(tokenId)
        assert.equal(owner, secondBuyer, "The token has been transferred to the wrong owner.")

        try {
            let result = await contract.resell(initialValue, tokenId, { from: secondBuyer })
            // id = result.logs[1].args["id"].toString()
        } catch (error) {
            console.log(error)
        }

        const newOwner = await solireyContract.ownerOf(tokenId)
        assert.equal(newOwner, contract.address, "The token has been transferred to the wrong owner.")
    })
})

// cost 50
// gas 10
// before 100
// after 100 - 50 - 10 = 40
// diff = before - after = 100 - 40 = 60
// diff - gas = 60 - 10 = 50