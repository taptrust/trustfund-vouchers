pragma solidity ^0.4.24;

import './openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './openzeppelin-solidity/contracts/math/SafeMath.sol';
import './relevant-community/contracts/BondingCurve.sol';
import './VouchersRegistry.sol';

contract VouchersUser is Ownable{

	VouchersRegistry _registry;
	
	//constact uint gasCost = 100000;

	constructor(VouchersRegistry registry) public {
		require(uint256(registry) != 0);
		_registry = registry;
	}
	
	//Why is this contract payable?
	//What would happen to the ether sent to this contract?
	function requestContractVouchers(address contractAddress, address donorAddress, uint redeemAmount) public onlyOwner 
	//	payable 
	{
		//require(address(this).balance > SafeMath.mul(tx.gasprice * gasCost));
		_registry.redeemContractVouchers(contractAddress, donorAddress, redeemAmount);
	}
	
	function forwardRedeemedVouchers(address contractAddress) public payable {
		bool success = BondingCurve(contractAddress).buy.value(msg.value)();
		require(success);
	}
}