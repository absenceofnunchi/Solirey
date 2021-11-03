const mintContract = artifacts.require("MintContract");

contract("Minting Contract", (accounts) => {
    let contract, admin, minter, receiver, tokenId, toAddress;
    before(async () => {
        admin = accounts[0];
        minter = accounts[1];
        receiver = accounts[2];
        contract = await mintContract.deployed({ from: admin });
    })

    it("Mint a new token", async () => {
        let result;
        try {
            result = await contract.mintNft(receiver, { from: minter})
        } catch (error) {
            console.log(error)
        }

        tokenId = result.logs[0].args["tokenId"];
        toAddress = result.logs[0].args["to"];

        assert.equal(tokenId.toString(), 1, "Incorrect tokenId")
        assert.equal(toAddress.toString(), receiver, "The token has been minted to an incorrect address.")
    })
})