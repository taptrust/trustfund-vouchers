pragma solidity ^0.4.24;

import './openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './openzeppelin-solidity/contracts/math/SafeMath.sol';
import './VouchersUser.sol';

contract VouchersRegistry is Ownable{
    
    string constant SAFETY_CHECK_PASSED = "safetyCheckPassed";
    string constant SAFETY_CHECK_FAILED = "safetyCheckFailed";
    
    mapping(address => uint) public safetyCheckPassedContracts;
    mapping(address => uint) public safetyCheckFailedContracts;
    
    mapping(bytes32 => uint) public contractVouchersDonorBalance;
    mapping(bytes32 => uint) public contractVouchersAddressRedeemed;
    mapping(bytes32 => uint) public contractVouchersRedeemablePerUser;
    mapping(bytes32 => bytes32) public contractVouchersFunctionData;
    mapping(address => uint) public addressIdentityVerified;
    
    uint redemptionGasFee = 1000000;
    
    function setContractStatus(address contractAddress, string status, uint checkVersion) public onlyOwner {
        require(checkVersion > 0);
        
        if(stringsEquivelant(status, SAFETY_CHECK_PASSED))
            SetSafetyCheckPassed(contractAddress,checkVersion);
        else if(stringsEquivelant(status, SAFETY_CHECK_FAILED))
            SetSafetyCheckFailed(contractAddress,checkVersion);
    }
    
    function SetSafetyCheckPassed(address contractAddress, uint checkVersion) internal{
        safetyCheckPassedContracts[contractAddress] = checkVersion;
        if(safetyCheckFailedContracts[contractAddress] != 0)
            safetyCheckFailedContracts[contractAddress] = 0;
    }
    
    function SetSafetyCheckFailed(address contractAddress, uint checkVersion) internal{
        safetyCheckFailedContracts[contractAddress] = checkVersion;
        if(safetyCheckPassedContracts[contractAddress] != 0)
            safetyCheckPassedContracts[contractAddress] = 0;
    }
	
	function setAddressIdentityVerified(address userAddress, uint verificationToken) public onlyOwner {
		addressIdentityVerified[userAddress] = verificationToken;
	}
    
    function stringsEquivelant (string a, string b) internal pure returns (bool){
       return keccak256(bytes(a)) == keccak256(bytes(b));
    }
    
    event AddressNotPassedSafetyCheckRefund(address refundee, uint refundAmount);
    
    function addContractVouchers(address contractAddress, uint redeemablePerUser, bytes32 voucherFunctionData) public payable {
        require(safetyCheckPassedContracts[contractAddress] > 0);
        
        address donorAddress = msg.sender;
        bytes32 voucherKey = getVoucherKey(donorAddress, contractAddress);
        
        uint currentBalance = contractVouchersDonorBalance[voucherKey];
        contractVouchersDonorBalance[voucherKey] = SafeMath.add(currentBalance, msg.value);
        
        contractVouchersRedeemablePerUser[voucherKey] = redeemablePerUser;
        if(voucherFunctionData != 0)
            contractVouchersFunctionData[voucherKey] = voucherFunctionData;
    }
    
    function withdrawContractVouchers(address contractAddress, uint withdrawAmount) public {
        address donorAddress = msg.sender;
        bytes32 voucherKey = getVoucherKey(donorAddress, contractAddress);
        uint currentBalance = contractVouchersDonorBalance[voucherKey];
        
        require(currentBalance >= withdrawAmount && withdrawAmount > 0);
        
        contractVouchersDonorBalance[voucherKey] = SafeMath.sub(currentBalance, withdrawAmount);
        msg.sender.transfer(withdrawAmount);
    }
	
	function redeemContractVouchers(address contractAddress, address donorAddress, uint redeemAmount, bytes32 voucherFunctionData) public {
		VouchersUser userAddress = VouchersUser(msg.sender);
		require(addressIdentityVerified[userAddress] > 0);
		
		uint gasCost = SafeMath.mul(redemptionGasFee, tx.gasprice);
		uint requiredAmount = SafeMath.add(redeemAmount, gasCost);
		
		bytes32 voucherKey = getVoucherKey(donorAddress, contractAddress);
		uint donorBalance = contractVouchersDonorBalance[voucherKey];
		require(donorBalance >= requiredAmount);
		
		bytes32 userKey = getUserKey(donorAddress, contractAddress, userAddress); 
		uint totalRedemption = SafeMath.add(redeemAmount, contractVouchersAddressRedeemed[userKey]);
		
		require(totalRedemption <= contractVouchersRedeemablePerUser[voucherKey]);
		contractVouchersAddressRedeemed[userKey] = totalRedemption;
		contractVouchersDonorBalance[voucherKey] = SafeMath.sub(donorBalance,requiredAmount);

		if(contractVouchersFunctionData[voucherKey] > 0)
			voucherFunctionData = contractVouchersFunctionData[voucherKey];
        		
		userAddress.forwardRedeemedVouchers.value(redeemAmount)(contractAddress, voucherFunctionData);
	}
	
	function getVoucherKey(address donorAddress, address contractAddress) public pure returns(bytes32) {
		return keccak256(abi.encodePacked(donorAddress, contractAddress));
	}

	function getUserKey(address donorAddress, address contractAddress, address userAddress) public pure returns(bytes32) {
		return keccak256(abi.encodePacked(donorAddress, contractAddress, userAddress));
	}		
}