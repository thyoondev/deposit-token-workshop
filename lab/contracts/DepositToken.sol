// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

interface IKYCRegistry {
    function isVerified(address account) external view returns (bool);
}

/// @notice Local teaching model. Mint/burn do not move real bank deposits.
contract DepositToken is ERC20Upgradeable, AccessControlUpgradeable,
    PausableUpgradeable, UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FREEZER_ROLE = keccak256("FREEZER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    IKYCRegistry public kycRegistry;
    mapping(address => bool) public frozen;

    error ZeroAddress();
    error InvalidRegistry();
    error ZeroAmount();
    error KYCRequired(address account);
    error AccountFrozen(address account);
    event FreezeChanged(address indexed account, bool frozen);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin, address registry) public initializer {
        if (admin == address(0)) revert ZeroAddress();
        if (registry.code.length == 0) revert InvalidRegistry();
        __ERC20_init("Workshop Deposit Token", "WDT");
        __AccessControl_init();
        __Pausable_init();
        kycRegistry = IKYCRegistry(registry);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
    }

    /// @notice This teaching policy requires both an operator role and allowance.
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        _spendAllowance(from, _msgSender(), amount);
        _burn(from, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function setFrozen(address account, bool status)
        external onlyRole(FREEZER_ROLE)
    {
        if (account == address(0)) revert ZeroAddress();
        frozen[account] = status;
        emit FreezeChanged(account, status);
    }

    function _checkAccount(address account) internal view {
        if (frozen[account]) revert AccountFrozen(account);
        if (!kycRegistry.isVerified(account)) revert KYCRequired(account);
    }

    function _update(address from, address to, uint256 value) internal override {
        _requireNotPaused();
        if (from != address(0)) _checkAccount(from);
        if (to != address(0)) _checkAccount(to);
        // For normal transfers, our policy also checks the caller/spender.
        if (from != address(0) && to != address(0)) _checkAccount(_msgSender());
        super._update(from, to, value);
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}
