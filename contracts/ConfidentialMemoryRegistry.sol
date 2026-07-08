// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ConfidentialMemoryRegistry
/// @notice Anchors private memory artifacts by hash and URI without exposing memory plaintext.
contract ConfidentialMemoryRegistry {
    struct MemoryPointer {
        bytes32 agentId;
        bytes32 memoryHash;
        bytes32 schemaHash;
        string uri;
        address recorder;
        uint64 recordedAt;
    }

    address public owner;
    mapping(bytes32 pointerId => MemoryPointer pointer) public pointers;

    event MemoryPointerRecorded(
        bytes32 indexed pointerId,
        bytes32 indexed agentId,
        bytes32 indexed memoryHash,
        bytes32 schemaHash,
        string uri,
        address recorder
    );

    constructor(address initialOwner) {
        require(initialOwner != address(0), "owner required");
        owner = initialOwner;
    }

    function recordMemoryPointer(
        bytes32 agentId,
        bytes32 memoryHash,
        bytes32 schemaHash,
        string calldata uri
    ) external returns (bytes32 pointerId) {
        require(agentId != bytes32(0), "agentId required");
        require(memoryHash != bytes32(0), "memoryHash required");

        pointerId = keccak256(
            abi.encode(block.chainid, address(this), msg.sender, agentId, memoryHash, block.timestamp)
        );
        pointers[pointerId] = MemoryPointer({
            agentId: agentId,
            memoryHash: memoryHash,
            schemaHash: schemaHash,
            uri: uri,
            recorder: msg.sender,
            recordedAt: uint64(block.timestamp)
        });

        emit MemoryPointerRecorded(pointerId, agentId, memoryHash, schemaHash, uri, msg.sender);
    }

    function transferOwnership(address nextOwner) external {
        require(msg.sender == owner, "only owner");
        require(nextOwner != address(0), "owner required");
        owner = nextOwner;
    }
}
