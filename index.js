'use strict'
// **Github:** https://github.com/thunks/thunk-ratelimiter
//
// **License:** MIT

/**
 * inspire by https://github.com/tj/node-ratelimiter
 *
 */

const fs = require('fs')
const path = require('path')
const thunk = require('thunks')()
const redis = require('thunk-redis')
const limitScript = fs.readFileSync(path.join(__dirname, 'ratelimiter.lua'), { encoding: 'utf8' })

const slice = Array.prototype.slice

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

  this.prefix = options.prefix || 'LIMIT'
  this.max = options.max >= 1 ? Math.floor(options.max) : 2500
  this.duration = options.duration >= 100 ? Math.floor(options.duration) : 3600000
}

Limiter.prototype.connect = function (redisClient) {
  if (this.redis) return this
  if (redisClient) {
    this.redis = redisClient
    if (this.redis.defineCommand) {
      this.redis.defineCommand('ratelimiter', {
        numberOfKeys: 2,
        lua: limitScript
      })
    }
  } else {
    this.redis = redis.createClient.apply(null, arguments)
  }
  return this
}

/**
 * get limit object with `id`
 *
 * call style: (id, max, duration, max, duration, ...)
 * @param {String} `id` {String} identifier being limited
 * @param {Number} `max` {Number} max requests within `duration`, default to `this.max`
 * @param {Number} `duration` {Number} of limit in milliseconds, default to `this.duration`
 *
 * or call style: ([id, max, duration, max, duration, ...])
 * @api public
 */
Limiter.prototype.get = async function (id) {
  const args = slice.call(Array.isArray(id) ? id : arguments)

  id = this.prefix + ':' + args[0]
  if (args[1] == null) args[1] = this.max
  if (args[2] == null) args[2] = this.duration

  // check pairs of `max, duration`
  for (let i = 1, len = args.length; i < len; i += 2) {
    if (!(args[i] > 0 && args[i + 1] > 0)) {
      return Promise.reject(new Error(args[i] + ' or ' + args[i + 1] + ' is invalid'))
    }
  }

  args[0] = Date.now()
  // if ioredis client or other ...?
  if (this.redis.ratelimiter) {
    args.unshift(`{${id}}:S`, `${id}`)
    const result = await this.redis.ratelimiter(args)
    return new Limit(...result)
  }
  // transfor args to [limitScript, 2, id1, id2, timestamp, max, duration, max, duration, ...]
  args.unshift(limitScript, 2, `{${id}}:S`, `${id}`)
  return thunk.promise(this.redis.evalauto(args)).then(function (res) {
    return new Limit(res[0], res[1], res[2], res[3])
  })
}

/**
 * remove limit object by `id`
 *
 * @api public
 */
Limiter.prototype.remove = function (id) {
  return thunk.promise(this.redis.del(this.prefix + ':' + id))
}

function Limit (remaining, total, duration, reset) {
  this.remaining = remaining
  this.duration = duration
  this.reset = reset
  this.total = total
}
