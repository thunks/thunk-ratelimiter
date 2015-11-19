'use strict'
// **Github:** https://github.com/thunks/thunk-ratelimiter
//
// **License:** MIT

/**
 * inspire by https://github.com/tj/node-ratelimiter
 *
 */
var fs = require('fs')
var thunk = require('thunks')()
var redis = require('thunk-redis')
var limitScript = fs.readFileSync(__dirname + '/ratelimite.lua', {encoding: 'utf8'})

module.exports = Limiter

/**
 * Initialize a new limiter with `options`:
 *
 *  - `db` redis connection instance
 *  - `prefix` redis key namespace
 *  - `max` max requests within `duration` [2500]
 *  - `duration` of limit in milliseconds [3600000]
 *
 * @param {Object} options
 * @api public
 */

function Limiter (options) {
  options = options || {}

  this.redis = options.db // deprecate, will be remove!
  this.prefix = options.prefix || 'LIMIT'
  this.max = options.max >= 1 ? Math.floor(options.max) : 2500
  this.duration = options.duration >= 1000 ? Math.floor(options.duration) : 3600000
}

Limiter.prototype.connect = function (redisClient) {
  if (this.redis) return this
  if (redisClient && redisClient.info && typeof redisClient.evalauto === 'function') {
    this.redis = redisClient
  } else {
    this.redis = redis.createClient.apply(null, arguments)
  }
  return this
}

/**
 * get limit object with `id`
 *
 * @param {String} `id` {String} identifier being limited
 * @param {Number} `max` {Number} max requests within `duration`, default to `this.max`
 * @param {Number} `duration` {Number} of limit in milliseconds, default to `this.duration`
 * @api public
 */

Limiter.prototype.get = function (id, max, duration) {
  id = this.prefix + ':' + id
  max = max > 0 ? max : this.max
  duration = duration > 0 ? duration : this.duration
  return thunk.call(this, function (done) {
    this.redis.evalauto(limitScript, 1, id, max, duration, Date.now())(function (err, res) {
      if (err) throw err
      return new Limit(res[0], res[1], res[2])
    })(done)
  })
}

function Limit (remaining, total, reset) {
  this.remaining = remaining
  this.total = total
  this.reset = reset
}
