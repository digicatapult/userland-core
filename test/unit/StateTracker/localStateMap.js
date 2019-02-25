const { describe, it } = require('mocha')
const { expect } = require('chai')

const mkStateMap = require('../../../lib/StateTracker/localStateMap')

describe('localStateMap', function() {
  describe('set', function() {
    describe('get after set', function() {
      it('should get the set value', function() {
        const instance = mkStateMap()
        const value = Symbol()
        instance.set('a', 'b', value)
        expect(instance.get('a', 'b')).to.equal(value)
      })
    })

    describe('set twice', function() {
      it('should get the set value', function() {
        const instance = mkStateMap()
        const value = Symbol()
        instance.set('a', 'b', Symbol())
        instance.set('a', 'b', value)
        expect(instance.get('a', 'b')).to.equal(value)
      })
    })
  })

  describe('get', function() {
    describe('get on unset key', function() {
      it('should get undefined', function() {
        const instance = mkStateMap()
        const value = Symbol()
        instance.set('a', 'b', value)
        expect(instance.get('a', 'c')).to.equal(undefined)
      })
    })

    describe('get on unset address', function() {
      it('should get undefined', function() {
        const instance = mkStateMap()
        const value = Symbol()
        instance.set('a', 'b', value)
        expect(instance.get('c', 'b')).to.equal(undefined)
      })
    })
  })

  describe('has', function() {
    it('should return true for set keys', function() {
      const instance = mkStateMap()
      const value = Symbol()
      instance.set('a', 'b', value)
      expect(instance.has('a', 'b')).to.equal(true)
    })

    it('should return true for set keys where value is null', function() {
      const instance = mkStateMap()
      instance.set('a', 'b', null)
      expect(instance.has('a', 'b')).to.equal(true)
    })

    it('should return true for set keys where value is undefined', function() {
      const instance = mkStateMap()
      instance.set('a', 'b', undefined)
      expect(instance.has('a', 'b')).to.equal(true)
    })

    it('should return false for unset keys', function() {
      const instance = mkStateMap()
      const value = Symbol()
      instance.set('a', 'b', value)
      expect(instance.has('c', 'b')).to.equal(false)
    })
  })

  describe('iterator', function() {
    it('should iterate over set keys', function() {
      const instance = mkStateMap()
      const valueAB = Symbol(),
        valueCB = Symbol(),
        valueCD = Symbol()
      instance.set('a', 'b', Symbol())
      instance.set('a', 'b', valueAB)
      instance.set('c', 'b', valueCB)
      instance.set('c', 'd', valueCD)

      const results = []
      for (const [a, k, v] of instance) {
        results.push([a, k, v])
      }
      results.sort(([a1, k1], [a2, k2]) => {
        const ak1 = `${a1}-${k1}`,
          ak2 = `${a2}-${k2}`
        if (ak1 < ak2) return -1
        else if (ak1 > ak2) return 1
        else return 0
      })

      expect(results).to.deep.equal([
        ['a', 'b', valueAB],
        ['c', 'b', valueCB],
        ['c', 'd', valueCD],
      ])
    })
  })
})
