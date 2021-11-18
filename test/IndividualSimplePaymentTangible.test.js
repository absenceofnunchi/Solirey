const individualSimplePaymentTangible = artifacts.require("IndividualSimplePaymentTangible");
const mintContract = artifacts.require("MintContract")
const helper = require("./helpers/truffleTestHelper");
const { toBN } = web3.utils;

contract('IndividualSimplePaymentTangible', (accounts) => {
  let contract, priceInput, initialSeller, initialBuyer, admin;
  before(async function () {
    admin = accounts[0];
    initialSeller = accounts[1];
    initialBuyer = accounts[2];
    priceInput = web3.utils.toWei("1", "ether");    
    contract = await individualSimplePaymentTangible.deployed(priceInput, admin, { from: initialSeller });
    mintContractInstance = await mintContract.deployed({ from: admin })
  });

  it('Property initialization.', async () => {
    const seller = await contract.seller.call();
    const price = await contract.price.call()
    const paid = await contract.paid.call()

    assert.equal(seller, initialSeller, "The seller is incorrect.");
    assert.equal(price, priceInput, "The price for the item is incorrect.")
    assert.equal(paid, false, "The paid variable should be false.")
  });

  it("Successfully transfer a token into the contract", async () => {
    // Attempt to pay before the token has been transferred.
    try {
      await contract.pay({ from: initialBuyer, value: priceInput });
    } catch (error) {
        assert.equal(error.reason, "Token not added yet")
    }

    // Attempt to transfer a token into the aucton by a non-beneficiary.
    try {
        await mintContractInstance.mintNft(contract.address, { from: accounts[4] })
    } catch (error) {
        assert.equal(error.reason, "Unauthorized")
    }

    // Successfully transfer
    try {
        await mintContractInstance.mintNft(contract.address, { from: initialSeller })
    } catch (error) {
        console.log("error", error)
    }

    // Attempt to transfer a token into the contract from an unknown contract, but only after a token has already been transferred.
    let initialTokenId = 2;
    try {
        await contract.onERC721Received(
            accounts[4],
            accounts[0],
            initialTokenId,
            [0x01, 0x02],
            { from: initialSeller }
        )
    } catch (error) {
        assert.equal(error.reason, "Already has a token")
    }

    const tokenId = await contract.tokenId.call();
    const seller = await contract.seller.call();
    const tokenAdded = await contract.tokenAdded.call();

    assert.equal(tokenId.toNumber(), 1, "The token ID is incorrect.");
    assert.equal(seller, initialSeller, "Only the seller can transfer the token");
    assert.isTrue(tokenAdded, "The tokenAdded variable is not set to true.");
  });

  it("check the ownership of the token", async () => {
    const tokenId = await contract.tokenId.call();
    const ownerAddress = await mintContractInstance.ownerOf(tokenId.toNumber(), { from: initialSeller} );
    
    assert.equal(ownerAddress, contract.address, "The owner of the token ID should be the simple payment contract")
  })

  it("Successfully pay for the item", async () => {
    const wrongPriceInput = web3.utils.toWei("2", "ether");

    // Paying with a wrong price
    try {
      await contract.pay({ from: initialBuyer, value: wrongPriceInput });
    } catch(e) {
      assert.equal(e.reason, "Incorrect price.", "Doesn't catch the wrong payment amount.")
    }

    // Successfully pay
    try {
      await contract.pay({ from: initialBuyer, value: priceInput });
    } catch (e) {
        console.log(e)
    }

    // Unsuccessfully because paying twice
    try {
      await contract.pay({ from: initialBuyer, value: priceInput });
    } catch (error) {
        assert.equal(error.reason, "Already paid")
    }

    const tokenId = await contract.tokenId.call();
    const ownerAddress = await mintContractInstance.ownerOf(tokenId.toNumber(), { from: initialSeller} );
    const paid = await contract.paid.call() 
    const info = await contract.getInfo.call()
    const payment = info[5]
    const fee = info[6]

    const expectedFee = toBN(priceInput).mul(toBN(2)).div(toBN(100))
    const expectedPayment = toBN(priceInput).sub(toBN(expectedFee))

    assert.isTrue(paid, "The paid property is not toggled to true.")
    assert.equal(fee.toString(), expectedFee.toString(), "Incorrect fee amount")
    assert.equal(payment.toString(), expectedPayment.toString(), "Incorrect payment amount has been paid.")
    assert.equal(ownerAddress, initialBuyer, "Wrong account for the new token ownership.")
  })

  it("Successfully withdraws", async () => {
    // Unsuccessfully withdraw by an unauthorized user
    try {
      await contract.withdraw({ from: initialBuyer });
    } catch(error) {
      assert.equal(error.reason, "Unauthorized")
    }

    const balanceBefore = await web3.eth.getBalance(initialSeller)
    const adminBalanceBefore = await web3.eth.getBalance(admin)

    // Successfully withdraw
    let result;
    try {
      result = await contract.withdraw({ from: initialSeller });
    } catch(e) {
      console.log(e);
    }
     
    const totalGasCost = await helper.getTotalGasCost(result)
    const balanceAfter = await web3.eth.getBalance(initialSeller)
    const adminBalanceAfter = await web3.eth.getBalance(admin)
    // Actual seller payout
    const sellerBalanceDiff = toBN(balanceAfter).sub(toBN(balanceBefore)).add(toBN(totalGasCost))
    // Actual admin payout
    const adminBalanceDiff = toBN(adminBalanceAfter).sub(toBN(adminBalanceBefore))

    // const info = await contract.getInfo.call()
    // const payment = info[5]
    // const fee = info[6]
    const expectedAdminFee = toBN(priceInput).mul(toBN(2)).div(toBN(100))
    const expectedSellerBalance = toBN(priceInput).sub(toBN(expectedAdminFee))

    assert.equal(sellerBalanceDiff.toString(), expectedSellerBalance.toString(), "Fund not withdrawn properly.")
    assert.equal(adminBalanceDiff.toString(), expectedAdminFee.toString(), "Incorrect admin fee.")

    // Unsuccesfully try to withdraw twice
    try {
      result = await contract.withdraw({ from: initialSeller });
    } catch(error) {
      assert.equal(error.reason, "Already withdrawn")
    }
  })

  it("Unsuccesfully abort.", async () => {
    try {
      await contract.abort({ from: initialBuyer })
    } catch (error) {
      assert.equal(error.reason, "Unauthorized")
    }

    try {
      await contract.abort({ from: initialSeller })
    } catch (error) {
      assert.equal(error.reason, "Already purchased")
    }

    const tokenId = await contract.tokenId.call();
    const ownerAddress = await mintContractInstance.ownerOf(tokenId.toNumber());

    assert.equal(ownerAddress, initialBuyer, "Incorrect ownership of the token.")
  })
});