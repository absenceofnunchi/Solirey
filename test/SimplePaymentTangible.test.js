const simplePayment = artifacts.require("SimplePaymentTangible");
const helper = require("./helpers/truffleTestHelper");
const { toBN } = web3.utils;

contract("Simple Payment for Tangible", (accounts) => {
    let contract, admin, initialBuyer, initialSeller, initialValue, id, tokenId, commissionRate, secondBuyer;
    before(async () => {
        admin = accounts[0];
        initialSeller = accounts[1];
        initialBuyer = accounts[2];
        secondBuyer = accounts[3];
        initialValue = web3.utils.toWei("1", "ether");
        commissionRate = 2;

        contract = await simplePayment.deployed({ from: admin });
    });

    it("Create simple payment", async () => {
        try {
            await contract.createPayment(0, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Wrong price")
        }

        let result;
        try {
            result = await contract.createPayment(initialValue, { from: initialSeller })
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

        tokenId = result.logs[1].args["tokenId"].toString()
        const owner = await contract.ownerOf(tokenId)

        assert.equal(owner, contract.address, "The owner of the current token ID should be identical to the initial seller.")
        assert.equal(payment.toString(), 0, "Payment should be zero.")
        assert.equal(price.toString(), initialValue.toString())
        assert.equal(fee.toString(), 0)
        assert.equal(fetchedTokenId.toString(), tokenId.toString())
        assert.equal(seller, initialSeller)
    })

    it("Unsuccessfully attempt to resell" , async () => {
        try {
            await contract.resell(initialValue, tokenId, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "ERC721: transfer caller is not owner nor approved")
        }
    })

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
        const expectedPayment = toBN(initialValue).sub(toBN(expectedFee))

        // const onSale = await contract._forSale(tokenId);
        const owner = await contract.ownerOf(tokenId)

        // assert.isFalse(onSale, "The onSale for the current token ID should be false.")
        assert.equal(owner, initialBuyer, "The owner of the current token ID should be identical to the initial seller.")
        assert.equal(payment.toString(), expectedPayment.toString())
        assert.equal(price.toString(), 0, "The price should be set to 0 after the payment is made.")
        assert.equal(fee.toString(), expectedFee.toString())
        assert.equal(fetchedTokenId.toString(), tokenId.toString())
        assert.equal(seller.toString(), initialSeller.toString())
        assert.equal(finalDiff.toString(), initialValue.toString())
    })

    it("Withdraw", async () => {
        const simplePayment = await contract._simplePayment(id)
        const initialPayment = simplePayment["payment"]
        const price = simplePayment["price"]
        const fee = simplePayment["fee"]

        const expectedPayout = toBN(initialValue).sub(toBN(fee))
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
            assert.equal(error.reason, "Already withdrawn")
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
        try {
            result = await contract.resell(initialValue, tokenId, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "ERC721: transfer caller is not owner nor approved")
        }

        // The pricing has to be greater than 0
        try {
            result = await contract.resell(0, tokenId, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Wrong pricing")
        }

        let result;
        try {
            result = await contract.resell(initialValue, tokenId, { from: initialBuyer })
        } catch (error) {
            console.log(error)
        }

        tokenId = result.logs[1].args["tokenId"].toString()
        id = result.logs[2].args["id"].toString()        

        const simplePayment = await contract._simplePayment(id)
        const payment = simplePayment["payment"]
        const price = simplePayment["price"]
        const fee = simplePayment["fee"]
        const fetchedTokenId = simplePayment["tokenId"]
        const seller = simplePayment["seller"]

        const owner = await contract.ownerOf(tokenId)
        const artist = await contract._artist(tokenId)

        assert.equal(owner, contract.address, "The owner of the current token ID should be identical to the initial seller.")
        assert.equal(payment.toString(), 0, "Payment should be zero.")
        assert.equal(price.toString(), initialValue.toString())
        assert.equal(fee.toString(), 0)
        assert.equal(fetchedTokenId.toString(), tokenId.toString())
        assert.equal(seller, initialBuyer)
    })

    it("Abort", async () => {
        try {
            let result = await contract.createPayment(initialValue, { from: secondBuyer })
            id = result.logs[0].args["id"].toString()
            tokenId = result.logs[1].args["tokenId"].toString()
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

        const owner = await contract.ownerOf(tokenId)
        assert.equal(owner, secondBuyer, "The token has been transferred to the wrong owner.")

        try {
            let result = await contract.resell(initialValue, tokenId, { from: secondBuyer })
            // id = result.logs[1].args["id"].toString()
        } catch (error) {
            console.log(error)
        }

        const newOwner = await contract.ownerOf(tokenId)
        assert.equal(newOwner, contract.address, "The token has been transferred to the wrong owner.")
    })
})