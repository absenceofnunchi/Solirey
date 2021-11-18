const individualSimplePaymentTangible = artifacts.require("IndividualSimplePaymentTangible");
const mintContract = artifacts.require("MintContract")

contract('Abort IndividualSimplePaymentTangible', (accounts) => {
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

    it("Successfully abort.", async () => {
        // Successfully transfer
        try {
            await mintContractInstance.mintNft(contract.address, { from: initialSeller })
        } catch (error) {
            console.log("error", error)
        }

        try {
            await contract.abort({ from: initialBuyer })
        } catch (error) {
            assert.equal(error.reason, "Unauthorized")
        }

        try {
            await contract.abort({ from: initialSeller })
        } catch (error) {
            console.log(error)
        }

        const tokenId = await contract.tokenId.call();
        const ownerAddress = await mintContractInstance.ownerOf(tokenId.toNumber(), { from: initialSeller} );
    
        assert.equal(ownerAddress, initialSeller, "Incorrect ownership of the token.")
    })
})