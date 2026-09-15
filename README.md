![GitHub package.json version](https://img.shields.io/github/package-json/v/thzero/library_server_repository_redis_ioredis)
![David](https://img.shields.io/david/thzero/library_server_repository_redis_ioredis)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# library_server_repository_redis_ioredis

Binds [ioredis](https://github.com/redis/ioredis) to the Redis repository base in [@thzero/library_server_repository_redis](https://github.com/thzero/library_server_repository_redis).

This is a thin package: it implements the one abstract method the base leaves open. Connection caching, the config lookup and the open-once mutex all live in the base.

## Requirements

### NodeJs

[NodeJs](https://nodejs.org) version 22+

### Redis

A reachable Redis server. `username` requires Redis 6 or later.

### Installation

[![NPM](https://nodei.co/npm/@thzero/library_server_repository_redis_ioredis.png?compact=true)](https://npmjs.org/package/@thzero/library_server_repository_redis_ioredis)

```
npm install @thzero/library_server_repository_redis_ioredis
```

#### Peer dependencies

* `@thzero/library_common`
* `@thzero/library_common_service`
* `@thzero/library_server`
* `@thzero/library_server_repository_redis`

## What it provides

`index.js` — default export `IoredisRedisRepository`, extending `RedisRepository`. It implements `_initializeClientConnection(correlationId, connectionInfo, clientName, config)` and nothing else; everything in the base is inherited unchanged.

Two connection shapes are supported, chosen by whether `connectionInfo.port` is set:

| `connectionInfo` | Built as |
|---|---|
| has a `port` | `new Redis({ port, host, username, password, db, enableReadyCheck: false })` |
| anything else | `new Redis(connectionInfo, { enableReadyCheck: false })` — so a connection string or a full ioredis options object passes straight through |

`enableReadyCheck` is forced to `false` in both cases. Some managed Redis providers do not permit the `INFO` command that the ready check issues.

`openSource.js` — a default-exported function returning the licence manifest for this package and its dependencies, for an application's open-source attribution page.

## Configuration

Read by the base from `db.redis.connection`:

```json
{
    "app": {
        "db": {
            "redis": {
                "connection": {
                    "host": "127.0.0.1",
                    "port": 6379,
                    "username": "<username>",
                    "password": "<password>",
                    "db": 0
                }
            }
        }
    }
}
```

Or as a connection string, which takes the second branch above:

```json
{ "app": { "db": { "redis": { "connection": "redis://user:pass@127.0.0.1:6379/0" } } } }
```

Override `getClientName()` to read a different `db.*` block.

## Wiring it up

```js
import BaseRedisRepository from '@thzero/library_server_repository_redis_ioredis/index.js';

class RegistryRepository extends BaseRedisRepository {
    async publish(correlationId, channel, message) {
        const client = await this._getClient(correlationId);
        await client.publish(correlationId, channel, JSON.stringify(message));
    }
}
```

Register it with the injector from `_initRepositories` in your `BootMain` derived class, or from a boot plugin's `initRepositories`.

### A note on error handling

`_initializeClientConnection` returns the client as ioredis constructs it, with no `error` listener attached. ioredis emits `error` on a failed or dropped connection, and an unhandled `error` event terminates the process — attach a handler in your subclass if you want the application to survive Redis being unreachable.

## Development

```
npm run lint       # eslint .
npm run lint:fix   # eslint . --fix
npm test           # node --test "test/*.test.js"
```
