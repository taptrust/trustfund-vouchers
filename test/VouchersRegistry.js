var VouchersRegistry = artifacts.require("VouchersRegistry.sol");

contract('VouchersRegistry', function(accounts) {
	it("should be owned by deploying account", async() => {
		let instance = await VouchersRegistry.deployed();
		let isOwner = await instance.isOwner.call();
		assert.isTrue(isOwner, "deploying address wasn't owner");
	});
	
	it("should let owner set contract status of accounts", async() => {
		let instance = await VouchersRegistry.deployed();
		let safeAccount = accounts[1];
		let unsafeAccount = accounts[2];
	
		await setupAccounts(instance, safeAccount, unsafeAccount);
	});
	
	it("should refund donors who add vouchers to unsafe accounts", async() => {
		let instance = await VouchersRegistry.deployed();
		let safeAccount = accounts[1];
		let unsafeAccount = accounts[2];
		let donorAccount = accounts[3];
		let randomAccount = accounts[3];
	
		await setupAccounts(instance, safeAccount, unsafeAccount);
		await donateToUnsafeAccountAndClaimRefund(instance, unsafeAccount, donorAccount);
		await donateToUnsafeAccountAndClaimRefund(instance, randomAccount, donorAccount);
	});
	
	it("should allow donations to safe accounts to be withdrawn by donor", async() => {
		let instance = await VouchersRegistry.deployed();
		let safeAccount = accounts[1];
		let unsafeAccount = accounts[2];
		let donorAccount = accounts[3];
		let randomAccount = accounts[3];
	
		await setupAccounts(instance, safeAccount, unsafeAccount);
		await donateToSafeAccountAndWithdrawBalance(instance, safeAccount, donorAccount); 
	});
});

var setupAccounts = async(instance, safeAccount, unsafeAccount) => {	
	let errorThrown = false;
	try
	{
		let ret = await instance.setContractStatus(safeAccount, "safetyCheckPassed", 0);
	} catch(error) {
		errorThrown = error instanceof  Error;
	}
	
	await instance.setContractStatus(safeAccount, "safetyCheckPassed", 1);
	await instance.setContractStatus(unsafeAccount, "safetyCheckFailed", 1);
	
	assert.isTrue(errorThrown, "allowed checkVersion of 0");
};

var donateToAccount = async(instance, beneficiaryAccount, donorAccount, amount) => {
	
	await instance.addContractVouchers(beneficiaryAccount, 1, {value: amount, from:donorAccount});
}

var donateToUnsafeAccountAndClaimRefund = async(instance, unsafeAccount, donorAccount) => {
	let ether = web3.toWei(1,'ether');
	
	await donateToAccount(instance, unsafeAccount, donorAccount, ether);
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await instance.claimRefundedEther({from:donorAccount});
	const gasUsed = receipt.receipt.gasUsed;
	
	const tx = await web3.eth.getTransaction(receipt.tx);
    const totalCost = tx.gasPrice.mul(gasUsed);
	
	let balance2 = web3.eth.getBalance(donorAccount);
	
	assert.deepEqual(balance1.add(ether).sub(totalCost), balance2);
};

var donateToSafeAccountAndWithdrawBalance = async(instance, safeAccount, donorAccount, amount) => {
	let ether = web3.toWei(1,'ether');
	
	await donateToAccount(instance, safeAccount, donorAccount, ether);
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await instance.withdrawContractVouchers(safeAccount, ether, {from:donorAccount});
	const gasUsed = receipt.receipt.gasUsed;
	
	const tx = await web3.eth.getTransaction(receipt.tx);
    const totalCost = tx.gasPrice.mul(gasUsed);
	
	let balance2 = web3.eth.getBalance(donorAccount);
	
	assert.deepEqual(balance1.add(ether).sub(totalCost), balance2);
};
