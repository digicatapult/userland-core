# The Userland Concept

The aim of Userland is to minimize the cost of running a smart-contract without affecting any of the security guarantees provided by on-chain contract execution. In short this is done by adding new mechanics to the EVM which sandboxes the execution of a set of smart-contracts. These smart-contracts are executed in much the same way as any other contract, but their execution is deferred until this is observed by an interested party. This places certain limitations on the behaviour of a Userland contract, notably that they cannot affect the state of a contract not present in the same Userland, but has the advantage that all execution costs are reduced to zero. Userland is most applicable to applications whose state can be public, but whose functionality is isolated from external smart-contracts.

## Ethereum runtime

Before laying out how Userland affects the runtime behaviour of Ethereum it is worth outlining the relevant content of the Ethereum (yellow paper)[https://ethereum.github.io/yellowpaper/paper.pdf]. The ultimate goal is to isolate the effects of a smart contract to a subset of the address space.

Transactions in ethereum are executed serially in the order they are present inside a block. Each transaction begins by subtracting the maximum transaction cost from the sender and continues by either entering the code of the `to` address or by entering code in the context of a new address. This code can modify state only in specific cases:

1. It can store data into the storage space of the currently executing contract
2. It can store code into the code space of the currently executing contract (in the case of creating a new account)
3. It can increment the nonce of the currently executing contract and trigger the creation of a new address
4. It can call into another contract, which may in turn perform state modifications as per this list. This process can also be used to transfer ether
5. It can self-destruct, setting the code of the currently executing contract to empty and sending ether to a specified address

It is important to note that a contract can only affect its own state/nonce (`SSTORE`, `CREATE`, `CREATE2`, `SELFDESTRUCT`), transfer ether from itself to another account (`CALL`, `SELFDESTRUCT`) or move execution context to another address (`CALL`, `STATICCALL`, `CALLCODE`, `DELEGATECALL`, `CREATE`, `CREATE2`).

## Userland runtime

The Userland runtime acts to isolate state changes to a limited address space such that contracts within this address space can only affect the state of one-another. The method by which this is done essentially is as follows:

1. Define a contract on the main-chain which conforms to a standard outlined below. The address of this contract is the Userland address
2. Interpret the storage of the Userland code at the Userland address as the creation of an off-chain contract, with cloned storage state and nonce `1`, at the same address but with code as defined (here)[userlandContract.md].
3. Interpret calls/transactions on the main-chain as executing first against the off-chain state (setting `value` to 0) and then against the main-chain. Code execution off-chain is modified as follows
   - `CREATE` and `CREATE2` operations create new contracts in the off-chain address space using nonces defined in the off-chain address space.
   - `SELFDESTRUCT`, `SSTORE` and `SLOAD` operations executed off-chain act against the off-chain state
   - `CALL`, `STATICCALL`, `CALLCODE` and `DELEGATECALL` operations executed off-chain depend on the emptyness of the target address (the current address in the case of `DELEGATECALL` and `CALLCODE`). If the address is non-empty the execution behaves as usual, just executing off-chain. If empty the call behaves like a `STATICCALL` against the main-chain.

The important thing to note is that once an execution context is started off-chain this can never modify main-chain state. Off-chain contracts can create new off-chain contracts which can call into each other normally. All off-chain state is isolated from the main-chain but can be reproduced by executing transactions as per the logic above.

This is to be defined more formally in a forthcoming whitepaper.
