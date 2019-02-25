const mkStateMap = () => {
  let map = new Map()
  return {
    has: (addr, key) => map.has(addr) && map.get(addr).has(key),
    get: (addr, key) => map.get(addr) && map.get(addr).get(key),
    set: (addr, key, value) => {
      if (!map.has(addr)) map.set(addr, new Map())
      map.get(addr).set(key, value)
    },
    clear: addr => {
      map.delete(addr)
    },
    [Symbol.iterator]: function*() {
      for (const [addr, innerMap] of map) {
        for (const [key, value] of innerMap) {
          yield [addr, key, value]
        }
      }
    },
  }
}

module.exports = mkStateMap
