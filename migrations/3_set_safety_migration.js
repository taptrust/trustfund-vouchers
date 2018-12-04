var VouchersRegistry = artifacts.require("./VouchersRegistry.sol");

const contract1 = "0xa1427b62e0c116a4feba4e9fec8269930cb5b5f0";
const contract2 = "0x46D69Aba7F54cA94375E14e91B1401f5e1717af4";
const contract3 = "0x4520aaeDCe6755aB1CAd316FF17147797e92b2C6";

const contracts = [contract1, contract2, contract3];

const SAFETY_CHECK_PASSED = "safetyCheckPassed";


module.exports = function(deployer) {

	VouchersRegistry.deployed().then(function(vouchersRegistryInstance) {
		setContractStatusToSafe(vouchersRegistryInstance, contracts, 0);
	})
};

function setContractStatusToSafe(vouchersRegistryInstance, contracts, index) {
	if(index < contracts.length) {
		vouchersRegistryInstance.setContractStatus(contracts[index], SAFETY_CHECK_PASSED, 1).then(function(result) {
			setContractStatusToSafe(vouchersRegistryInstance, contracts, index + 1);
		});
	}
}