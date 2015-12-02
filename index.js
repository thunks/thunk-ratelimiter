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

var slice = Array.prototype.slice

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
  if (max == null) max = this.max
  if (duration == null) duration = this.duration

  var rest = slice.call(arguments, 3)

  return thunk.call(this, function (done) {
    var args = [limitScript, 1, id, Date.now(), max, duration]
    // check more pairs of `max, duration`
    if (rest.length) args.push.apply(args, rest)
    for (var i = 4, len = args.length; i < len; i += 2) {
      if (!(args[i] > 0 && args[i + 1] > 0)) throw new Error(args[i] + ' or ' + args[i + 1] + ' invalid')
    }

    this.redis.evalauto(args)(function (err, res) {
      if (err) throw err
      return new Limit(res[0], res[1], res[2], res[3])
    })(done)
  })
}

function Limit (remaining, total, duration, reset) {
  this.remaining = remaining
  this.total = total
  this.duration = duration
  this.reset = reset
}
