import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { ThrottlerStorage } from '@nestjs/throttler';

type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

const incrementScript = `
local blocked = redis.call('PTTL', KEYS[2])
if blocked > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or '0'), redis.call('PTTL', KEYS[1]), 1, blocked }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local remaining = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) and tonumber(ARGV[3]) > 0 then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { hits, remaining, 1, tonumber(ARGV[3]) }
end
return { hits, remaining, 0, 0 }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly client: Redis;

  constructor(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (this.client.status === 'wait') await this.client.connect();
    const hitsKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `${hitsKey}:blocked`;
    const result = await this.client.eval(
      incrementScript,
      2,
      hitsKey,
      blockKey,
      ttl,
      limit,
      blockDuration,
    ) as [number, number, number, number];
    return {
      totalHits: Number(result[0]),
      timeToExpire: Math.max(0, Math.ceil(Number(result[1]) / 1000)),
      isBlocked: Number(result[2]) === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(Number(result[3]) / 1000)),
    };
  }

  async onApplicationShutdown() {
    await this.client.quit();
  }
}
