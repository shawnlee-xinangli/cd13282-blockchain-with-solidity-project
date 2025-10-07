// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Collateralized Loan Contract
contract CollateralizedLoan {
    // Define the structure of a loan
    struct Loan {
        address borrower;
        // Hint: Add a field for the lender's address
        address lender;
        uint loanId;
        uint collateralAmount;
        // Hint: Add fields for loan amount, interest rate, due date, isFunded, isRepaid
        uint loanAmount;
        uint interestRate;
        uint dueDate;
        bool isFunded;
        bool isRepaid;
    }

    // Create a mapping to manage the loans
    mapping(uint => Loan) public loans;
    uint public nextLoanId;

    // Hint: Define events for loan requested, funded, repaid, and collateral claimed
    event LoanRequested(uint loanId, address borrower, address lender, uint collateralAmount, uint loanAmount, uint interestRate, uint dueDate);
    event LoanFunded(uint loanId, address lender, uint timestamp);
    event LoanRepaid(uint loanId, address borrower, uint timestamp);
    event CollateralClaimed(uint loanId, address lender, uint timestamp);

    // Custom Modifiers
    // Hint: Write a modifier to check if a loan exists
    modifier loanExists(uint loanId) {
        require(loanId > 0 && loanId <= nextLoanId, "Invalid loan ID");
        _;
    }
    // Hint: Write a modifier to ensure a loan is not already funded
    modifier loanNotFunded(uint loanId) {
        require(!loans[loanId].isFunded, "Loan already funded");
        _;
    }

    // Function to deposit collateral and request a loan
    function depositCollateralAndRequestLoan(uint _interestRate, uint _duration) external payable {
        // Hint: Check if the collateral is more than 0
        require(msg.value > 0, "Collateral amount must be greater than 0");
        // Hint: Calculate the loan amount based on the collateralized amount
        uint loanAmount = msg.value * 80 / 100; // 80% of collateral as loan amount

        // Hint: Increment nextLoanId and create a new loan in the loans mapping
        nextLoanId++;
        loans[nextLoanId] = Loan(msg.sender, address(0), nextLoanId, msg.value, loanAmount, _interestRate, block.timestamp + _duration, false, false);
        // Hint: Emit an event for loan request
        emit LoanRequested(nextLoanId, msg.sender, address(0), msg.value, loanAmount, _interestRate, block.timestamp + _duration);
    }

    // Function to fund a loan
    // Hint: Write the fundLoan function with necessary checks and logic
    function fundLoan(uint loanId) external payable loanExists(loanId) loanNotFunded(loanId) {
        require(msg.value >= loans[loanId].loanAmount, "Insufficient funding amount");
        loans[loanId].lender = msg.sender;
        loans[loanId].isFunded = true;
        // Transfer loan amount to borrower
        payable(loans[loanId].borrower).transfer(loans[loanId].loanAmount);
        emit LoanFunded(loanId, msg.sender, block.timestamp);
    }

    // Function to repay a loan
    // Hint: Write the repayLoan function with necessary checks and logic
    function repayLoan(uint loanId) external payable loanExists(loanId) {
        require(loans[loanId].borrower == msg.sender, "Only borrower can repay");
        require(loans[loanId].isFunded, "Loan not funded");
        require(!loans[loanId].isRepaid, "Loan already repaid");
        
        uint interestAmount = loans[loanId].loanAmount * loans[loanId].interestRate / 100;
        uint totalRepayment = loans[loanId].loanAmount + interestAmount;
        
        require(msg.value >= totalRepayment, "Insufficient repayment amount");
        
        loans[loanId].isRepaid = true;
        
        // Transfer repayment to lender
        payable(loans[loanId].lender).transfer(totalRepayment);
        // Return collateral to borrower
        payable(loans[loanId].borrower).transfer(loans[loanId].collateralAmount);
        
        emit LoanRepaid(loanId, msg.sender, block.timestamp);
    }

    // Function to claim collateral on default
    // Hint: Write the claimCollateral function with necessary checks and logic
    function claimCollateral(uint loanId) external loanExists(loanId) {
        require(loans[loanId].lender == msg.sender, "Only lender can claim collateral");
        require(loans[loanId].isFunded, "Loan not funded");
        require(!loans[loanId].isRepaid, "Loan already repaid");
        require(block.timestamp > loans[loanId].dueDate, "Loan not due yet");
        

        payable(loans[loanId].lender).transfer(loans[loanId].collateralAmount);
        emit CollateralClaimed(loanId, msg.sender, block.timestamp);
    }
}