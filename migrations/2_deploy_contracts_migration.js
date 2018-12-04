var VouchersRegistry = artifacts.require("./VouchersRegistry.sol");
var VouchersUser = artifacts.require("./VouchersUser.sol");
var BondingCurve = artifacts.require("./relevant-community/contracts/BondingCurve.sol");

module.exports = function(deployer) {
	deployer.deploy(VouchersRegistry).then(function() {
		deployer.deploy(VouchersUser, VouchersRegistry.address);
	});
	deployer.deploy(BondingCurve);
};