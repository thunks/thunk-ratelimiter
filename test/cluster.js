'use strict'
// **Github:** https://github.com/thunks/thunk-ratelimiter
//
// **License:** MIT

const assert = require('assert')
const tman = require('tman')
const thunk = require('thunks')()
const redis = require('thunk-redis')
const Limiter = require('..')

const db = redis.createClient(7000)

tman.describe('thunk-ratelimiter', function () {
  this.timeout(100000)

  tman.it('should work in redis cluster', function * () {
    const limiter = new Limiter()
    limiter.connect(db)
    const policy = [10, 5000, 5, 4000, 5, 6000]
    const task = []

    for (let i = 1; i <= 2048; i++) task.push(runLimit(i))
    yield task

    function * runLimit (id) {
      let args = [id].concat(policy)

      let res = yield child(args)
      for (let i = 0; i < 10; i++) assert.strictEqual(res[i], 5000)
      yield thunk.delay(res[0])

      res = yield child(args)
      for (let i = 0; i < 5; i++) assert.strictEqual(res[i], 4000)
      yield thunk.delay(res[0])

      res = yield child(args)
      for (let i = 0; i < 5; i++) assert.strictEqual(res[i], 6000)
    }

    function * child (args) {
      let result = []
      let res = yield limiter.get(args)
      while (res.remaining >= 0) {
        result.push(res.duration)
        yield thunk.delay(Math.random() * 10)
        res = yield limiter.get(args)
      }
      process.stdout.write('.')
      return result
    }
  })
})
