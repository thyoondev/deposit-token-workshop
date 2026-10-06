import { expect } from "chai";
import hre from "hardhat";
import { upgrades } from "@openzeppelin/hardhat-upgrades";

const connection = await hre.network.create();
const { ethers, networkHelpers } = connection;
const upgradesApi = await upgrades(hre, connection);
const u = (value: string) => ethers.parseUnits(value, 18);

async function deployFixture() {
  const [admin, bank, compliance, alice, bob, spender, outsider] = await ethers.getSigners();
  const registry = await ethers.deployContract("KYCRegistry", [admin.address]);
  const Token = await ethers.getContractFactory("DepositToken");
  const token = await upgradesApi.deployProxy(Token,
    [admin.address, await registry.getAddress()], { kind: "uups" });
  await token.waitForDeployment();
  for (const role of ["MINTER_ROLE", "BURNER_ROLE"]) {
    await token.grantRole(await token[role](), bank.address);
  }
  for (const role of ["PAUSER_ROLE", "FREEZER_ROLE"]) {
    await token.grantRole(await token[role](), compliance.address);
  }
  for (const signer of [alice, bob, spender]) await registry.setVerified(signer.address, true);
  return { admin, bank, compliance, alice, bob, spender, outsider, registry, token };
}

describe("KYCRegistry", function () {
  it("rejects a zero administrator", async function () {
    const Registry = await ethers.getContractFactory("KYCRegistry");
    await expect(Registry.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(Registry, "ZeroAddress");
  });
  it("stores approvals and emits an audit event", async function () {
    const { registry, outsider } = await networkHelpers.loadFixture(deployFixture);
    expect(await registry.isVerified(outsider.address)).to.equal(false);
    await expect(registry.setVerified(outsider.address, true))
      .to.emit(registry, "KYCStatusChanged").withArgs(outsider.address, true);
    expect(await registry.isVerified(outsider.address)).to.equal(true);
  });
  it("revokes an existing approval", async function () {
    const { registry, alice } = await networkHelpers.loadFixture(deployFixture);
    await registry.setVerified(alice.address, false);
    expect(await registry.isVerified(alice.address)).to.equal(false);
  });
  it("rejects zero-address approvals", async function () {
    const { registry } = await networkHelpers.loadFixture(deployFixture);
    await expect(registry.setVerified(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(registry, "ZeroAddress");
  });
  it("rejects a caller without KYC_ADMIN_ROLE", async function () {
    const { registry, outsider } = await networkHelpers.loadFixture(deployFixture);
    await expect(registry.connect(outsider).setVerified(outsider.address, true))
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
  });
});

describe("DepositToken", function () {
  it("initializes proxy metadata and its registry", async function () {
    const { token, registry } = await networkHelpers.loadFixture(deployFixture);
    expect(await token.name()).to.equal("Workshop Deposit Token");
    expect(await token.symbol()).to.equal("WDT");
    expect(await token.decimals()).to.equal(18);
    expect(await token.kycRegistry()).to.equal(await registry.getAddress());
    expect(await token.totalSupply()).to.equal(0n);
  });
  it("rejects repeated proxy initialization", async function () {
    const { token, admin, registry } = await networkHelpers.loadFixture(deployFixture);
    await expect(token.initialize(admin.address, await registry.getAddress()))
      .to.be.revertedWithCustomError(token, "InvalidInitialization");
  });
  it("locks the implementation initializer", async function () {
    const { admin, registry } = await networkHelpers.loadFixture(deployFixture);
    const impl = await ethers.deployContract("DepositToken");
    await expect(impl.initialize(admin.address, await registry.getAddress()))
      .to.be.revertedWithCustomError(impl, "InvalidInitialization");
  });
  it("rejects a zero administrator on deployment", async function () {
    const { registry, token } = await networkHelpers.loadFixture(deployFixture);
    const Token = await ethers.getContractFactory("DepositToken");
    await expect(upgradesApi.deployProxy(Token, [ethers.ZeroAddress, await registry.getAddress()], { kind: "uups" }))
      .to.be.revertedWithCustomError(token, "ZeroAddress");
  });
  it("rejects a registry without deployed code", async function () {
    const { admin, token, outsider } = await networkHelpers.loadFixture(deployFixture);
    const Token = await ethers.getContractFactory("DepositToken");
    await expect(upgradesApi.deployProxy(Token, [admin.address, outsider.address], { kind: "uups" }))
      .to.be.revertedWithCustomError(token, "InvalidRegistry");
  });
  it("mints 100 and emits the ERC-20 Transfer event", async function () {
    const { token, bank, alice } = await networkHelpers.loadFixture(deployFixture);
    await expect(token.connect(bank).mint(alice.address, u("100")))
      .to.emit(token, "Transfer").withArgs(ethers.ZeroAddress, alice.address, u("100"));
    expect(await token.balanceOf(alice.address)).to.equal(u("100"));
    expect(await token.totalSupply()).to.equal(u("100"));
  });
  it("rejects mint without MINTER_ROLE", async function () {
    const { token, outsider, alice } = await networkHelpers.loadFixture(deployFixture);
    await expect(token.connect(outsider).mint(alice.address, u("100")))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });
  it("rejects mint to an unverified recipient", async function () {
    const { token, bank, outsider } = await networkHelpers.loadFixture(deployFixture);
    await expect(token.connect(bank).mint(outsider.address, u("100")))
      .to.be.revertedWithCustomError(token, "KYCRequired").withArgs(outsider.address);
  });
  it("rejects zero mint and burn amounts", async function () {
    const { token, bank, alice } = await networkHelpers.loadFixture(deployFixture);
    await expect(token.connect(bank).mint(alice.address, 0n)).to.be.revertedWithCustomError(token, "ZeroAmount");
    await expect(token.connect(bank).burn(alice.address, 0n)).to.be.revertedWithCustomError(token, "ZeroAmount");
  });
  it("rejects mint to zero address", async function () {
    const { token, bank } = await networkHelpers.loadFixture(deployFixture);
    await expect(token.connect(bank).mint(ethers.ZeroAddress, 1n)).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
  });
  it("burns 20 only after the holder authorizes the operator", async function () {
    const { token, bank, alice } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    await token.connect(alice).approve(bank.address, u("20"));
    await expect(token.connect(bank).burn(alice.address, u("20")))
      .to.emit(token, "Transfer").withArgs(alice.address, ethers.ZeroAddress, u("20"));
    expect(await token.balanceOf(alice.address)).to.equal(u("80"));
    expect(await token.totalSupply()).to.equal(u("80"));
    expect(await token.allowance(alice.address, bank.address)).to.equal(0n);
  });
  it("rejects burn without holder allowance", async function () {
    const { token, bank, alice } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    await expect(token.connect(bank).burn(alice.address, u("20")))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
  });
  it("rejects burn without BURNER_ROLE even with allowance", async function () {
    const { token, bank, alice, outsider } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    await token.connect(alice).approve(outsider.address, u("20"));
    await expect(token.connect(outsider).burn(alice.address, u("20")))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });
  it("rolls back allowance when burn exceeds the balance", async function () {
    const { token, bank, alice } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("10"));
    await token.connect(alice).approve(bank.address, u("20"));
    await expect(token.connect(bank).burn(alice.address, u("20")))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    expect(await token.allowance(alice.address, bank.address)).to.equal(u("20"));
    expect(await token.totalSupply()).to.equal(u("10"));
  });
  it("moves balances without changing supply", async function () {
    const { token, bank, alice, bob } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    await token.connect(alice).transfer(bob.address, u("30"));
    expect(await token.balanceOf(alice.address)).to.equal(u("70"));
    expect(await token.balanceOf(bob.address)).to.equal(u("30"));
    expect(await token.totalSupply()).to.equal(u("100"));
  });
  for (const who of ["alice", "bob"] as const) {
    it(`rejects a transfer after ${who}'s KYC is revoked`, async function () {
      const f = await networkHelpers.loadFixture(deployFixture);
      await f.token.connect(f.bank).mint(f.alice.address, u("100"));
      await f.registry.setVerified(f[who].address, false);
      await expect(f.token.connect(f.alice).transfer(f.bob.address, u("1")))
        .to.be.revertedWithCustomError(f.token, "KYCRequired").withArgs(f[who].address);
    });
  }
  it("allows transferFrom for an approved and verified spender", async function () {
    const { token, bank, alice, bob, spender } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    await token.connect(alice).approve(spender.address, u("30"));
    await token.connect(spender).transferFrom(alice.address, bob.address, u("30"));
    expect(await token.balanceOf(bob.address)).to.equal(u("30"));
    expect(await token.allowance(alice.address, spender.address)).to.equal(0n);
  });
  it("rejects an unverified spender and preserves allowance", async function () {
    const { token, bank, alice, bob, outsider } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    await token.connect(alice).approve(outsider.address, u("30"));
    await expect(token.connect(outsider).transferFrom(alice.address, bob.address, u("30")))
      .to.be.revertedWithCustomError(token, "KYCRequired").withArgs(outsider.address);
    expect(await token.allowance(alice.address, outsider.address)).to.equal(u("30"));
  });
  it("pauses every balance-changing entry point", async function () {
    const { token, bank, compliance, alice, bob, spender } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    await token.connect(alice).approve(bank.address, u("20"));
    await token.connect(alice).approve(spender.address, u("30"));
    await expect(token.connect(compliance).pause()).to.emit(token, "Paused");
    for (const send of [
      () => token.connect(bank).mint(alice.address, 1n),
      () => token.connect(bank).burn(alice.address, u("20")),
      () => token.connect(alice).transfer(bob.address, 1n),
      () => token.connect(spender).transferFrom(alice.address, bob.address, 1n),
    ]) await expect(send()).to.be.revertedWithCustomError(token, "EnforcedPause");
    expect(await token.allowance(alice.address, bank.address)).to.equal(u("20"));
    await token.connect(compliance).unpause();
    await token.connect(alice).transfer(bob.address, 1n);
  });
  it("still allows approval while paused under the documented policy", async function () {
    const { token, compliance, alice, spender } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(compliance).pause();
    await token.connect(alice).approve(spender.address, 10n);
    expect(await token.allowance(alice.address, spender.address)).to.equal(10n);
  });
  it("rejects unauthorized pause and unpause", async function () {
    const { token, outsider, compliance } = await networkHelpers.loadFixture(deployFixture);
    await expect(token.connect(outsider).pause()).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await token.connect(compliance).pause();
    await expect(token.connect(outsider).unpause()).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });
  it("freezes both sender and recipient and supports release", async function () {
    const { token, bank, compliance, alice, bob } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    for (const account of [alice, bob]) {
      await expect(token.connect(compliance).setFrozen(account.address, true))
        .to.emit(token, "FreezeChanged").withArgs(account.address, true);
      await expect(token.connect(alice).transfer(bob.address, 1n))
        .to.be.revertedWithCustomError(token, "AccountFrozen").withArgs(account.address);
      await token.connect(compliance).setFrozen(account.address, false);
    }
    await token.connect(alice).transfer(bob.address, 1n);
  });
  it("rejects a frozen spender", async function () {
    const { token, bank, compliance, alice, bob, spender } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    await token.connect(alice).approve(spender.address, 1n);
    await token.connect(compliance).setFrozen(spender.address, true);
    await expect(token.connect(spender).transferFrom(alice.address, bob.address, 1n))
      .to.be.revertedWithCustomError(token, "AccountFrozen").withArgs(spender.address);
  });
  it("blocks mint and burn involving a frozen holder", async function () {
    const { token, bank, compliance, alice } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    await token.connect(alice).approve(bank.address, u("20"));
    await token.connect(compliance).setFrozen(alice.address, true);
    await expect(token.connect(bank).mint(alice.address, 1n)).to.be.revertedWithCustomError(token, "AccountFrozen");
    await expect(token.connect(bank).burn(alice.address, u("20"))).to.be.revertedWithCustomError(token, "AccountFrozen");
  });
  it("rejects unauthorized and zero-address freezing", async function () {
    const { token, outsider, alice, compliance } = await networkHelpers.loadFixture(deployFixture);
    await expect(token.connect(outsider).setFrozen(alice.address, true)).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(token.connect(compliance).setFrozen(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(token, "ZeroAddress");
  });
  it("rejects an upgrade without UPGRADER_ROLE", async function () {
    const { token, outsider } = await networkHelpers.loadFixture(deployFixture);
    const next = await ethers.deployContract("DepositTokenV2");
    await expect(token.connect(outsider).upgradeToAndCall(await next.getAddress(), "0x"))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });
  it("preserves address, balances, allowance, roles and controls across upgrade", async function () {
    const { token, bank, compliance, alice, bob, spender, registry } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(bank).mint(alice.address, u("100"));
    await token.connect(alice).approve(spender.address, u("30"));
    await token.connect(compliance).setFrozen(bob.address, true);
    await token.connect(compliance).pause();
    const address = await token.getAddress();
    const V2 = await ethers.getContractFactory("DepositTokenV2");
    await upgradesApi.validateUpgrade(address, V2, { kind: "uups" });
    const upgraded = await upgradesApi.upgradeProxy(address, V2);
    expect(await upgraded.getAddress()).to.equal(address);
    expect(await upgraded.version()).to.equal(2n);
    expect(await upgraded.balanceOf(alice.address)).to.equal(u("100"));
    expect(await upgraded.totalSupply()).to.equal(u("100"));
    expect(await upgraded.allowance(alice.address, spender.address)).to.equal(u("30"));
    expect(await upgraded.frozen(bob.address)).to.equal(true);
    expect(await upgraded.paused()).to.equal(true);
    expect(await upgraded.kycRegistry()).to.equal(await registry.getAddress());
    expect(await upgraded.hasRole(await upgraded.MINTER_ROLE(), bank.address)).to.equal(true);
  });
});
