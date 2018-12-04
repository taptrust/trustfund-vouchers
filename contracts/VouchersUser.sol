pragma solidity ^0.4.24;

import './openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './openzeppelin-solidity/contracts/math/SafeMath.sol';
import './relevant-community/contracts/BondingCurve.sol';
import './VouchersRegistry.sol';

contract VouchersUser is Ownable{
	VouchersRegistry _registry;

	constructor(VouchersRegistry registry) public {
		require(uint256(registry) != 0);
		_registry = registry;
	}
	
	function requestContractVouchers(address contractAddress, address donorAddress, uint redeemAmount, bytes callData) public onlyOwner 
	{
		_registry.redeemContractVouchers(contractAddress, donorAddress, redeemAmount, callData);
	}
	
	function forwardRedeemedVouchers(address contractAddress, bytes callData) public payable {
		bool success = contractAddress.call.value(msg.value)(callData);
		require(success);
	}
}