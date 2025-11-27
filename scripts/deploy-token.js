const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying BBFTToken with account:", deployer.address);
  
  // Correct way to get balance in ethers v6
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const BBFTToken = await ethers.getContractFactory("BBFTToken");
  const token = await BBFTToken.deploy();
  
  // Use waitForDeployment() instead of deployed() for ethers v6
  await token.waitForDeployment();
  
  // Use getAddress() instead of .address for ethers v6
  const tokenAddress = await token.getAddress();
  
  console.log("BBFTToken deployed to:", tokenAddress);
  console.log("Total supply:", (await token.totalSupply()).toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });