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
const Limiter = require('..')

const db = redis.createClient()

tman.suite('thunk-ratelimiter', function () {
  this.timeout(10000)

  tman.after(function (done) {
    db.clientEnd()
    done()
  })

  tman.beforeEach(function (done) {
    db.keys('LIMIT:*')(function (err, keys) {
      if (err) throw err
      if (!keys.length) return
      return db.del.apply(db, keys)
    })(done)
  })

  tman.suite('limiter', function () {
    tman.it('get and remove', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        max: 5
      })
      limiter.connect(db)

      limiter.redis.exists(limiter.prefix + ':' + id)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res, 0)
        return limiter.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.total, 5)
        return limiter.redis.exists(limiter.prefix + ':' + id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res, 1)
        return limiter.remove(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res, 1)
        return limiter.redis.exists(limiter.prefix + ':' + id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res, 0)
        return limiter.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.total, 5)
      })(done)
    })
  })

  tman.suite('limit.total', function () {
    tman.it('should represent the total limit per reset period', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        max: 5
      })
      limiter.connect(db).get(id)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.total, 5)
      })(done)
    })
  })

  tman.suite('limit.remaining', function () {
    tman.it('should represent the number of requests remaining in the reset period', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 100000
      })
      limiter.connect(db).get(id)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 4)
        return this.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 3)
        return this.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.total, 5)
        assert.strictEqual(res.remaining, 2)
      })(done)
    })
  })

  tman.suite('limit.duration', function () {
    tman.it('should represent the duration per reset period', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 60000
      })
      limiter.connect(db).get(id)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.duration, 60000)
      })(done)
    })
  })

  tman.suite('limit.reset', function () {
    tman.it('should represent the next reset time', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 60000
      })
      limiter.connect(db).get(id)(function (err, res) {
        assert.strictEqual(err, null)
        const left = res.reset - Date.now()
        assert(left <= 60000)
      })(done)
    })
  })

  tman.suite('when arguments is invalid', function () {
    tman.it('invalid "max" should response error', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 60000
      })
      limiter.connect(db).get(id, -1)(function (err, res) {
        assert.strictEqual(err instanceof Error, true)
      })(done)
    })

    tman.it('invalid "duration" should response error', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        max: 5,
        duration: 60000
      })
      limiter.connect(db).get(id, 10, 'invalid duration')(function (err, res) {
        assert.strictEqual(err instanceof Error, true)
      })(done)
    })
  })

  tman.suite('when the limit is exceeded', function () {
    tman.it('should retain .remaining at 0', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        max: 2
      })
      limiter.connect(db).get(id)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 1)
        return this.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 0)
        return this.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, -1)
        return this.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.total, 2)
        assert.strictEqual(res.remaining, -1)
      })(done)
    })
  })

  tman.suite('when the duration is exceeded', function () {
    tman.it('should reset', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        duration: 2000,
        max: 2
      })
      limiter.connect(db).get(id)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 1)
        return this.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 0)
        return thunk.seq(thunk.delay(2100), this.get(id))
      })(function (err, res) {
        assert.strictEqual(err, null)
        var left = res[1].reset - Date.now()
        assert(left > 1000)
        assert(left <= 2000)
        assert.strictEqual(res[1].remaining, 1)
      })(done)
    })
  })

  tman.suite('when the duration is exceeded', function () {
    tman.it('should reset', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        duration: 2000,
        max: 2
      })
      limiter.connect(db).get(id)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 1)
        return this.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 0)
        return thunk.seq(thunk.delay(2100), this.get(id))
      })(function (err, res) {
        assert.strictEqual(err, null)
        var left = res[1].reset - Date.now()
        assert(left > 1000)
        assert(left <= 2000)
        assert.strictEqual(res[1].remaining, 1)
      })(done)
    })
  })

  tman.suite('when multiple successive calls are made', function () {
    tman.it('the next calls should not create again the limiter in Redis', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        duration: 10000,
        max: 2
      })
      limiter.connect(db).get(id)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 1)
        return limiter.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 0)
        return limiter.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, -1)
      })(done)
    })
  })

  tman.suite('when trying to decrease before setting value', function () {
    tman.it('should create with ttl when trying to decrease', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        duration: 10000,
        max: 2
      })
      limiter.connect(db)
      db.setex('LIMIT:something:count', -1, 1)(function () {
        return limiter.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 1)
        return limiter.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 0)
        return limiter.get(id)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, -1)
      })(done)
    })
  })

  tman.suite('when give multiple limit policy', function () {
    tman.it('should apply high level limit policy', function (done) {
      const policy = ['something1', 3, 2000, 2, 2000, 1, 1000]
      const limiter = new Limiter()
      limiter.connect(db)
      limiter.get(policy)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 2)
        return thunk.all([
          limiter.get(policy),
          limiter.get(policy),
          limiter.get(policy)
        ])
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res[0].remaining, 1)
        assert.strictEqual(res[1].remaining, 0)
        assert.strictEqual(res[2].remaining, -1)
        return thunk.seq([
          thunk.delay(2010),
          limiter.get(policy),
          limiter.get(policy),
          limiter.get(policy)
        ])
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res[1].total, 2)
        assert.strictEqual(res[1].duration, 2000)
        assert.strictEqual(res[1].remaining, 1)
        assert.strictEqual(res[2].remaining, 0)
        assert.strictEqual(res[3].remaining, -1)
        return thunk.seq([
          thunk.delay(2010),
          limiter.get(policy),
          limiter.get(policy),
          limiter.get(policy)
        ])
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res[1].total, 1)
        assert.strictEqual(res[1].duration, 1000)
        assert.strictEqual(res[1].remaining, 0)
        assert.strictEqual(res[2].remaining, -1)
        assert.strictEqual(res[3].remaining, -1)
        return thunk.seq([
          thunk.delay(1010),
          limiter.get(policy),
          limiter.get(policy)
        ])
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res[1].total, 1)
        assert.strictEqual(res[1].duration, 1000)
        assert.strictEqual(res[1].remaining, 0)
        assert.strictEqual(res[2].remaining, -1)
      })(done)
    })

    tman.it('should restore low level limit policy after double duration', function (done) {
      const policy = ['something2', 3, 2000, 2, 2000, 1, 1000]
      const limiter = new Limiter()
      limiter.connect(db)
      limiter.get(policy)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 2)
        return thunk.all([
          limiter.get(policy),
          limiter.get(policy),
          limiter.get(policy),
          limiter.get(policy)
        ])
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res[0].remaining, 1)
        assert.strictEqual(res[1].remaining, 0)
        assert.strictEqual(res[2].remaining, -1)
        assert.strictEqual(res[2].remaining, -1)
        return thunk.seq([
          thunk.delay(2010),
          limiter.get(policy),
          limiter.get(policy)
        ])
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res[1].total, 2)
        assert.strictEqual(res[1].duration, 2000)
        assert.strictEqual(res[1].remaining, 1)
        return thunk.seq([
          thunk.delay(4010),
          limiter.get(policy)
        ])
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res[1].total, 3)
        assert.strictEqual(res[1].duration, 2000)
        assert.strictEqual(res[1].remaining, 2)
      })(done)
    })
  })

  tman.suite('when multiple concurrent clients modify the limit', function () {
    const id = 'something'
    const clientsCount = 10
    const max = 10000
    const limiters = []

    tman.before(function () {
      for (let i = 0; i < clientsCount; ++i) {
        let limiter = new Limiter({
          duration: 10000,
          max: max
        })
        limiters.push(limiter.connect(redis.createClient()))
      }
    })

    tman.it('should prevent race condition and properly set the expected value', function (done) {
      // Warm up and prepare the data.
      let i
      const tasks = []
      const result = []
      for (i = max; i >= 0; i--) {
        result.push(i - 1)
        tasks.push(getLimit())
      }

      function getLimit () {
        return limiters[~~(Math.random() * 10)].get(id)(function (err, res) {
          assert.strictEqual(err, null)
          return +res.remaining
        })
      }

      thunk.all(tasks)(function (err, res) {
        assert.strictEqual(err, null)
        assert.deepEqual(result, res.sort(function (a, b) { return b - a }))
      })(done)
    })
  })

  tman.suite('limit with vary parameters', function () {
    tman.it('should work with vary parameters for different id', function (done) {
      const limiter = new Limiter({
        duration: 10000,
        max: 5
      })
      limiter.connect(db).get('something1')(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 4)
        return limiter.get('something2', 10, 10000)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 9)
        return limiter.get('something3', 20, 10000)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 19)
      })(done)
    })

    tman.it('should keep limit with vary parameters for the same id', function (done) {
      const id = 'something'
      const limiter = new Limiter({
        duration: 1000,
        max: 5
      })
      limiter.connect(db).get(id)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 4)
        return limiter.get(id, 10, 10000)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 3)
        return limiter.get(id, 20, 10000)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 2)
      })(done)
    })

    tman.it('should refresh limit with vary parameters for the same id when duration exceeded', function (done) {
      const id = 'something4'
      const limiter = new Limiter({
        duration: 1000,
        max: 5
      })
      limiter.connect(db).get(id)(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 4)
        return limiter.get(id, 10, 10000)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 3)
        return thunk.seq(thunk.delay(1100), limiter.get(id, 10, 10000))
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res[1].remaining, 9)
        return limiter.get(id, 10, 10000)
      })(function (err, res) {
        assert.strictEqual(err, null)
        assert.strictEqual(res.remaining, 8)
      })(done)
    })
  })
})
