const solirey = artifacts.require("Solirey");
const mintContract = artifacts.require("MintContract");
const simplePayment = artifacts.require("SimplePayment");
const auction = artifacts.require("Auction");

module.exports = function(deployer, _, accounts) {
    const admin = accounts[0];
    deployer.deploy(solirey, { from: admin });
    deployer.deploy(mintContract);
    deployer.deploy(simplePayment);
    deployer.deploy(auction);
}