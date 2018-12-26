pragma solidity ^0.4.24;

import './openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './openzeppelin-solidity/contracts/math/SafeMath.sol';
import './relevant-community/contracts/BondingCurve.sol';
import './VouchersRegistry.sol';

contract VouchersUser is Ownable{
	VouchersRegistry _registry;

	constructor(VouchersRegistry registry) public {
		require(uint256(address(registry)) != 0);
		_registry = registry;
	}
	
	modifier onlyRegistry() {
		require(isRegistry());
		_;
	}

	function isRegistry() public view returns(bool) {
		return msg.sender == address(_registry);
	}
	
	function requestContractVouchers(address contractAddress, address donorAddress, uint redeemAmount, bytes voucherFunctionData) public onlyOwner 
	{
		_registry.redeemContractVouchers(contractAddress, donorAddress, redeemAmount, voucherFunctionData);
	}
	
	function forwardRedeemedVouchers(address contractAddress, bytes voucherFunctionData) public payable onlyRegistry {
		require(contractAddress.call.value(msg.value)(voucherFunctionData));
	}
}