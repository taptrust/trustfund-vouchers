pragma solidity ^0.4.24;

import './openzeppelin-solidity/contracts/math/SafeMath.sol';
import './VouchersRegistry.sol';
import 'zos-lib/contracts/Initializable.sol';

contract VouchersUser is Initializable{
	VouchersRegistry _registry;
	address _owner;

	function initialize(VouchersRegistry registry, address owner) initializer public {
		require(uint256(address(registry)) != 0);
		_registry = registry;
		_owner = owner;
	}
	
	modifier onlyRegistry() {
		require(isRegistry());
		_;
	}

	function isRegistry() public view returns(bool) {
		return msg.sender == address(_registry);
	}
	
	modifier onlyOwner() {
		require(isOwner());
		_;
	}

	function isOwner() public view returns(bool) {
		return msg.sender == address(_owner);
	}
	
	function requestContractVouchers(address contractAddress, address donorAddress, uint redeemAmount, bytes voucherFunctionData) public onlyOwner 
	{
		_registry.redeemContractVouchers(contractAddress, donorAddress, redeemAmount, voucherFunctionData);
	}
	
	function forwardRedeemedVouchers(address contractAddress, bytes voucherFunctionData) public payable onlyRegistry {
		require(contractAddress.call.value(msg.value)(voucherFunctionData));
	}
}