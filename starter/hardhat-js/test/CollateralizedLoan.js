// Importing necessary modules and functions from Hardhat and Chai for testing
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Describing a test suite for the CollateralizedLoan contract
describe("CollateralizedLoan", function () {
  // A fixture to deploy the contract before each test. This helps in reducing code repetition.
  async function deployCollateralizedLoanFixture() {
    // Deploying the CollateralizedLoan contract and returning necessary variables
    const [borrower, lender] = await ethers.getSigners();
    const CollateralizedLoan = await ethers.getContractFactory("CollateralizedLoan");
    const collateralizedLoan = await CollateralizedLoan.deploy();
    
    return {collateralizedLoan, borrower, lender};
      
    
  }

  // Test suite for the loan request functionality
  describe("Loan Request", function () {
    it("Should let a borrower deposit collateral and request a loan", async function () {
      // Loading the fixture
      const { collateralizedLoan, borrower } = await loadFixture(deployCollateralizedLoanFixture);
      
      const collateralAmount = ethers.parseEther("100.00"); // 100.0 ETH
      const interestRate = 10; // 10%
      const duration = 30 * 24 * 60 * 60; // 30 days in seconds
      
      // Expected loan amount (80% of collateral)
      const expectedLoanAmount = collateralAmount * 80n / 100n;
      
      // Get current timestamp
      const currentTime = await time.latest();
      
      // Deposit collateral and request loan
      await expect(
        collateralizedLoan.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, {
          value: collateralAmount
        })
      )
        .to.emit(collateralizedLoan, "LoanRequested")
        .withArgs(1, borrower.address, ethers.ZeroAddress, collateralAmount, expectedLoanAmount, interestRate, currentTime + duration + 1);
      
      // Check loan was created correctly
      const loan = await collateralizedLoan.loans(1);
      expect(loan.borrower).to.equal(borrower.address);
      expect(loan.lender).to.equal(ethers.ZeroAddress);
      expect(loan.loanId).to.equal(1);
      expect(loan.collateralAmount).to.equal(collateralAmount);
      expect(loan.loanAmount).to.equal(expectedLoanAmount);
      expect(loan.interestRate).to.equal(interestRate);
      expect(loan.isFunded).to.equal(false);
      expect(loan.isRepaid).to.equal(false);
    });
  });

  // Test suite for funding a loan
  describe("Funding a Loan", function () {
    it("Allows a lender to fund a requested loan", async function () {
      // Loading the fixture
      const { collateralizedLoan, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      const collateralAmount = ethers.parseEther("100.00"); // 100.00 ETH
      const interestRate = 10; // 10%
      const duration = 30 * 24 * 60 * 60; // 30 days in seconds
      
      // First, borrower requests a loan
      await collateralizedLoan.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, {
        value: collateralAmount
      });
      
      const loan = await collateralizedLoan.loans(1);
      const loanAmount = loan.loanAmount;
      
      // Lender funds the loan
      await expect(
        collateralizedLoan.connect(lender).fundLoan(1, {
          value: loanAmount
        })
      )
        .to.emit(collateralizedLoan, "LoanFunded")
        .withArgs(1, lender.address, await time.latest() + 1);
      
      // Check that loan is now funded
      const fundedLoan = await collateralizedLoan.loans(1);
      expect(fundedLoan.lender).to.equal(lender.address);
      expect(fundedLoan.isFunded).to.equal(true);
    });
  });

  // Test suite for repaying a loan
  describe("Repaying a Loan", function () {
    it("Enables the borrower to repay the loan fully", async function () {
      // Loading the fixture
      const { collateralizedLoan, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      const collateralAmount = ethers.parseEther("100.00"); // 100.00 ETH
      const interestRate = 10; // 10%
      const duration = 30 * 24 * 60 * 60; // 30 days in seconds
      
      // Set up loan: borrower requests and lender funds
      await collateralizedLoan.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, {
        value: collateralAmount
      });
      
      const loan = await collateralizedLoan.loans(1);
      const loanAmount = loan.loanAmount;
      
      await collateralizedLoan.connect(lender).fundLoan(1, {
        value: loanAmount
      });
      
      // Calculate repayment amount (principal + interest)
      const interestAmount = loanAmount * BigInt(interestRate) / 100n;
      const totalRepayment = loanAmount + interestAmount;
      
      
      // Borrower repays the loan
      await expect(
        collateralizedLoan.connect(borrower).repayLoan(1, {
          value: totalRepayment
        })
      )
        .to.emit(collateralizedLoan, "LoanRepaid")
        .withArgs(1, borrower.address, await time.latest() + 1);
      
      // Check that loan is marked as repaid
      const repaidLoan = await collateralizedLoan.loans(1);
      expect(repaidLoan.isRepaid).to.equal(true);
      
    });
  });

  // Test suite for claiming collateral
  describe("Claiming Collateral", function () {
    it("Permits the lender to claim collateral if the loan isn't repaid on time", async function () {
      // Loading the fixture
      const { collateralizedLoan, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      const collateralAmount = ethers.parseEther("100.00"); // 100.00 ETH
      const interestRate = 10; // 10%
      const duration = 30 * 24 * 60 * 60; // 30 days in seconds
      
      // Set up loan: borrower requests and lender funds
      await collateralizedLoan.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, {
        value: collateralAmount
      });
      
      const loan = await collateralizedLoan.loans(1);
      const loanAmount = loan.loanAmount;
      
      await collateralizedLoan.connect(lender).fundLoan(1, {
        value: loanAmount
      });
      
      // Fast forward time to after the due date
      await time.increase(duration + 1);
      
      // Lender claims collateral
      await expect(
        collateralizedLoan.connect(lender).claimCollateral(1)
      )
        .to.emit(collateralizedLoan, "CollateralClaimed")
        .withArgs(1, lender.address, await time.latest() + 1);
    });
  });
});
