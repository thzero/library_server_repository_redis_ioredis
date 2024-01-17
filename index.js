import Redis from 'ioredis';

import RedisRepository from '@thzero/library_server_repository_redis/index.js';

class IoredisRedisRepository extends RedisRepository {
	async _initializeClientConnection(correlationId, connectionInfo, clientName, config) {
		this._enforceNotNull('RedisRepository', '_initializeClientConnection', 'connectionInfo', connectionInfo, correlationId);
		this._enforceNotEmpty('RedisRepository', '_initializeClientConnection', 'clientName', clientName, correlationId);

		let client = null;
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
		return client;
	}
}

export default IoredisRedisRepository;
