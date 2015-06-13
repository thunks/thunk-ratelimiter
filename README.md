thunk-ratelimiter
==========
Abstract rate limiter backed by thunk-redis.

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

## [thunks](https://github.com/thunks/thunks)

## it is implemented with redis script and very fast!

## Requirements

- Redis 2.8+

## Installation

```
npm install thunk-ratelimiter
```

## Example

 Example Connect middleware implementation limiting against a `user._id`:

```js
var limiter = new Limiter({db: db})


limiter.get(req.user._id)(function(err, limit){
  if (err) return next(err)

  res.set('X-RateLimit-Limit', limit.total)
  res.set('X-RateLimit-Remaining', limit.remaining - 1)
  res.set('X-RateLimit-Reset', limit.reset)

  // all good
  debug('remaining %s/%s %s', limit.remaining - 1, limit.total, id)
  if (limit.remaining) return next()

  // not good
  var after = Math.floor((limit.reset - Date.now()) / 1000)
  res.set('Retry-After', after)

  res.send(429, 'Rate limit exceeded, retry in ' + after + ' seconds')
})
```

## API

### new Limiter(options)

Return a limiter instance.

```js
var limiter = new Limiter({db: db})
```

- `options.db`: *required*, Type: `Object`, redis connection instance.
- `options.max`: *Optional*, Type: `Number`, max requests within `duration`, Default: `2500`.
- `options.duration`: *Optional*, Type: `Number`, of limit in milliseconds, Default: `3600000`.
- `options.prefix`: *Optional*, Type: `String`, redis key namespace, Default: `LIMIT`.

### limiter.get(id)

Return a thunk function that guarantee a limiter result.

```js
var limiter.get('_userIdxxx')(function (err, limit) {
  console.log(err, limit)
})
```

- `id`: *required*, Type: `String`, the identifier to limit against (typically a user id)

**Result Object:**

- `limit.total` - `max` value
- `limit.remaining` - number of calls left in current `duration` without decreasing current `get`
- `limit.reset` - timestamp in milliseconds

## Who's using

### [Teambition](https://www.teambition.com/)
1. Teambition community https://bbs.teambition.com/

[npm-url]: https://npmjs.org/package/thunk-ratelimiter
[npm-image]: http://img.shields.io/npm/v/thunk-ratelimiter.svg

[travis-url]: https://travis-ci.org/thunks/thunk-ratelimiter
[travis-image]: http://img.shields.io/travis/thunks/thunk-ratelimiter.svg
