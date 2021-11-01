const solirey = artifacts.require("Solirey");
// const mintContract = artifacts.require("MintContract");
// const simplePayment = artifacts.require("SimplePayment");
// const auction = artifacts.require("Auction");
// const escrow = artifacts.require("Escrow");
const simplePayment = artifacts.require("SimplePayment");

module.exports = function(deployer, _, accounts) {
    const admin = accounts[0];
    deployer.deploy(solirey, { from: admin });
    // deployer.deploy(mintContract);
    // deployer.deploy(auction);
    // deployer.deploy(escrow, { from: admin });
    deployer.deploy(simplePayment, { from: admin });
}