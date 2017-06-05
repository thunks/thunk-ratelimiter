# thunk-ratelimiter

The fastest abstract rate limiter.

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Downloads][downloads-image]][downloads-url]

## [thunks](https://github.com/thunks/thunks)

## Implementations:

- [smart-limiter](https://github.com/teambition/smart-limiter) Smart rate limiter middleware for express.
- [toa-ratelimit](https://github.com/toajs/toa-ratelimit) Smart rate limiter module for toa.

## Requirements

- Redis 2.8+

## Installation

```sh
npm install thunk-ratelimiter
```

## Example

 Example Connect middleware implementation limiting against a `user._id`:

```js
const limiter = new Limiter()

limiter.connect(redisClient) // connect to a thunk-redis instance
limiter.get(req.user._id)(function (err, limit) {
  if (err) return next(err)

  response.set('X-RateLimit-Limit', limit.total)
  response.set('X-RateLimit-Remaining', limit.remaining)
  response.set('X-RateLimit-Reset', Math.ceil(limit.reset / 1000))

  // all good
  debug('remaining %s/%s %s', limit.remaining, limit.total, id)
  if (limit.remaining >= 0) return next()

  // not good
  let after = Math.ceil((limit.reset - Date.now()) / 1000)
  response.set('Retry-After', after)
  response.end(429, 'Rate limit exceeded, retry in ' + after + ' seconds')
})
```

## API

### new Limiter(options)

Return a limiter instance.

```js
const limiter = new Limiter()
```

- `options.max`: *Optional*, Type: `Number`, max requests within `duration`, default to `2500`.
- `options.duration`: *Optional*, Type: `Number`, of limit in milliseconds, **should greater than `100` ms**, default to `3600000`.
- `options.prefix`: *Optional*, Type: `String`, redis key namespace, default to `LIMIT`.

### Limiter.prototype.connect([host, options]) => `this`
### Limiter.prototype.connect(redisClient) => `this`

Connect to redis. Arguments are the same as [thunk-redis](https://github.com/thunks/thunk-redis)'s `createClient`, or give a thunk-redis instance.

```js
limiter.connect(6379)
```

### Limiter.prototype.get(id, max, duration, max, duration, ...)
### Limiter.prototype.get([id, max, duration, max, duration, ...])

Return a thunk function that guarantee a limiter result. it support more `max` and `duration` pairs ad limit policy. The first pairs will be used as default. If some trigger limit, then the limiter will apply the next pair policy.

```js
limiter.get('_userIdxxx')(function (err, limit) {
  console.log(err, limit)
})
```

```js
limiter.get('_userIdxxx:POST /files', 100, 60000, 50, 60000)(function (err, limit) {
  console.log(err, limit)
})
```

- `id`: *required*, Type: `String`, the identifier to limit against (typically a user id)
- `max`: *Optional*, Type: `Number`, max requests within `duration`, default to `options.max`.
- `duration`: *Optional*, Type: `Number`, of limit in milliseconds, default to `options.duration`.

**Result Object:**

- `limit.remaining` - number of calls left in current `duration` without decreasing current `get`
- `limit.total` - `max` value
- `limit.duration` - current `duration` in milliseconds
- `limit.reset` - timestamp in milliseconds

### Limiter.prototype.remove(id)

```js
limiter.remove('_userIdxxx')(function (err, res) {
  console.log(err, res)
})
```

[npm-url]: https://npmjs.org/package/thunk-ratelimiter
[npm-image]: http://img.shields.io/npm/v/thunk-ratelimiter.svg

[travis-url]: https://travis-ci.org/thunks/thunk-ratelimiter
[travis-image]: http://img.shields.io/travis/thunks/thunk-ratelimiter.svg

[downloads-url]: https://npmjs.org/package/thunk-ratelimiter
[downloads-image]: http://img.shields.io/npm/dm/thunk-ratelimiter.svg?style=flat-square
