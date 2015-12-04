'use strict'
// **Github:** https://github.com/thunks/thunk-ratelimiter
//
// **License:** MIT

/* global describe, it */

var assert = require('assert')
var thunk = require('thunks')()
var redis = require('thunk-redis')
var Limiter = require('..')

var db = redis.createClient(7000)

describe('thunk-ratelimiter', function () {
  it('should work in redis cluster', function *() {
    var limiter = new Limiter()
    limiter.connect(db)
    var policy = [10, 5000, 5, 4000, 5, 6000]
    var task = []

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
      while (res.remaining) {
        result.push(res.duration)
        yield thunk.delay(Math.random() * 10)
        res = yield limiter.get(args)
      }
      process.stdout.write('.')
      return result
    }
  })
})
