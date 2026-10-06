// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Educational allowlist. It stores no identity documents or AML decisions.
contract KYCRegistry is AccessControl {
    bytes32 public constant KYC_ADMIN_ROLE = keccak256("KYC_ADMIN_ROLE");
    mapping(address => bool) private _verified;

    error ZeroAddress();
    event KYCStatusChanged(address indexed account, bool verified);

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(KYC_ADMIN_ROLE, admin);
    }

    function setVerified(address account, bool verified)
        external onlyRole(KYC_ADMIN_ROLE)
    {
        if (account == address(0)) revert ZeroAddress();
        _verified[account] = verified;
        emit KYCStatusChanged(account, verified);
    }

    function isVerified(address account) external view returns (bool) {
        return _verified[account];
    }
}
