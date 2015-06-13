-- KEYS[1] target hash key
-- ARGV[3] max count, expire time, current timestamp

-- HASH: KEYS[1]
--   field:ct(count)
--   field:lt(limit)
--   field:rt(reset)

local limit = redis.call('hmget', KEYS[1], 'ct', 'lt', 'rt')
local res = {}

if limit[1] then
  res[1] = tonumber(limit[1]) - 1
  res[2] = tonumber(limit[2])
  res[3] = tonumber(limit[3])

  if res[1] > 0 then
    redis.call('hincrby', KEYS[1], 'ct', -1)
  end
else
  res[1] = tonumber(ARGV[1])
  res[2] = res[1]
  res[3] = tonumber(ARGV[2]) + tonumber(ARGV[3])

  redis.call('hmset', KEYS[1], 'ct', res[1], 'lt', res[1], 'rt', res[3])
  redis.call('pexpire', KEYS[1], ARGV[2])
end

return res
