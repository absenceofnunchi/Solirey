const solirey = artifacts.require("Solirey");
const mintContract = artifacts.require("MintContract");
const simplePayment = artifacts.require("SimplePayment");
const auction = artifacts.require("Auction");

module.exports = function(deployer, _, _) {
    deployer.deploy(solirey);
    deployer.deploy(mintContract);
    deployer.deploy(simplePayment);
    deployer.deploy(auction);
}