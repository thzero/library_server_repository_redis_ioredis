import Redis from 'ioredis';

import { Mutex as asyncMutex } from 'async-mutex';

import Repository from '@thzero/library_server/repository/index.js';

class RedisRepository extends Repository {
	static _client = {};
	static _mutexClient = new asyncMutex();
	static _mutexDb = new asyncMutex();
	static _db = {};

	async _getClient(correlationId, clientName) {
		return await this._initializeClient(correlationId, clientName ?? this._initClientName());
	}

	get _initClientName() {
		const clientName = this._config.get('db.default');
		return clientName;
	}

	async _initializeClient(correlationId, clientName) {
		this._enforceNotEmpty('RedisRepository', '_initializeClient', 'clientName', clientName, correlationId);

		let client = RedisRepository._client[clientName];
		if (client)
			return client;

		// const release = await this._mutexClient.acquire();
		const release = await RedisRepository._mutexClient.acquire();
		try {
			try {
				const connectionInfo = this._config.get(`db.redis.connection`);
				this._enforceNotEmpty('RedisRepository', '_initializeClient', 'connectionInfo', connectionInfo, correlationId);
	
				if (connectionInfo.port) {
					client = new Redis({
						port: connectionInfo.port, // Redis port
						host: connectionInfo.host, // Redis host
						username: connectionInfo.username, // needs Redis >= 6
						password: connectionInfo.password,
						db: connectionInfo.db, // Defaults to 0
						enableReadyCheck: false
					});
				}
				else
					client = new Redis(connectionInfo, { enableReadyCheck: false });
					this._enforceNotEmpty('RedisRepository', '_initializeClient', 'client', client, correlationId);

				RedisRepository._client[clientName] = client;

				this._enforceNotNull('RedisRepository', '_initializeClient', 'client', client, correlationId);
			}
			catch (err) {
				throw err;
			}
		}
		finally {
			release();
		}

		return client;
	}
}

export default RedisRepository;
