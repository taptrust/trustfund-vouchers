var VouchersRegistry = artifacts.require("VouchersRegistry.sol");
var VouchersUser = artifacts.require("VouchersUser.sol");
var BondingCurve = artifacts.require("BondingCurve.sol");

var safeContract = null;
var unsafeContract = null;
var donorAccount = null;
var randomAccount = null;

var instance = null;
var user = null;
var token = null;

contract('VouchersRegistry', function(accounts) {
	donorAccount = accounts[1];
	randomAccount = accounts[2];
		
	it("should be owned by deploying account", async() => {
		instance = await VouchersRegistry.deployed();
		let isOwner = await instance.isOwner.call();
		assert.isTrue(isOwner, "deploying address wasn't owner");
	});
	
	it("should let owner set contract status of accounts", async() => {
		token = await BondingCurve.new();
		safeContract = token.address;
		
		let unsafeToken = await BondingCurve.new();
		unsafeContract = unsafeToken.address;
		
		await setupAccounts(instance, safeContract, unsafeContract);
	});
	
	it("should not let non-owners set contract status", async() => {
		await assertError(async() => {
			await instance.setContractStatus(safeContract, "safetyCheckPassed", 1, {from:donorAccount});
		}, "allowed non-owner to set status");
	});
	
	it("should not allow donations to unsafe accounts", async() => {
		await donateToUnsafeContractWithRequire(instance, unsafeContract, donorAccount);
	});
	
	it("should allow donations to safe accounts, and allow them to be withdrawn by donor", async() => {
		await donateTosafeContractAndWithdrawBalance(instance, safeContract, donorAccount, donorAccount);
	});
	
	it("should not allow donations to be withdrawn by non-donor", async() => {
		await assertError(async() => {
			await donateTosafeContractAndWithdrawBalance(instance, safeContract, donorAccount, randomAccount);
		}, "allowed non-downer to withdraw donations");
	});

	it("VoucherUser: should be owned by deploying account", async() => {
		user = await VouchersUser.new(instance.address);

		let isOwner = await user.isOwner.call();
		assert.isTrue(isOwner, "deploying address wasn't owner");
	});

	it("should let owner set accounts as identity verified", async() => {
		await instance.setAddressIdentityVerified(user.address, 1);
	});
	
	it("should not let non-owners set accounts as identity verified", async() => {
		await assertError(async() => {
			await instance.setAddressIdentityVerified(donorAccount, 1, {from:donorAccount});
		}, "allowed non-owner to set id verified");
	});
	
	it("should not allow non-verified user contracts to call redeemContractVouchers", async() => {
		await assertError(async() => {
			await instance.redeemContractVouchers(safeContract, donorAccount, 1, {from:randomAccount});
		}, "allow non-verified user contracts to call redeemContractVouchers");
	});

	it("VoucherUser: owner should be able to initiate redemption request", async() => {
		await user.requestContractVouchers(safeContract, donorAccount, 1000000);
		var balance = await token._balances.call(user.address);
		assert.isTrue(balance.toNumber() > 0, "Tokens not granted");
	});
	
	it("VoucherUser: should not be able to redeem greater than amount allowed per user", async() => {
		await assertError(async() => {
			await user.requestContractVouchers(safeContract, donorAccount, web3.toWei(1,'ether')/2);
		}, "allowed redemption of greater than single user limit");
	});
	
	it("should not have lingering state changes if insufficient gas is used for a transaction.", async() => {
		var voucherKey = await instance.getVoucherKey(donorAccount,safeContract); 
		var userKey = await instance.getUserKey(donorAccount, safeContract, user.address);
		var priorVoucherBalance = await instance.contractVouchersDonorBalance(voucherKey);
		var priorUserRedeemed = await instance.contractVouchersAddressRedeemed(userKey);
		
		await assertError(async() => {
			await user.requestContractVouchers(safeContract, donorAccount, 1000000, {gas:75000});
		}, "succeeded with insufficient gas?");
		
		var postVoucherBalance = await instance.contractVouchersDonorBalance(voucherKey);
		var postUserRedeemed = await instance.contractVouchersAddressRedeemed(userKey);
		
		assert.deepEqual(priorVoucherBalance, postVoucherBalance, "voucher balance state changed");
		assert.deepEqual(priorUserRedeemed, postUserRedeemed, "user redemption state changed");
	});
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

var setupAccounts = async(instance, safeContract, unsafeContract) => {
	
	await assertError(async() => {
		await instance.setContractStatus(safeContract, "safetyCheckPassed", 0);
	}, "allowed checkVersion of 0");
	
	await instance.setContractStatus(safeContract, "safetyCheckPassed", 1);
	await instance.setContractStatus(unsafeContract, "safetyCheckFailed", 1);
};

var donateToAccount = async(instance, beneficiaryAccount, donorAccount, amount) => {
	await instance.addContractVouchers(beneficiaryAccount, amount/2, {value: amount, from:donorAccount});
}

var donateToUnsafeContractWithRequire = async(instance, unsafeContract, donorAccount) => {
	let ether = web3.toWei(1,'ether');
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await assertError(async() => {
			await instance.setContractStatus(unsafeContract, "safetyCheckPassed", ether, {from:donorAccount});
		}, "allowed donation to unsafe account");
	
	let balance2 = web3.eth.getBalance(donorAccount);
	
	//Check to make sure that the difference between the starting value and the ending value is less than the amount sent. Indicating that the transaction was reverted.
	assert.isTrue(balance1.sub(balance2).toNumber() < ether, "value sent was not refunded");
}

var donateToUnsafeContractAndClaimRefund = async(instance, unsafeContract, donorAccount) => {
	let ether = web3.toWei(1,'ether');
	
	await donateToAccount(instance, unsafeContract, donorAccount, ether);
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await instance.claimRefundedEther({from:donorAccount});
	const gasUsed = receipt.receipt.gasUsed;
	
	const tx = await web3.eth.getTransaction(receipt.tx);
    const totalCost = tx.gasPrice.mul(gasUsed);
	
	let balance2 = web3.eth.getBalance(donorAccount);
	
	assert.deepEqual(balance1.add(ether).sub(totalCost), balance2);
};

var donateTosafeContractAndClaimRefund = async(instance, safeContract, donorAccount) => {
	let ether = web3.toWei(1,'ether');
	
	await donateToAccount(instance, safeContract, donorAccount, ether);
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await instance.claimRefundedEther({from:donorAccount});
	const gasUsed = receipt.receipt.gasUsed;
	
	const tx = await web3.eth.getTransaction(receipt.tx);
    const totalCost = tx.gasPrice.mul(gasUsed);
	
	let balance2 = web3.eth.getBalance(donorAccount);
	
	assert.deepEqual(balance1.sub(totalCost), balance2);
	
	await donateToAccount(instance, safeContract, donorAccount, ether);
};

var donateTosafeContractAndWithdrawBalance = async(instance, safeContract, donorAccount, withdrawingAccount, amount) => {
	let ether = web3.toWei(1,'ether');
	
	await donateToAccount(instance, safeContract, donorAccount, ether);
	
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await instance.withdrawContractVouchers(safeContract, ether, {from:withdrawingAccount});
	const gasUsed = receipt.receipt.gasUsed;
	
	const tx = await web3.eth.getTransaction(receipt.tx);
    const totalCost = tx.gasPrice.mul(gasUsed);
	
	let balance2 = web3.eth.getBalance(withdrawingAccount);
	
	assert.deepEqual(balance1.add(ether).sub(totalCost), balance2);
};
