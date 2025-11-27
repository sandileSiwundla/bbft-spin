// scripts/test-spin-auto.js
const { ethers } = require("hardhat");

async function main() {
  const [user] = await ethers.getSigners();

  // Spin contract address (already deployed)
  const SPIN_CONTRACT_ADDRESS = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";

  console.log("Using account:", user.address);
  console.log("Spin contract:", SPIN_CONTRACT_ADDRESS);

  // Connect to spin contract
  const spin = await ethers.getContractAt("BabyBigFiveSpin", SPIN_CONTRACT_ADDRESS, user);

  // Fetch the BBFT token address directly from spin contract
  const tokenAddress = await spin.bbftToken();
  console.log("Token used by spin contract:", tokenAddress);

  // Connect to the BBFT token
  const token = await ethers.getContractAt("BBFTToken", tokenAddress, user);

  // Show balances
  const userBalance = await token.balanceOf(user.address);
  const contractBalance = await token.balanceOf(SPIN_CONTRACT_ADDRESS);
  const spinCost = await spin.SPIN_COST();

  console.log("\n=== BALANCES ===");
  console.log("User BBFT balance:", ethers.formatEther(userBalance));
  console.log("Contract BBFT balance:", ethers.formatEther(contractBalance));
  console.log("Spin cost:", ethers.formatEther(spinCost));

  // Check current allowance
  let allowance = await token.allowance(user.address, SPIN_CONTRACT_ADDRESS);
  console.log("Current allowance:", ethers.formatEther(allowance));

  // Approve spin contract if needed
  if (allowance < spinCost) {
    console.log("\nApproving spin contract...");
    const approveTx = await token.approve(SPIN_CONTRACT_ADDRESS, ethers.parseEther("100"));
    await approveTx.wait();
    allowance = await token.allowance(user.address, SPIN_CONTRACT_ADDRESS);
    console.log("New allowance:", ethers.formatEther(allowance));
  } else {
    console.log("✅ Sufficient allowance already set");
  }

  // Double-check balance and allowance before spinning
  if (allowance < spinCost) throw new Error("Still not enough allowance!");
  if (userBalance < spinCost) throw new Error("Not enough user balance!");

  console.log("\n✅ All checks passed. Spinning...");

  // Execute spin
  const spinTx = await spin.spin();
  const receipt = await spinTx.wait();
  console.log("Spin transaction hash:", receipt.transactionHash);

  // Get SpinRequested event
  const spinEvent = receipt.logs
    .map(log => {
      try {
        return spin.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(e => e && e.name === "SpinRequested");

  if (!spinEvent) {
    console.log("❌ No SpinRequested event found!");
    return;
  }

  const requestId = spinEvent.args.requestId;
  console.log("Spin requested! Request ID:", requestId.toString());

  console.log("\nWaiting for VRF fulfillment (simulate or wait if using local mock)...");
  await checkSpinResult(spin, requestId, user.address);
}

async function checkSpinResult(spin, requestId, userAddress) {
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    const fulfilled = await spin.isRequestFulfilled(requestId);

    if (fulfilled) {
      const result = await spin.getSpinResult(requestId);
      const player = await spin.getRequestPlayer(requestId);

      console.log("\n=== SPIN RESULT ===");
      console.log("Request ID:", requestId.toString());
      console.log("Player:", player);
      console.log("Won:", result.won ? "YES 🎉" : "No 😞");
      console.log("Win Amount:", ethers.formatEther(result.winAmount), "BBFT");

      // Player stats
      const stats = await spin.getPlayerStats(userAddress);
      console.log("\nPlayer Stats:");
      console.log("- Spins:", stats.spins.toString());
      console.log("- Wins:", stats.wins.toString());
      console.log("- Losses:", stats.losses.toString());
      console.log("- Payouts:", ethers.formatEther(stats.payouts), "BBFT");
      console.log("- Profit/Loss:", ethers.formatEther(stats.profitLoss), "BBFT");
      console.log("- Win Rate:", stats.winPercentage.toString(), "%");
      return;
    }

    attempts++;
    console.log(`Waiting for VRF... (${attempts}/${maxAttempts})`);
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log("❌ Timeout waiting for VRF result");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
