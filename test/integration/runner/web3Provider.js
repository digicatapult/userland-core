const { promisify } = require('util')
const memDown = require('memdown')
const ganache = require('ganache-core')

const accounts = [
  '0xa8c04e5b49d1b1ec072364dccd36e43f8684fa32',
  '0x63351c0c561139fa4fa3693c128a3aafb798a9d9',
  '0x7e1970300da1073e679d7e8760be2d7db975e134',
  '0x4e31270f407bb1d322aa20c7502388266a7b6981',
  '0x47ff1e178d8407cba0bc3af7305efe8b5a875762',
  '0xc655dec4a9946b27f1021003c4f06b72a08d89e6',
  '0xd9b7845be9bc767e9453cfcb7e095ea5d6544dc7',
  '0xbf938c237fc05e016d644b4ae46e5aa491e57439',
  '0x1926d1b514a8ea8f82e40db322898dc5526ae618',
  '0xabda10a98fa894eeaf81797d95a07f182952d764',
]

const mkWeb3Provider = async () => {
  const web3Provider = ganache.provider({ db: memDown(), mnemonic: 'userland' })

  let count = 0
  const sendAsync = promisify((rpcPayload, cb) => {
    web3Provider.sendAsync(
      {
        id: count++,
        jsonrpc: '2.0',
        ...rpcPayload,
      },
      cb
    )
  })

  await sendAsync({
    method: 'miner_stop',
    params: [],
  })

  const { result: web3Accounts } = await sendAsync({
    method: 'eth_accounts',
    params: [],
  })

  for (let i in web3Accounts) {
    if (web3Accounts[i] !== accounts[i]) {
      throw new Error('Web3 accounts do not match')
    }
  }

  return {
    web3Provider,
    sendAsync,
  }
}

module.exports = { mkWeb3Provider, accounts }
