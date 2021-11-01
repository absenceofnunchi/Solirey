const escrow = artifacts.require("Escrow");
const helper = require("./helpers/truffleTestHelper");
const { toBN } = web3.utils;

contract("Escrow", (accounts) => {
    let contract, admin, initialBuyer, initialSeller, initialValue, id, tokenId, commissionRate;
    before(async () => {
        admin = accounts[0];
        initialSeller = accounts[1];
        initialBuyer = accounts[2];
        initialValue = web3.utils.toWei("2", "ether");
        commissionRate = 2

        contract = await escrow.deployed({ from: admin });
    });

    it("Create an escrow", async () => {
        // Create an escrow with an uneven value
        try {
            await contract.createEscrow({ from: initialSeller, value: web3.utils.fromWei("1", "ether") });
        } catch (error) {
            assert.equal(error.reason, "Value has to be even")
        }

        let result;
        try {
            result = await contract.createEscrow({ from: initialSeller, value: initialValue });
        } catch (error) {
            console.log(error)
        }

        id = result.logs[0].args["2"].toString()

        assert.isTrue(result.receipt.status, "The escrow creation transaction should succeed.")
        assert.equal(id, 1, "Incorrect unique ID.");
        
        const escrowInfo = await getEscrowInfo(result.logs[0].args["2"].toString());
        const value = escrowInfo["value"]
        const seller = escrowInfo["seller"]
        const buyer = escrowInfo["buyer"]
        const state = escrowInfo["state"]
        const _tokenId = escrowInfo["tokenId"]     

        tokenId = _tokenId

        const artist = await contract._artist(tokenId)

        assert.equal(value, initialValue / 2, "Incorrect value.")
        assert.equal(seller, initialSeller, "Incorrect seller.")
        assert.equal(buyer, "0x0000000000000000000000000000000000000000", "Incorrect buyer.")
        assert.equal(state.toString(), 0, "Incorrect state.")
        assert.equal(artist, initialSeller, "Incorrect original artist.")
    })

    it("Successfully abort", async () => {
        try {
            await contract.abort(id, { from: initialBuyer })
        } catch (error) {
            assert.equal(error.reason, "Unauthorized")
        }

        const balanceBefore = await web3.eth.getBalance(initialSeller)
        let result;
        try {
            result = await contract.abort(id, { from: initialSeller })
        } catch (error) {
            console.log(error)
        }
        const balanceAfter = await web3.eth.getBalance(initialSeller)

        const diff = toBN(balanceAfter).sub(toBN(balanceBefore))
        const totalGasCost = await helper.getTotalGasCost(result)
        const finalValue = toBN(diff).add(toBN(totalGasCost))

        const escrowInfo = await getEscrowInfo(id);
        const value = escrowInfo["value"]
        const state = escrowInfo["state"]

        assert.isTrue(result.receipt.status, "The abort transaction should be successful.")
        assert.equal(state.toString(), 2, "The state should be inactive.")
        assert.equal(finalValue.toString(), initialValue, "The retrieved value after aborting should equal the initial value.")
        assert.equal(value * 2, initialValue, "The value stored in the escrow info should be half the initial value.")
    })

    it("Unsuccessfully execute confirmReceived before purchasing", async() => {
        try {
            await contract.confirmReceived(id, { from: initialBuyer })
        } catch (error) {
            assert.equal(error.reason, "Invalid state")
        }
    })

    it("Confirm purchase by a buyer", async () => {
        let result;
        try {
            result = await contract.createEscrow({ from: initialSeller, value: initialValue });
        } catch (error) {
            console.log(error)
        }

        id = result.logs[0].args["2"].toString()

        assert.isTrue(result.receipt.status, "The escrow creation transaction should succeed.")
        assert.equal(id, 2, "Incorrect unique ID.");
        
        const escrowInfo = await getEscrowInfo(result.logs[0].args["2"].toString());
        const value = escrowInfo["value"]
        const seller = escrowInfo["seller"]
        const buyer = escrowInfo["buyer"]
        const state = escrowInfo["state"]
        const _tokenId = escrowInfo["tokenId"]     

        tokenId = _tokenId

        const artist = await contract._artist(tokenId)

        assert.equal(value, initialValue / 2, "Incorrect value.")
        assert.equal(seller, initialSeller, "Incorrect seller.")
        assert.equal(buyer, "0x0000000000000000000000000000000000000000", "Incorrect buyer.")
        assert.equal(state.toString(), 0, "Incorrect state.")
        assert.equal(artist, initialSeller, "Incorrect original artist.")

        try {
            await contract.confirmPurchase(id, { from: initialBuyer, value: web3.utils.fromWei("1", "ether") })
        } catch (error) {
            assert.equal(error.reason, "Wrong payment amount")
        }

        const balanceBefore = await web3.eth.getBalance(initialBuyer)
        let purchaseResult;
        try {
            purchaseResult = await contract.confirmPurchase(id, { from: initialBuyer, value: initialValue })
        } catch (error) {
            console.log(error)
        }
        const balanceAfter = await web3.eth.getBalance(initialBuyer)

        const escrowInfo2 = await getEscrowInfo(result.logs[0].args["2"].toString());
        const newBuyer = escrowInfo2["buyer"]
        const newState = escrowInfo2["state"]

        const diff = toBN(balanceBefore).sub(toBN(balanceAfter))
        const totalGasCost = await helper.getTotalGasCost(purchaseResult) 
        const finalValue = diff.sub(toBN(totalGasCost))

        assert.isTrue(purchaseResult.receipt.status, "The purchase transaction should be true.")
        assert.equal(newBuyer, initialBuyer, "Incorrectly registered buyer.")
        assert.equal(newState.toString(), 1, "The state should indicate Locked.")
        assert.equal(finalValue.toString(), initialValue, "The amount paid is incorrect.")
    })

    it("Unsuccessfully abort", async () => {
        try {
            await contract.abort(id, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Invalid state")
        }
    })

    it("Transferred a token", async () => {
        const initialOwner = await contract.ownerOf(tokenId)

        let result;
        try {
            result = await contract.transferFrom(initialSeller, initialBuyer, tokenId, { from: initialSeller })
        } catch (error) {
            console.log(error)
        }
        const nextOwner = await contract.ownerOf(tokenId)
        
        assert.isTrue(result.receipt.status, "The token transfer transaction should succeed.")
        assert.equal(initialOwner, initialSeller, "The owner of the token should be the initial seller.")
        assert.equal(nextOwner, initialBuyer, "The owner of the token should be the initial buyer.")
    })

    it("Confirm receiving", async () => {
        // Attempt buy an unauthorized account
        try {
            await contract.confirmReceived(id, { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Unauthorized")
        }

        const artist = await contract._artist(tokenId)
        const artistBalanceBefore = await web3.eth.getBalance(artist)
        const buyerBalanceBefore = await web3.eth.getBalance(initialBuyer)

        // Successfully receive
        let result; 
        try {
            result = await contract.confirmReceived(id, { from: initialBuyer })
        } catch (error) {
            assert.equal(error.reason, "Unauthorized")
        }

        const artistBalanceAfter = await web3.eth.getBalance(artist)
        const buyerBalanceAfter = await web3.eth.getBalance(initialBuyer)
        
        const escrowInfo = await getEscrowInfo(id)
        const state = escrowInfo["state"]
        const value = escrowInfo["value"]

        // Calculate what the fee is supposed to be.
        const fee = toBN(initialValue).div(toBN(commissionRate)).mul(toBN(2)).div(toBN(100))

        // Calculate the total gas.
        const totalGasCost = await helper.getTotalGasCost(result)

        // Calculate the artist fee.
        const artistFee = toBN(value).mul(toBN(commissionRate)).div(toBN(100))

        // Calculate the seller fee (the admin fee has to be subtracted, which is the same as the artist fee)
        const sellerFee = toBN(value).mul(toBN(3)).sub(toBN(artistFee)).sub(toBN(artistFee))

        // Seller and the artist are the same since it's the first post
        const totalSellerAndArtistFee = sellerFee.add(toBN(artistFee))

        // How much is the artist actually left with
        const artistDiff = toBN(artistBalanceAfter).sub(toBN(artistBalanceBefore))

        // Calculate what the net difference of the buyer's balance is supposed to be
        const buyerFee = toBN(value).sub(toBN(totalGasCost))

        // Calculate the balance decrease of the buyer in total
        const buyerDiff = toBN(buyerBalanceAfter).sub(toBN(buyerBalanceBefore))

        assert.isTrue(result.receipt.status)
        assert.equal(state.toString(), 2, "The state should be Invalid.")
        assert.equal(fee.toString(), artistFee.toString(), "Incorrect artist royalty.")
        assert.equal(artistDiff.toString(), totalSellerAndArtistFee.toString(), "Incorrect artist/seller balance.")
        assert.equal(buyerFee.toString(), buyerDiff.toString(), "Incorrect buyer balance.")
    })

    it("Unsuccesssful re-entry attempt at confirmReceived", async () => {
        // Re-entry attempt
        try {
            result = await contract.confirmReceived(id, { from: initialBuyer })
        } catch (error) {
            assert.equal(error.reason, "Invalid state")
        }
    })

    it("Resell", async () => {
        // Unauthorized reselling
        try {
            await contract.resell(tokenId, { from: initialSeller, value: initialValue })
        } catch (error) {
            assert.equal(error.reason, "Unauthorized")
        } 

        try {
            await contract.resell(tokenId, { from: initialBuyer, value: web3.utils.toWei("1", "ether") })
        } catch (error) {
            assert.equal(error.reason, "Value has to be even")
        } 

        let result;
        try {
            result = await contract.resell(tokenId, { from: initialBuyer, value: initialValue })
        } catch (error) {
            assert.equal(error.reason, "Unauthorized")
        } 

        id = result.toString()
        const escrowInfo = await getEscrowInfo("4")
        const value = escrowInfo["value"]
        const seller = escrowInfo["seller"]
        const storedTokenId = escrowInfo["tokenId"]

        assert.equal(value.toString(), toBN(initialValue).div(toBN(2)), "Incorrect value in EscrowInfo")
        assert.equal(seller.toString(), initialBuyer.toString(), "Incorrect seller")
        assert.equal(storedTokenId.toString(), tokenId.toString(), "Wrong token ID")
    })

    it("Abort the resell", async () => {
        try {
            await contract.abort("4", { from: initialSeller })
        } catch (error) {
            assert.equal(error.reason, "Unauthorized")
        }

        const balanceBefore = await web3.eth.getBalance(initialBuyer)
        let result;
        try {
            result = await contract.abort("4", { from: initialBuyer })
        } catch (error) {
            console.log(error)
        }
        const balanceAfter = await web3.eth.getBalance(initialBuyer)

        const diff = toBN(balanceAfter).sub(toBN(balanceBefore))
        const totalGasCost = await helper.getTotalGasCost(result)
        const finalValue = toBN(diff).add(toBN(totalGasCost))

        const escrowInfo = await getEscrowInfo("4");
        const value = escrowInfo["value"]
        const state = escrowInfo["state"]

        // assert.isTrue(result.receipt.status, "The abort transaction should be successful.")
        assert.equal(state.toString(), 2, "The state should be inactive.")
        assert.equal(finalValue.toString(), initialValue, "The retrieved value after aborting should equal the initial value.")
        assert.equal(value * 2, initialValue, "The value stored in the escrow info should be half the initial value.")
    })

    getEscrowInfo = async (id) => {
        const escrowInfo = await contract._escrowInfo(id);
        return escrowInfo
    }
})