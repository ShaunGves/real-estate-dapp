// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PropertyToken.sol";

/**
 * @title PropertyEscrow
 * @notice Holds investor contributions in escrow for a single real-estate
 *         property. On successful funding (goal met by deadline):
 *           - Operator calls finalize() to receive the pooled ETH and complete
 *             the property purchase in the real world.
 *           - Each investor calls claimShares() to mint their proportional
 *             PropertyToken ERC-20 shares (pull pattern).
 *         On failure (goal not met): investors call claimRefund() to get ETH back.
 *
 *         One PropertyEscrow exists per property, always paired with exactly
 *         one PropertyToken contract.
 */
contract PropertyEscrow {
    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @notice Fixed conversion: 1 ETH contributed => 1000 whole tokens.
    ///         Scaled by 1e18 to match ERC-20 decimals:
    ///         contribution_in_wei * 1000 / 1e18 whole tokens
    ///         = contribution_in_wei * 1000 token_base_units
    uint256 public constant TOKENS_PER_ETH = 1000;

    // ---------------------------------------------------------------------
    // Immutable property metadata
    // ---------------------------------------------------------------------
    address public immutable operator;       // SPV address that receives funds
    uint256 public immutable goal;           // in wei
    uint256 public immutable deadline;       // unix timestamp
    string  public metadataURI;              // IPFS CID or URL with full details
    string  public title;
    PropertyToken public propertyToken;      // set once, in constructor

    // ---------------------------------------------------------------------
    // Mutable state
    // ---------------------------------------------------------------------
    uint256 public totalRaised;
    bool    public finalized;                // true once operator withdraws
    mapping(address => uint256) public contributions;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------
    event ContributionMade(address indexed investor, uint256 amount);
    event Finalized(address indexed operator, uint256 totalRaised);
    event SharesClaimed(address indexed investor, uint256 tokens);
    event RefundIssued(address indexed investor, uint256 amount);

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @param _operator     SPV / operator address that will receive funds.
    /// @param _goal         Funding goal in wei.
    /// @param _durationDays Funding window in days.
    /// @param _title        Human-readable property title.
    /// @param _metadataURI  IPFS CID or URL containing full metadata.
    /// @param _tokenName    ERC-20 name (e.g. "Burj Vista Unit 2304").
    /// @param _tokenSymbol  ERC-20 symbol (e.g. "BURJ-2304").
    constructor(
        address _operator,
        uint256 _goal,
        uint256 _durationDays,
        string memory _title,
        string memory _metadataURI,
        string memory _tokenName,
        string memory _tokenSymbol
    ) {
        require(_operator != address(0), "Operator cannot be zero");
        require(_goal > 0, "Goal must be positive");
        require(_durationDays > 0, "Duration must be positive");
        require(bytes(_title).length > 0, "Title required");

        operator    = _operator;
        goal        = _goal;
        deadline    = block.timestamp + (_durationDays * 1 days);
        title       = _title;
        metadataURI = _metadataURI;

        // Deploy the paired PropertyToken. `address(this)` grants this escrow
        // exclusive mint rights on the new token contract.
        propertyToken = new PropertyToken(_tokenName, _tokenSymbol, address(this));
    }

    // ---------------------------------------------------------------------
    // Funding phase
    // ---------------------------------------------------------------------

    /// @notice Contribute ETH toward the property's funding goal.
    function contribute() external payable {
        require(block.timestamp < deadline, "Funding window closed");
        require(msg.value > 0, "Must contribute > 0");
        require(msg.sender != operator, "Operator cannot self-contribute");
        require(!finalized, "Already finalized");

        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        emit ContributionMade(msg.sender, msg.value);
    }

    // ---------------------------------------------------------------------
    // Success path
    // ---------------------------------------------------------------------

    /// @notice Operator finalizes the sale: pooled ETH transferred to
    ///         operator for real-world property purchase. Can only run once,
    ///         only after deadline, only if goal was met.
    function finalize() external {
        require(msg.sender == operator, "Only operator");
        require(block.timestamp >= deadline, "Deadline not reached");
        require(totalRaised >= goal, "Goal not met");
        require(!finalized, "Already finalized");

        // CEI: flip state before the external call
        finalized = true;
        uint256 amount = totalRaised;

        (bool success, ) = payable(operator).call{value: amount}("");
        require(success, "Transfer failed");

        emit Finalized(operator, amount);
    }

    /// @notice Investor claims their share tokens after successful finalize.
    ///         Pull pattern — each investor pays their own mint gas.
    function claimShares() external {
        require(finalized, "Not finalized yet");
        uint256 contributed = contributions[msg.sender];
        require(contributed > 0, "No contribution to claim");

        contributions[msg.sender] = 0;

        uint256 tokensToMint = contributed * TOKENS_PER_ETH;

        propertyToken.mint(msg.sender, tokensToMint);

        emit SharesClaimed(msg.sender, tokensToMint);
    }

    // ---------------------------------------------------------------------
    // Failure path
    // ---------------------------------------------------------------------

    /// @notice If goal not met by deadline, investors pull their ETH back.
    function claimRefund() external {
        require(block.timestamp >= deadline, "Deadline not reached");
        require(totalRaised < goal, "Goal was met; no refunds");

        uint256 contributed = contributions[msg.sender];
        require(contributed > 0, "Nothing to refund");

        contributions[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: contributed}("");
        require(success, "Refund failed");

        emit RefundIssued(msg.sender, contributed);
    }

    // ---------------------------------------------------------------------
    // View helpers
    // ---------------------------------------------------------------------

    /// @notice Convenience read — returns everything the frontend needs
    ///         to render a property card in a single RPC call.
    function getSummary()
        external
        view
        returns (
            address operator_,
            address tokenAddress,
            string memory title_,
            string memory metadataURI_,
            uint256 goal_,
            uint256 deadline_,
            uint256 totalRaised_,
            bool finalized_,
            string memory tokenName,
            string memory tokenSymbol
        )
    {
        return (
            operator,
            address(propertyToken),
            title,
            metadataURI,
            goal,
            deadline,
            totalRaised,
            finalized,
            propertyToken.name(),
            propertyToken.symbol()
        );
    }

    /// @notice How many tokens a given investor is entitled to claim right now.
    function claimableShares(address _investor) external view returns (uint256) {
        if (!finalized) return 0;
        return contributions[_investor] * TOKENS_PER_ETH;
    }
}
