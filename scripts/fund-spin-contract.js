const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Replace with your actual contract addresses
  const BBFT_TOKEN_ADDRESS = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
  const SPIN_CONTRACT_ADDRESS = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
  
  const token = await ethers.getContractAt("BBFTToken", BBFT_TOKEN_ADDRESS);
  const spinContract = await ethers.getContractAt("BabyBigFiveSpin", SPIN_CONTRACT_ADDRESS);
  
  // Fund contract with 1000 BBFT tokens for payouts
  const amount = ethers.parseEther("1000");
  
  console.log("Transferring BBFT tokens to spin contract...");
  const tx = await token.transfer(SPIN_CONTRACT_ADDRESS, amount);
  await tx.wait();
  
  console.log(`Funded spin contract with ${ethers.formatEther(amount)} BBFT tokens`);
  console.log("Spin contract balance:", ethers.formatEther(await token.balanceOf(SPIN_CONTRACT_ADDRESS)));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });