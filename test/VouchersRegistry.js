var VouchersRegistry = artifacts.require("VouchersRegistry.sol");

contract('VouchersRegistry', function(accounts) {
	let safeAccount = accounts[1];
	let unsafeAccount = accounts[2];
	let donorAccount = accounts[3];
	let randomAccount = accounts[4];
	
	let instance = null;
		
	it("should be owned by deploying account", async() => {
		instance = await VouchersRegistry.deployed();
		let isOwner = await instance.isOwner.call();
		assert.isTrue(isOwner, "deploying address wasn't owner");
	});
	
	it("should let owner set contract status of accounts", async() => {
		await setupAccounts(instance, safeAccount, unsafeAccount);
	});
	
	it("should not let non-owners set contract status", async() => {
		await assertError(async() => {
			await instance.setContractStatus(safeAccount, "safetyCheckPassed", 1, {from:donorAccount});
		}, "allowed non-owner to set status");
	});
	
	it("should not allow donations to unsafe accounts", async() => {
		await donateToUnsafeAccountWithRequire(instance, unsafeAccount, donorAccount);
	});
	
	it("should allow donations to safe accounts, and allow them to be withdrawn by donor", async() => {
		await donateToSafeAccountAndWithdrawBalance(instance, safeAccount, donorAccount, donorAccount);
	});
	
	it("should not allow donations to be withdrawn by non-donor", async() => {
		await assertError(async() => {
			await donateToSafeAccountAndWithdrawBalance(instance, safeAccount, donorAccount, randomAccount);
		}, "allowed non-downer to withdraw donations");
	});
	
	//The following tests involve the removed refund functionality.
	/*it("should allow refund to donors who add vouchers to failed and unknown accounts", async() => {
		await donateToUnsafeAccountAndClaimRefund(instance, unsafeAccount, donorAccount);
		await donateToUnsafeAccountAndClaimRefund(instance, randomAccount, donorAccount);
	});
	
	it("should not refund donors who add vouchers to safe accounts", async() => {
		await donateToSafeAccountAndClaimRefund(instance, safeAccount, donorAccount);
	});*/
});

var assertError = async(func, message) => {
	let errorThrown = false;
	let error = null;
	
	try
	{
		await func();
	} catch(err) {
		error = err;
		errorThrown = err instanceof  Error;
	}
	
	assert.isTrue(errorThrown, message);
	
	return error;
}	

var setupAccounts = async(instance, safeAccount, unsafeAccount) => {
	
	await assertError(async() => {
		await instance.setContractStatus(safeAccount, "safetyCheckPassed", 0);
	}, "allowed checkVersion of 0");
	
	await instance.setContractStatus(safeAccount, "safetyCheckPassed", 1);
	await instance.setContractStatus(unsafeAccount, "safetyCheckFailed", 1);
};

var donateToAccount = async(instance, beneficiaryAccount, donorAccount, amount) => {
	
	await instance.addContractVouchers(beneficiaryAccount, 1, {value: amount, from:donorAccount});
}

var donateToUnsafeAccountWithRequire = async(instance, unsafeAccount, donorAccount) => {
	let ether = web3.toWei(1,'ether');
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await assertError(async() => {
			await instance.setContractStatus(unsafeAccount, "safetyCheckPassed", ether, {from:donorAccount});
		}, "allowed donation to unsafe account");
	
	let balance2 = web3.eth.getBalance(donorAccount);
	
	//Check to make sure that the difference between the starting value and the ending value is less than the amount sent. Indicating that the transaction was reverted.
	assert.isTrue(balance1.sub(balance2).toNumber() < ether, "value sent was not refunded");
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

var donateToSafeAccountAndClaimRefund = async(instance, safeAccount, donorAccount) => {
	let ether = web3.toWei(1,'ether');
	
	await donateToAccount(instance, safeAccount, donorAccount, ether);
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await instance.claimRefundedEther({from:donorAccount});
	const gasUsed = receipt.receipt.gasUsed;
	
	const tx = await web3.eth.getTransaction(receipt.tx);
    const totalCost = tx.gasPrice.mul(gasUsed);
	
	let balance2 = web3.eth.getBalance(donorAccount);
	
	assert.deepEqual(balance1.sub(totalCost), balance2);
};

var donateToSafeAccountAndWithdrawBalance = async(instance, safeAccount, donorAccount, withdrawingAccount, amount) => {
	let ether = web3.toWei(1,'ether');
	
	await donateToAccount(instance, safeAccount, donorAccount, ether);
	
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await instance.withdrawContractVouchers(safeAccount, ether, {from:withdrawingAccount});
	const gasUsed = receipt.receipt.gasUsed;
	
	const tx = await web3.eth.getTransaction(receipt.tx);
    const totalCost = tx.gasPrice.mul(gasUsed);
	
	let balance2 = web3.eth.getBalance(withdrawingAccount);
	
	assert.deepEqual(balance1.add(ether).sub(totalCost), balance2);
};
