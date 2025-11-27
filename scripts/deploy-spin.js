const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);

  const MOCK_VRF_COORDINATOR = "0x5CE8D5A2BC84beb22a398CCA51996F7930313D61";
  const MOCK_SUBSCRIPTION_ID = 32724918011804359043908984995772110491092446176932828242795340271579379388715;
  
  const BBFTToken = await ethers.getContractFactory("BBFTToken");
  const token = await BBFTToken.deploy();
  
  // Remove .deployed() - just wait for deployment to complete
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  
  console.log("BBFTToken deployed to:", tokenAddress);

  // Deploy the spin game
  const BabyBigFiveSpin = await ethers.getContractFactory("BabyBigFiveSpin");
  const spinGame = await BabyBigFiveSpin.deploy(
    tokenAddress,
    MOCK_VRF_COORDINATOR,
    MOCK_SUBSCRIPTION_ID
  );
  
  await spinGame.waitForDeployment();
  const spinGameAddress = await spinGame.getAddress();
  
  console.log("BabyBigFiveSpin deployed to:", spinGameAddress);
  console.log("Deployment completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });