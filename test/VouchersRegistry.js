import { TestHelper } from 'zos';

var VouchersRegistry = artifacts.require("VouchersRegistry.sol");
var VouchersUser = artifacts.require("VouchersUser.sol");
var BondingCurve = artifacts.require("BondingCurve.sol");
var Web3EthAbi = require('web3-eth-abi');
var safeContract = null;
var unsafeContract = null;
var donorAccount = null;
var randomAccount = null;
var upgradeAdmin = null;

var project = null;
var instance = null;
var user = null;
var token = null;

var ether = web3.toWei(1, 'ether');

var encodedBuyCall = Web3EthAbi.encodeFunctionCall({
    name: 'buy',
    type: 'function',
    inputs: []
}, []);

contract('VouchersRegistry', function(accounts) {
	donorAccount = accounts[1];
	randomAccount = accounts[2];
	upgradeAdmin = accounts[3];
	
	beforeEach(async function () {
		project = await TestHelper({ from: upgradeAdmin })
	  });
		
	it("should be admin'd by deploying account", async() => {
		instance = await project.createProxy(VouchersRegistry, { initArgs: [accounts[0]] });
		let isAdmin = await instance.isAdmin.call();
		assert.isTrue(isAdmin, "deploying address wasn't admin");
	});
	
	it("should let admin set contract status of accounts", async() => {
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
	
	it("should not allow withdrawal of greater than donated amount", async() => {
		await donateToAccount(instance, safeContract, randomAccount, ether);
		
		await assertError(async() => {
			await instance.withdrawContractVouchers(safeContract, ether*2, {from:donorAccount});
		}, "no error from withdrawal of greater than donated.");
	});
	
	it("is possible to donate vouchers to update an existing voucher balance", async() => {
		var voucherKey = await instance.getVoucherKey(donorAccount,safeContract); 
		var priorVoucherBalance = await instance.contractVouchersDonorBalance(voucherKey);
		
		await donateToAccount(instance, safeContract, donorAccount, ether);
		
		var postVoucherBalance = await instance.contractVouchersDonorBalance(voucherKey);
		
		assert.isTrue(priorVoucherBalance.toString(10) != postVoucherBalance.toString(10), "voucher balance state not changed");
	});

	it("VoucherUser: should be owned by deploying account", async() => {
		user = await project.createProxy(VouchersUser, { initArgs: [instance.address, accounts[0]] });
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
			await instance.redeemContractVouchers(safeContract, donorAccount, 1, encodedBuyCall, {from:randomAccount});
		}, "allow non-verified user contracts to call redeemContractVouchers");
	});

	it("VoucherUser: owner should be able to initiate redemption request", async() => {
		await user.requestContractVouchers(safeContract, donorAccount, ether/4, encodedBuyCall);
		var balance = await token._balances.call(user.address);
		assert.isTrue(balance.toNumber() > 0, "Tokens not granted");
	});
	
	it("VoucherUser: non-owner should not be able to initiate redemption request", async() => {
		await assertError(async() => {
			await user.requestContractVouchers(safeContract, donorAccount, ether/4, encodedBuyCall, {from:randomAccount});
		}, "allowed non-owner to initiate redemption request");
	});
	
	it("VoucherUser: owner should be able to initiate redemption request for remaining allotment", async() => {
		await user.requestContractVouchers(safeContract, donorAccount, encodedBuyCall, ether/4);
		var balance = await token._balances.call(user.address);
		assert.isTrue(balance.toNumber() > 0, "Tokens not granted");
	});
	
	it("VoucherUser: should not be able to redeem greater than amount allowed per user", async() => {
		await assertError(async() => {
			await user.requestContractVouchers(safeContract, donorAccount, ether/4);
		}, "allowed redemption of greater than single user limit");
	});
	
	it("should be possible to modify an redeemablePerUser setting without sending any additional ether", async() => {
		var voucherKey = await instance.getVoucherKey(donorAccount,safeContract); 
		var priorUserLimit = await instance.contractVouchersRedeemablePerUser(voucherKey);
		
		await instance.addContractVouchers(safeContract, ether, encodedBuyCall, {value: 0, from:donorAccount});
		
		var postUserLimit = await instance.contractVouchersRedeemablePerUser(voucherKey);
		
		assert.isTrue(priorUserLimit.toString(10) != postUserLimit.toString(10), "voucher limit state not changed");
	});
	
	it("VoucherUser: should not be able to redeem greater than available amount", async() => {
		await assertError(async() => {
			await user.requestContractVouchers(safeContract, donorAccount, ether);
		}, "allowed redemption of greater than amount available");
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
	await instance.addContractVouchers(beneficiaryAccount, amount/2, encodedBuyCall, {value: amount, from:donorAccount});
}

var donateToUnsafeContractWithRequire = async(instance, unsafeContract, donorAccount) => {
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await assertError(async() => {
			await instance.setContractStatus(unsafeContract, "safetyCheckPassed", ether, {from:donorAccount});
		}, "allowed donation to unsafe account");
	
	let balance2 = web3.eth.getBalance(donorAccount);
	
	//Check to make sure that the difference between the starting value and the ending value is less than the amount sent. Indicating that the transaction was reverted.
	assert.isTrue(balance1.sub(balance2).toNumber() < ether, "value sent was not refunded");
}

var donateTosafeContractAndWithdrawBalance = async(instance, safeContract, donorAccount, withdrawingAccount, amount) => {

	await donateToAccount(instance, safeContract, donorAccount, ether);
	
	let balance1 = web3.eth.getBalance(donorAccount);
	
	let receipt = await instance.withdrawContractVouchers(safeContract, ether, {from:withdrawingAccount});
	const gasUsed = receipt.receipt.gasUsed;
	
	const tx = await web3.eth.getTransaction(receipt.tx);
    const totalCost = tx.gasPrice.mul(gasUsed);
	
	let balance2 = web3.eth.getBalance(withdrawingAccount);
	
	assert.deepEqual(balance1.add(ether).sub(totalCost), balance2);
};
