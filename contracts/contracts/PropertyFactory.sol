// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PropertyEscrow.sol";

/**
 * @title PropertyFactory
 * @notice Central registry + deployer for all property offerings.
 *
 *         The factory owner (analog of DLD / platform admin) authorizes
 *         operators (analog of VARA-licensed SPVs). Only authorized
 *         operators can list new properties. Each listing deploys a fresh
 *         PropertyEscrow, which in turn deploys its own PropertyToken.
 *
 *         The factory keeps a public list of every deployed escrow so the
 *         frontend can enumerate properties without indexing events.
 */
contract PropertyFactory is Ownable {
    address[] public properties;
    mapping(address => bool) public isOperator;

    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event PropertyCreated(
        address indexed escrow,
        address indexed token,
        address indexed operator,
        string title,
        uint256 goal,
        uint256 deadline
    );

    constructor() Ownable(msg.sender) {}

    // ---------------------------------------------------------------------
    // Operator management (owner only)
    // ---------------------------------------------------------------------

    function addOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Operator cannot be zero");
        require(!isOperator[_operator], "Already an operator");
        isOperator[_operator] = true;
        emit OperatorAdded(_operator);
    }

    function removeOperator(address _operator) external onlyOwner {
        require(isOperator[_operator], "Not an operator");
        isOperator[_operator] = false;
        emit OperatorRemoved(_operator);
    }

    // ---------------------------------------------------------------------
    // Property listing (operator only)
    // ---------------------------------------------------------------------

    /// @notice List a new property. Deploys a PropertyEscrow + PropertyToken pair.
    /// @return escrowAddress The address of the newly deployed PropertyEscrow.
    function createProperty(
        uint256 _goal,
        uint256 _durationDays,
        string memory _title,
        string memory _metadataURI,
        string memory _tokenName,
        string memory _tokenSymbol
    ) external returns (address escrowAddress) {
        require(isOperator[msg.sender], "Not an authorized operator");

        PropertyEscrow escrow = new PropertyEscrow(
            msg.sender,
            _goal,
            _durationDays,
            _title,
            _metadataURI,
            _tokenName,
            _tokenSymbol
        );

        escrowAddress = address(escrow);
        properties.push(escrowAddress);

        emit PropertyCreated(
            escrowAddress,
            address(escrow.propertyToken()),
            msg.sender,
            _title,
            _goal,
            escrow.deadline()
        );
    }

    // ---------------------------------------------------------------------
    // View helpers
    // ---------------------------------------------------------------------

    function getPropertyCount() external view returns (uint256) {
        return properties.length;
    }

    function getAllProperties() external view returns (address[] memory) {
        return properties;
    }
}
