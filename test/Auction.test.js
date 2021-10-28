const auction = artifacts.require("Auction");

contract("Auction", (accounts) => {
    let contract, admin;
    before(async () => {
        admin = accounts[0];
        contract = await auction.deployed({ from: admin });
    })

    it("Successfully deployed.", async () => {

    });
})