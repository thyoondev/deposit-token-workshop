// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {DepositToken} from "./DepositToken.sol";

contract DepositTokenV2 is DepositToken {
    function version() external pure returns (uint256) { return 2; }
}
