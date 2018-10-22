pragma solidity ^0.4.24;

import './openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './openzeppelin-solidity/contracts/math/SafeMath.sol';

contract VouchersRegistry is Ownable{
    
    string constant SAFETY_CHECK_PASSED = "safetyCheckPassed";
    string constant SAFETY_CHECK_FAILED = "safetyCheckFailed";
    
    mapping(address => uint) safetyCheckPassedContracts;
    mapping(address => uint) safetyCheckFailedContracts;
    
    mapping(bytes32 => uint) contractVouchersDonorBalance;
    mapping(bytes32 => uint) contractVouchersAddressRedeemed;
    mapping(bytes32 => uint) contractVouchersRedeemablePerUser;
    
    mapping(address => uint) addressIdentityVerified;
    
    uint refundGasFee = 0;
    mapping(address => uint) pendingRefunds;
    
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
        if(safetyCheckPassedContracts[contractAddress] == 0) {
            uint refundAmount = 0;
            
            if(msg.value > refundGasFee) {
                refundAmount = SafeMath.sub(msg.value, refundGasFee);
                pendingRefunds[msg.sender] += refundAmount;
            }
            
            emit AddressNotPassedSafetyCheckRefund(msg.sender, refundAmount);
            return;
        }
        
        address donorAddress = msg.sender;
        bytes32 voucherKey = keccak256(abi.encodePacked(donorAddress, contractAddress));
        
        uint currentBalance = contractVouchersDonorBalance[voucherKey];
        contractVouchersDonorBalance[voucherKey] = SafeMath.add(currentBalance, msg.value);
        
        contractVouchersRedeemablePerUser[voucherKey] = redeemablePerUser;
    }
    
    function claimRefundedEther() public {
        uint amount = pendingRefunds[msg.sender];
        pendingRefunds[msg.sender] = 0;
        msg.sender.transfer(amount);
    }
    
    function withdrawContractVouchers(address contractAddress, uint withdrawAmount) public {
        address donorAddress = msg.sender;
        bytes32 voucherKey = keccak256(abi.encodePacked(donorAddress, contractAddress));
        uint currentBalance = contractVouchersDonorBalance[voucherKey];
        
        require(currentBalance >= withdrawAmount && withdrawAmount > 0);
        
        contractVouchersDonorBalance[voucherKey] = SafeMath.sub(currentBalance, withdrawAmount);
        msg.sender.transfer(withdrawAmount);
    }
}