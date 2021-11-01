const solirey = artifacts.require("Solirey");
const mintContract = artifacts.require("MintContract");
const simplePaymentDigital = artifacts.require("SimplePaymentDigital");
const simplePaymentTangible = artifacts.require("SimplePaymentTangible");
const auction = artifacts.require("Auction");
const escrow = artifacts.require("Escrow");

module.exports = function(deployer, _, accounts) {
    const admin = accounts[0];
    deployer.deploy(solirey, { from: admin });
    deployer.deploy(mintContract);
    deployer.deploy(auction);
    deployer.deploy(escrow, { from: admin });
    deployer.deploy(simplePaymentDigital, { from: admin });
    deployer.deploy(simplePaymentTangible, { from: admin });
}