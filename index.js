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
var limitScript = stripBOM(fs.readFileSync(__dirname + '/ratelimite.lua', {encoding: 'utf8'}))

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
  * get limit with `id`:
  *
  *  - `id` {String} identifier being limited
  *
  * @param {Object} opts
  * @api public
  */

Limiter.prototype.get = function (id) {
  return thunk.call(this, this.limitScript || this.loadScript())(function (err, luaSHA) {
    if (err) throw err
    return function (done) {
      this.db.evalsha(luaSHA, 1, this.prefix + ':' + id, this.max, this.duration, Date.now())(function (err, res) {
        if (err) return done(err)
        done(null, {
          remaining: res[0],
          total: res[1],
          reset: res[2]
        })
      })
    }
  })
}

function stripBOM (content) {
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)
  return content
}
