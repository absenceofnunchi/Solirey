const solirey = artifacts.require("Solirey");
const mintContract = artifacts.require("MintContract");
const simplePaymentDigital = artifacts.require("SimplePaymentDigital");
const simplePaymentTangible = artifacts.require("SimplePaymentTangible");
const individualSimplePaymentTangible = artifacts.require("IndividualSimplePaymentTangible");
const auction = artifacts.require("Auction");
const escrow = artifacts.require("Escrow");
const individualAuction = artifacts.require("IndividualAuction");

module.exports = function(deployer, _, accounts) {
    const admin = accounts[0];
    const initialSeller = accounts[1];
    const priceInput = web3.utils.toWei("1", "ether");    

    deployer.deploy(solirey, { from: admin })
    .then(() => {
        deployer.deploy(auction, solirey.address, { from: admin })
        deployer.deploy(escrow, solirey.address, { from: admin });
        deployer.deploy(simplePaymentDigital, solirey.address, { from: admin });
        deployer.deploy(simplePaymentTangible, solirey.address, { from: admin });
    })

    deployer.deploy(mintContract, { from: admin });
    deployer.deploy(individualSimplePaymentTangible, priceInput, admin, { from: initialSeller })
    const startingBid = web3.utils.toWei("1", "ether");
    deployer.deploy(individualAuction, 300, startingBid, admin, { from: accounts[5] });
}