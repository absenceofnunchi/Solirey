const Auction = artifacts.require("IndividualAuction");
const mintContract = artifacts.require("MintContract");
const helper = require("./helpers/truffleTestHelper");

contract("Individual Auction with no bidding", (accounts) => {
  describe("No bidding", async () => {
    let contract, startingBidInput, auctionDeployer, mintContractInstance, admin;

    before(async () => {
        auctionDeployer = accounts[5]
        admin = accounts[0]

        startingBidInput = web3.utils.toWei("1", "ether");
        contract = await Auction.deployed(10, startingBidInput, { from: auctionDeployer });
        mintContractInstance = await mintContract.deployed({ from: admin })
    })

    it("transfer of token by the beneficiary", async () => {
        // Successfully transfer a token into the contract
        try {
            await mintContractInstance.mintNft(contract.address, { from: auctionDeployer })
        } catch (error) {
            console.log(error)
        }

        const advancement = 600;
        await helper.advanceTimeAndBlock(advancement);

        try {
            await contract.auctionEnd({ from: accounts[1] });
        } catch (error) {
            console.log(error)
        }

        const tokenId = await contract.tokenId.call();
        const previousOwner = await mintContractInstance.ownerOf(tokenId)

        // try {
        //     await contract.transferToken({ from: auctionDeployer });
        // } catch (error) {
        //     console.log(error)
        // }

        // const owner = await mintContractInstance.ownerOf(tokenId)

        // assert.equal(previousOwner, contract.address)
        // assert.equal(owner, auctionDeployer)
    })
  })
})
