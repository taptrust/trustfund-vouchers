pragma solidity ^0.4.24;

import './openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './openzeppelin-solidity/contracts/math/SafeMath.sol';

contract VouchersRegistry is Ownable{
    
    string constant SAFETY_CHECK_PASSED = "safetyCheckPassed";
    string constant SAFETY_CHECK_FAILED = "safetyCheckFailed";
    
    mapping(address => uint) public safetyCheckPassedContracts;
    mapping(address => uint) public safetyCheckFailedContracts;
    
    mapping(bytes32 => uint) public contractVouchersDonorBalance;
    mapping(bytes32 => uint) public contractVouchersAddressRedeemed;
    mapping(bytes32 => uint) public contractVouchersRedeemablePerUser;
    
    mapping(address => uint) public addressIdentityVerified;
    
    //uint refundGasFee = 0;
    //mapping(address => uint) public pendingRefunds;
    
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
    
    function stringsEquivelant (string a, string b) internal pure returns (bool){
       return keccak256(bytes(a)) == keccak256(bytes(b));
    }
    
    event AddressNotPassedSafetyCheckRefund(address refundee, uint refundAmount);
    
    function addContractVouchers(address contractAddress, uint redeemablePerUser) public payable {
        
		
		/*
		if(safetyCheckPassedContracts[contractAddress] == 0) {
            uint refundAmount = 0;
            
            if(msg.value > refundGasFee) {
                refundAmount = SafeMath.sub(msg.value, refundGasFee);
                pendingRefunds[msg.sender] += refundAmount;
            }
            
            emit AddressNotPassedSafetyCheckRefund(msg.sender, refundAmount);
            return;
        }
		*/
		
		//Commented out functionality is un-needed if we revert here, as it will automatically return ether to the sending account.
		//No gas fee deduction should be needed for this function, as it is directly called by the sending account, and is not proxy-called by the admin.
		require(safetyCheckPassedContracts[contractAddress] > 0);
        
        address donorAddress = msg.sender;
        bytes32 voucherKey = keccak256(abi.encodePacked(donorAddress, contractAddress));
        
        uint currentBalance = contractVouchersDonorBalance[voucherKey];
        contractVouchersDonorBalance[voucherKey] = SafeMath.add(currentBalance, msg.value);
        
        contractVouchersRedeemablePerUser[voucherKey] = redeemablePerUser;
    }
    
    /*function claimRefundedEther() public {
        uint amount = pendingRefunds[msg.sender];
        pendingRefunds[msg.sender] = 0;
        msg.sender.transfer(amount);
    }*/
    
    function withdrawContractVouchers(address contractAddress, uint withdrawAmount) public {
        address donorAddress = msg.sender;
        bytes32 voucherKey = keccak256(abi.encodePacked(donorAddress, contractAddress));
        uint currentBalance = contractVouchersDonorBalance[voucherKey];
        
        require(currentBalance >= withdrawAmount && withdrawAmount > 0);
        
        contractVouchersDonorBalance[voucherKey] = SafeMath.sub(currentBalance, withdrawAmount);
        msg.sender.transfer(withdrawAmount);
    }
}