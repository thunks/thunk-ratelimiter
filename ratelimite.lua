-- KEYS[1] target hash key
-- ARGV[n >= 3] current timestamp, max count, duration, max count, duration, ...

-- HASH: KEYS[1]
--   field:ct(count)
--   field:lt(limit)
--   field:dn(duration)
--   field:rt(reset)

local res = {}
local policyCount = (#ARGV - 1) / 2
local statusKey = '{' .. KEYS[1] .. '}:S'
local countKey = '{' .. KEYS[1] .. '}:C'
local limit = redis.call('hmget', countKey, 'ct', 'lt', 'dn', 'rt')

if limit[1] then

  res[1] = tonumber(limit[1]) - 1
  res[2] = tonumber(limit[2])
  res[3] = tonumber(limit[3]) or ARGV[3]
  res[4] = tonumber(limit[4])

  if policyCount > 1 and res[1] == -1 then
    redis.call('incr', statusKey)
    redis.call('pexpire', statusKey, res[3] * 2)
    local index = tonumber(redis.call('get', statusKey))
    if index == 1 then
      redis.call('incr', statusKey)
    end
  end

  if res[1] >= -1 then
    redis.call('hincrby', countKey, 'ct', -1)
  else
    res[1] = -1
  end

else

  local index = 1
  if policyCount > 1 then
    index = tonumber(redis.call('get', statusKey)) or 1
    if index > policyCount then
      index = policyCount
    end
  end

  local total = tonumber(ARGV[index * 2])
  res[1] = total - 1
  res[2] = total
  res[3] = tonumber(ARGV[index * 2 + 1])
  res[4] = tonumber(ARGV[1]) + res[3]

  redis.call('hmset', countKey, 'ct', res[1], 'lt', res[2], 'dn', res[3], 'rt', res[4])
  redis.call('pexpire', countKey, res[3])

end

return res
