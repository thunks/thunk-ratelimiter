'use strict'
// **Github:** https://github.com/thunks/thunk-ratelimiter
//
// **License:** MIT

/**
 * modified from https://github.com/tj/node-ratelimiter
 *
 * Authors:
 *   Francois-Guillaume Ribreau <npm@fgribreau.com>
 */

const assert = require('assert')
const tman = require('tman')
const thunk = require('thunks')()
const redis = require('thunk-redis')
const IORedis = require('ioredis')
const Limiter = require('..')

const db = redis.createClient({ usePromise: true })
const ioredisDB = new IORedis()

tman.suite('thunk-ratelimiter', function () {
  this.timeout(10000)

  tman.after(function * () {
    db.clientEnd()
  })

  tman.beforeEach(function * () {
    const keys = yield db.keys('LIMIT:*')
    if (!keys.length) return
    yield db.del.apply(db, keys)
  })

  tman.suite('limiter', function () {
    tman.it('get and remove', function * () {
      const id = 'something'
      const limiter = new Limiter({
        max: 5
      })
      limiter.connect(db)

      let res = yield limiter.redis.exists(limiter.prefix + ':' + id)
      assert.strictEqual(res, 0)

      yield limiter.get(id).then(function (res) {
        assert.strictEqual(res.total, 5)
      })
      res = yield limiter.redis.exists(limiter.prefix + ':' + id)
      assert.strictEqual(res, 1)

      yield limiter.remove(id).then(function (res) {
        assert.strictEqual(res, 1)
      })
      res = yield limiter.redis.exists(limiter.prefix + ':' + id)
      assert.strictEqual(res, 0)

      yield limiter.get(id).then(function (res) {
        assert.strictEqual(res.total, 5)
      })
    })
  })

  tman.suite('limit.total', function () {
    tman.it('should represent the total limit per reset period', function () {
      const id = 'something'
      const limiter = new Limiter({
        max: 5
      })
      return limiter.connect(db).get(id).then(function (res) {
        assert.strictEqual(res.total, 5)
      })
    })
  })

  tman.suite('limit.remaining', function () {
    tman.it('should represent the number of requests remaining in the reset period', function * () {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 100000
      })

      let res = yield limiter.connect(db).get(id)
      assert.strictEqual(res.remaining, 4)

      res = yield limiter.get(id)
      assert.strictEqual(res.remaining, 3)

      res = yield limiter.get(id)
      assert.strictEqual(res.total, 5)
      assert.strictEqual(res.remaining, 2)
    })
  })

  tman.suite('limit.duration', function () {
    tman.it('should represent the duration per reset period', function () {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 60000
      })
      limiter.connect(db).get(id).then(function (res) {
        assert.strictEqual(res.duration, 60000)
      })
    })
  })

  tman.suite('limit.reset', function () {
    tman.it('should represent the next reset time', function () {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 60000
      })
      limiter.connect(db).get(id).then(function (res) {
        const left = res.reset - Date.now()
        assert(left <= 60000)
      })
    })
  })

  tman.suite('when arguments is invalid', function () {
    tman.it('invalid "max" should response error', function () {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 60000
      })

      return limiter.connect(db).get(id, -1).then(function (res) {
        throw new Error('should not run')
      }, function (err) {
        assert.strictEqual(err instanceof Error, true)
      })
    })

    tman.it('invalid "duration" should response error', function () {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 60000
      })
      return limiter.connect(db).get(id, 10, 'invalid duration').then(function (res) {
        throw new Error('should not run')
      }, function (err) {
        assert.strictEqual(err instanceof Error, true)
      })
    })
  })

  tman.suite('when the limit is exceeded', function () {
    tman.it('should retain .remaining at 0', function * () {
      const id = 'something'
      const limiter = new Limiter({
        max: 2
      })
      let res = yield limiter.connect(db).get(id)
      assert.strictEqual(res.remaining, 1)

      res = yield limiter.get(id)
      assert.strictEqual(res.remaining, 0)

      res = yield limiter.get(id)
      assert.strictEqual(res.remaining, -1)

      res = yield limiter.get(id)
      assert.strictEqual(res.total, 2)
      assert.strictEqual(res.remaining, -1)
    })
  })

  tman.suite('when the duration is exceeded', function () {
    tman.it('should reset', function * () {
      const id = 'something'
      const limiter = new Limiter({
        duration: 2000,
        max: 2
      })
      let res = yield limiter.connect(db).get(id)
      assert.strictEqual(res.remaining, 1)

      res = yield limiter.get(id)
      assert.strictEqual(res.remaining, 0)

      yield thunk.delay(2100)
      res = yield limiter.get(id)
      const left = res.reset - Date.now()
      assert(left > 1000)
      assert(left <= 2000)
      assert.strictEqual(res.remaining, 1)
    })
  })

  tman.suite('when the duration is exceeded', function () {
    tman.it('should reset', function * () {
      const id = 'something'
      const limiter = new Limiter({
        duration: 2000,
        max: 2
      })

      let res = yield limiter.connect(db).get(id)
      assert.strictEqual(res.remaining, 1)

      res = yield limiter.get(id)
      assert.strictEqual(res.remaining, 0)

      yield thunk.delay(2100)
      res = yield limiter.get(id)
      const left = res.reset - Date.now()

      assert(left > 1000)
      assert(left <= 2000)
      assert.strictEqual(res.remaining, 1)
    })
  })

  tman.suite('when multiple successive calls are made', function () {
    tman.it('the next calls should not create again the limiter in Redis', function * () {
      const id = 'something'
      const limiter = new Limiter({
        duration: 10000,
        max: 2
      })

      let res = yield limiter.connect(db).get(id)
      assert.strictEqual(res.remaining, 1)

      res = yield limiter.get(id)
      assert.strictEqual(res.remaining, 0)

      res = yield limiter.get(id)
      assert.strictEqual(res.remaining, -1)
    })
  })

  tman.suite('when trying to decrease before setting value', function () {
    tman.it('should create with ttl when trying to decrease', function * () {
      const id = 'something'
      const limiter = new Limiter({
        duration: 10000,
        max: 2
      })
      limiter.connect(db)
      yield db.setex('LIMIT:something:count', 1, 1)

      let res = yield limiter.get(id)
      assert.strictEqual(res.remaining, 1)

      res = yield limiter.get(id)
      assert.strictEqual(res.remaining, 0)

      res = yield limiter.get(id)
      assert.strictEqual(res.remaining, -1)
    })
  })

  tman.suite('when give multiple limit policy', function () {
    tman.it('should apply high level limit policy', function * () {
      const policy = ['something1', 3, 2000, 2, 2000, 1, 1000]
      const limiter = new Limiter()
      limiter.connect(db)
      let res = yield limiter.get(policy)
      assert.strictEqual(res.remaining, 2)

      res = yield thunk.all([
        limiter.get(policy),
        limiter.get(policy),
        limiter.get(policy)
      ])
      assert.strictEqual(res[0].remaining, 1)
      assert.strictEqual(res[1].remaining, 0)
      assert.strictEqual(res[2].remaining, -1)

      yield thunk.delay(2010)
      res = yield limiter.get(policy)
      assert.strictEqual(res.total, 2)
      assert.strictEqual(res.duration, 2000)
      assert.strictEqual(res.remaining, 1)

      res = yield limiter.get(policy)
      assert.strictEqual(res.remaining, 0)

      res = yield limiter.get(policy)
      assert.strictEqual(res.remaining, -1)

      yield thunk.delay(2010)
      res = yield limiter.get(policy)
      assert.strictEqual(res.total, 1)
      assert.strictEqual(res.duration, 1000)
      assert.strictEqual(res.remaining, 0)

      res = yield limiter.get(policy)
      assert.strictEqual(res.remaining, -1)

      res = yield limiter.get(policy)
      assert.strictEqual(res.remaining, -1)

      yield thunk.delay(1010)
      res = yield limiter.get(policy)
      assert.strictEqual(res.total, 1)
      assert.strictEqual(res.duration, 1000)
      assert.strictEqual(res.remaining, 0)

      res = yield limiter.get(policy)
      assert.strictEqual(res.remaining, -1)
    })

    tman.it('should restore low level limit policy after double duration', function * () {
      const policy = ['something2', 3, 2000, 2, 2000, 1, 1000]
      const limiter = new Limiter()
      limiter.connect(db)

      let res = yield limiter.get(policy)
      assert.strictEqual(res.remaining, 2)

      res = yield thunk.all([
        limiter.get(policy),
        limiter.get(policy),
        limiter.get(policy),
        limiter.get(policy)
      ])
      assert.strictEqual(res[0].remaining, 1)
      assert.strictEqual(res[1].remaining, 0)
      assert.strictEqual(res[2].remaining, -1)
      assert.strictEqual(res[2].remaining, -1)

      yield thunk.delay(2010)
      res = yield limiter.get(policy)
      assert.strictEqual(res.total, 2)
      assert.strictEqual(res.duration, 2000)
      assert.strictEqual(res.remaining, 1)

      yield limiter.get(policy)
      yield thunk.delay(4010)
      res = yield limiter.get(policy)
      assert.strictEqual(res.total, 3)
      assert.strictEqual(res.duration, 2000)
      assert.strictEqual(res.remaining, 2)
    })
  })

  tman.suite('when multiple concurrent clients modify the limit', function () {
    const id = 'something'
    const clientsCount = 10
    const max = 10000
    const limiters = []

    tman.before(function () {
      for (let i = 0; i < clientsCount; ++i) {
        const limiter = new Limiter({
          duration: 10000,
          max: max
        })
        limiters.push(limiter.connect(redis.createClient()))
      }
    })

    tman.it('should prevent race condition and properly set the expected value', function * () {
      // Warm up and prepare the data.
      let i
      const tasks = []
      const result = []
      for (i = max; i >= 0; i--) {
        result.push(i - 1)
        tasks.push(getLimit())
      }

      function getLimit () {
        return limiters[~~(Math.random() * 10)].get(id).then(function (res) {
          return +res.remaining
        })
      }

      const res = yield tasks
      assert.deepStrictEqual(result, res.sort(function (a, b) { return b - a }))
    })
  })

  tman.suite('limit with vary parameters', function () {
    tman.it('should work with vary parameters for different id', function * () {
      const limiter = new Limiter({
        duration: 10000,
        max: 5
      })

      let res = yield limiter.connect(db).get('something1')
      assert.strictEqual(res.remaining, 4)

      res = yield limiter.get('something2', 10, 10000)
      assert.strictEqual(res.remaining, 9)

      res = yield limiter.get('something3', 20, 10000)
      assert.strictEqual(res.remaining, 19)
    })

    tman.it('should keep limit with vary parameters for the same id', function * () {
      const id = 'something'
      const limiter = new Limiter({
        duration: 1000,
        max: 5
      })

      let res = yield limiter.connect(db).get(id)
      assert.strictEqual(res.remaining, 4)

      res = yield limiter.get(id, 10, 10000)
      assert.strictEqual(res.remaining, 3)

      res = yield limiter.get(id, 20, 10000)
      assert.strictEqual(res.remaining, 2)
    })

    tman.it('should refresh limit with vary parameters for the same id when duration exceeded', function * () {
      const id = 'something4'
      const limiter = new Limiter({
        duration: 1000,
        max: 5
      })

      let res = yield limiter.connect(db).get(id)
      assert.strictEqual(res.remaining, 4)

      res = yield limiter.get(id, 10, 10000)
      assert.strictEqual(res.remaining, 3)

      yield thunk.delay(1100)
      res = yield limiter.get(id, 10, 10000)
      assert.strictEqual(res.remaining, 9)

      res = yield limiter.get(id, 10, 10000)
      assert.strictEqual(res.remaining, 8)
    })
  })

  tman.suite('work with ioredis: limiter', function () {
    tman.it('get and remove', async function () {
      const id = 'something'
      const limiter = new Limiter({
        max: 5
      })
      limiter.connect(ioredisDB)

      let res = await limiter.redis.exists(limiter.prefix + ':' + id)
      assert.strictEqual(res, 0)

      await limiter.get(id).then(function (res) {
        assert.strictEqual(res.total, 5)
      })
      res = await limiter.redis.exists(limiter.prefix + ':' + id)
      assert.strictEqual(res, 1)

      await limiter.remove(id).then(function (res) {
        assert.strictEqual(res, 1)
      })
      res = await limiter.redis.exists(limiter.prefix + ':' + id)
      assert.strictEqual(res, 0)

      await limiter.get(id).then(function (res) {
        assert.strictEqual(res.total, 5)
      })
    })
  })

  tman.suite('work with ioredis: limit.total', function () {
    tman.it('should represent the total limit per reset period', function () {
      const id = 'something'
      const limiter = new Limiter({
        max: 5
      })
      return limiter.connect(ioredisDB).get(id).then(function (res) {
        assert.strictEqual(res.total, 5)
      })
    })
  })

  tman.suite('work with ioredis: limit.remaining', function () {
    tman.it('should represent the number of requests remaining in the reset period', async function () {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 100000
      })

      let res = await limiter.connect(db).get(id)
      assert.strictEqual(res.remaining, 4)

      res = await limiter.get(id)
      assert.strictEqual(res.remaining, 3)

      res = await limiter.get(id)
      assert.strictEqual(res.total, 5)
      assert.strictEqual(res.remaining, 2)
    })
  })
})
