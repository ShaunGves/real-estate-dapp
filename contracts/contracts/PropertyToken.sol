// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PropertyToken
 * @notice ERC-20 token representing fractional ownership of a single property.
 *         One PropertyToken instance exists per property. Minting is
 *         restricted to the property's associated escrow contract, which
 *         calls mint() only when contributors claim their shares after a
 *         successful funding round. Once funding closes, no new tokens can
 *         ever be minted — supply is frozen.
 */
contract PropertyToken is ERC20 {
    /// @notice The PropertyEscrow contract authorized to mint tokens.
    address public immutable escrow;

    /// @notice Once set to true, no more tokens can be minted forever.
    bool public mintingClosed;

    event MintingClosed();

    modifier onlyEscrow() {
        require(msg.sender == escrow, "Only escrow can mint");
        _;
    }

    /// @param _name    Human-readable token name (e.g. "Burj Vista Unit 2304")
    /// @param _symbol  Ticker symbol (e.g. "BURJ-2304")
    /// @param _escrow  Address of the PropertyEscrow that controls minting
    constructor(
        string memory _name,
        string memory _symbol,
        address _escrow
    ) ERC20(_name, _symbol) {
        require(_escrow != address(0), "Escrow address cannot be zero");
        escrow = _escrow;
    }

    /// @notice Mint shares to a contributor. Only the escrow can call this.
    /// @param _to     Recipient of the newly minted shares.
    /// @param _amount Amount of tokens to mint (already scaled by 1e18 decimals).
    function mint(address _to, uint256 _amount) external onlyEscrow {
        require(!mintingClosed, "Minting is permanently closed");
        _mint(_to, _amount);
    }

    /// @notice Permanently disable further minting. Called by escrow after
    ///         all contributors have had a chance to claim. Optional safety
    ///         step — the escrow won't call mint() after claims anyway, but
    ///         this makes the supply cap cryptographically enforceable.
    function closeMinting() external onlyEscrow {
        mintingClosed = true;
        emit MintingClosed();
    }
}
