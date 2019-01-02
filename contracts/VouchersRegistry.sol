pragma solidity ^0.4.24;

import './openzeppelin-solidity/contracts/math/SafeMath.sol';
import './VouchersUser.sol';
import 'zos-lib/contracts/Initializable.sol';

contract VouchersRegistry is Initializable {
    
    string SAFETY_CHECK_PASSED;
    string SAFETY_CHECK_FAILED;
	
	address _admin;
    
    mapping(address => uint) public safetyCheckPassedContracts;
    mapping(address => uint) public safetyCheckFailedContracts;
    
    mapping(bytes32 => uint) public contractVouchersDonorBalance;
    mapping(bytes32 => uint) public contractVouchersAddressRedeemed;
    mapping(bytes32 => uint) public contractVouchersRedeemablePerUser;
    mapping(bytes32 => bytes) public contractVouchersFunctionData;
    mapping(address => uint) public addressIdentityVerified;
    
    uint redemptionGasFee;
	
	function initialize(address admin) initializer public {
		require(uint256(address(admin)) != 0);
		redemptionGasFee = 1000000;
		SAFETY_CHECK_PASSED = "safetyCheckPassed";
		SAFETY_CHECK_FAILED = "safetyCheckFailed";
		_admin = admin;
	}
	
	modifier onlyAdmin() {
		require(isAdmin());
		_;
	}
	
	function isAdmin() public view returns(bool) {
		return msg.sender == address(_admin);
	}
    
    function setContractStatus(address contractAddress, string memory status, uint checkVersion) public onlyAdmin {
        require(checkVersion > 0);
        
        if(stringsEquivelant(status, SAFETY_CHECK_PASSED))
            SetSafetyCheckPassed(contractAddress,checkVersion);
        else if(stringsEquivelant(status, SAFETY_CHECK_FAILED))
            SetSafetyCheckFailed(contractAddress,checkVersion);
    }
    
    function SetSafetyCheckPassed(address contractAddress, uint checkVersion) internal {
        safetyCheckPassedContracts[contractAddress] = checkVersion;
        if(safetyCheckFailedContracts[contractAddress] != 0)
            safetyCheckFailedContracts[contractAddress] = 0;
    }
    
    function SetSafetyCheckFailed(address contractAddress, uint checkVersion) internal{
        safetyCheckFailedContracts[contractAddress] = checkVersion;
        if(safetyCheckPassedContracts[contractAddress] != 0)
            safetyCheckPassedContracts[contractAddress] = 0;
    }
	
	function setAddressIdentityVerified(address userAddress, uint verificationToken) public onlyAdmin {
		addressIdentityVerified[userAddress] = verificationToken;
	}
    
    function stringsEquivelant (string memory a, string memory b) internal pure returns (bool){
       return keccak256(bytes(a)) == keccak256(bytes(b));
    }
    
    event AddressNotPassedSafetyCheckRefund(address refundee, uint refundAmount);
    
    function addContractVouchers(address contractAddress, uint redeemablePerUser, bytes voucherFunctionData) public payable {
        require(safetyCheckPassedContracts[contractAddress] > 0);
        
        address donorAddress = msg.sender;
        bytes32 voucherKey = getVoucherKey(donorAddress, contractAddress);
        
        uint currentBalance = contractVouchersDonorBalance[voucherKey];
        contractVouchersDonorBalance[voucherKey] = SafeMath.add(currentBalance, msg.value);
        
        contractVouchersRedeemablePerUser[voucherKey] = redeemablePerUser;
        if(voucherFunctionData.length != 0)
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
	
	function redeemContractVouchers(address contractAddress, address donorAddress, uint redeemAmount, bytes voucherFunctionData) public {
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

		if(contractVouchersFunctionData[voucherKey].length > 0)
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