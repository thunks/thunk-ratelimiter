'use strict'
// **Github:** https://github.com/thunks/thunk-ratelimiter
//
// **License:** MIT

/**!
 * inspire by https://github.com/tj/node-ratelimiter
 *
 */
var fs = require('fs')
var thunk = require('thunks')()
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
  if (!options || !options.db) throw new Error('redis client (options.db) required')

  this.db = options.db
  this.prefix = options.prefix || 'LIMIT'
  this.max = options.max >= 1 ? Math.floor(options.max) : 2500
  this.duration = options.duration >= 1000 ? Math.floor(options.duration) : 3600000
}

Limiter.prototype.limitScript = null

Limiter.prototype.loadScript = function () {
  var ctx = this
  return this.db.script('load', limitScript)(function (err, luaSHA) {
    if (err) throw err
    ctx.limitScript = luaSHA
    return luaSHA
  })
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
  return thunk.call(this, this.limitScript || this.loadScript())(function (err, luaSHA) {
    if (err) throw err
    var db = this.db
    return function (done) {
      db.evalsha(luaSHA, 1, id, max, duration, Date.now())(function (err, res) {
        if (err) return done(err)
        done(null, new Limit(res[0], res[1], res[2]))
      })
    }
  })
}

function Limit (remaining, total, reset) {
  this.remaining = remaining
  this.total = total
  this.reset = reset
}
