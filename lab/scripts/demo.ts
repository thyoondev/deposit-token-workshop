import hre from "hardhat";
import { upgrades } from "@openzeppelin/hardhat-upgrades";

const connection = await hre.network.create();
const { ethers } = connection;
const upgradesApi = await upgrades(hre, connection);
const [admin, bank, alice] = await ethers.getSigners();
const registry = await ethers.deployContract("KYCRegistry", [admin.address]);
const Token = await ethers.getContractFactory("DepositToken");
const token = await upgradesApi.deployProxy(Token,
  [admin.address, await registry.getAddress()], { kind: "uups" });
await token.waitForDeployment();
await token.grantRole(await token.MINTER_ROLE(), bank.address);
await token.grantRole(await token.BURNER_ROLE(), bank.address);
await registry.setVerified(alice.address, true);
const u = (v: string) => ethers.parseUnits(v, 18);
await token.connect(bank).mint(alice.address, u("100"));
console.log("After mint:", ethers.formatUnits(await token.balanceOf(alice.address), 18));
await token.connect(alice).approve(bank.address, u("20"));
await token.connect(bank).burn(alice.address, u("20"));
console.log("After burn:", ethers.formatUnits(await token.balanceOf(alice.address), 18));
console.log("Supply:", ethers.formatUnits(await token.totalSupply(), 18));
