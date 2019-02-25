# Userland contract code

The Userland contract defines the bootstrap point for a Userland and is defined separately for the main-chain and inside the Userland. On the main-chain a Userland can be identified by pattern matching the account `code` to a fixed value defined below and the nonce to the uint256 value `1`. Storage slot 0 can then be interpreted as the owner of the userland and storage slot 1 as the maximum processable block number for the Userland.

Subscriptions are made to Userlands counter-factually. This means the observance of the creation of the main-chain Userland contract is what bootstraps the creation of the Userland code off-chain. The code placed into the Userland occurs at the same address, but with entirely different functionality as outlined below. Also copied across are the values of storage slots 0 and 1. This functionality allows the owner to execute a single create operation in the Userland with data taken from the call input thus allowing the owner to inject arbitrary functionality into the Userland.

## Main-chain code

The Userland contract on the main-chain returns the values in the first two storage slots which are to be interpreted as the address of the owner and the maximum block number to process for this Userland respectively.

### Pseudo-code

```
var owner = SLOAD 0
var maxBlockNumber = SLOAD 1
return (owner, maxBlockNumber)
```

### Assembly

```
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;; Main-chain Code ;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

PC ; [0]                                              0x58
SLOAD ; [owner]                                       0x54
PUSH1 0x01 ; [1, owner]                               0x6001
SLOAD ; [maxBlockNumber, owner]                       0x54
PUSH1 0x20 ; [0x20, maxBlockNumber, owner]            0x6020
MSTORE ; [owner]                                      0x52
PUSH1 0x00 ; [0, owner]                               0x6000
MSTORE ; []                                           0x52
PUSH1 0x40 ; [0x40]                                   0x6040
PUSH1 0x00 ; [0, 0x40]                                0x6000
RETURN ;                                              0xf3
```

The compiled assembly for the main-chain contract is therefore `0x585460015460205260005260406000f3` which encapsulates the required functionality. A valid Userland is then identified as a contract account with this code and nonce `1`. The owner and max block number can be interpreted as the values returned, in that order, from a call to the main-chain contract, which correspond to storage slots 0 and 1 respectively.

## Userland code

The Userland code allows the owner to execute a single create operation in the Userland with data taken from the call input thus allowing the owner to inject arbitrary functionality into the Userland. When this code is executed by the owner for first time slot 0 is replaced by 0 value to prevent re-entry.

### Pseudo-code

```
var owner = SLOAD 0
var maxBlockNumber = SLOAD 1
if (caller === owner) {
  SSTORE 0 0
  CREATE data
}
```

### Assembly

```
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;; Userland Code ;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

PC ; [0]                                              0x58
DUP1 ; [0, 0]                                         0x80
SLOAD ; [OWNER, 0]                                    0x54
CALLER ; [CALLER, OWNER, 0]                           0x33
EQ ; [CALLER == OWNER, 0]                             0x14
PUSH1 LOC_A; [LOC_A, CALLER == OWNER, 0]              0x600a
JUMPI ; [0]                                           0x57
POP ; []                                              0x50
STOP ;                                                0x00
; LOC_A
JUMPDEST ; [0]                                        0x5b
DUP1 ; [0, 0]                                         0x80
SSTORE ; []                                           0x55
CALLDATASIZE ; [CALLDATASIZE]                         0x36
PUSH1 0 ; [0, CALLDATASIZE]                           0x6000
DUP2 ; [CALLDATASIZE, 0, CALLDATASIZE]                0x81
DUP2 ; [0, CALLDATASIZE, 0, CALLDATASIZE]             0x81
DUP3 ; [0, 0, CALLDATASIZE, 0, CALLDATASIZE]          0x82
CALLDATACOPY ; [0, CALLDATASIZE]                      0x37
DUP1; [0, 0, CALLDATASIZE]                            0x80
CREATE ;                                              0xf0
POP ;                                                 0x50
STOP ;                                                0x00
```

The compiled code for the Userland off-chain contract is therefore `0x5880543314600a5750005b80553660008181823780f05000`
