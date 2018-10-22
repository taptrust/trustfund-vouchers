var VouchersRegistry = artifacts.require("./VouchersRegistry.sol");

module.exports = function(deployer) {
  deployer.deploy(VouchersRegistry);
};
