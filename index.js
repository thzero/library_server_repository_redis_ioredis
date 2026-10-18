import Redis from 'ioredis';

import RedisRepository from '@thzero/library_server_repository_redis/index.js';

class IoredisRedisRepository extends RedisRepository {
	// The client [clientName] reported [err]; it reconnects by itself.
	_clientError(clientName, err) {
		this._logger.warn('RedisRepository', '_clientError', `${clientName}: ${err?.message ?? err}`);
	}

	// ioredis options for the client [clientName] (each name is a connection of its own), on top
	// of enableReadyCheck: false; e.g. maxRetriesPerRequest, commandTimeout, keepAlive,
	// retryStrategy. None by default.
	_clientOptions(correlationId, clientName, config) {
		return {};
	}

	// Through ioredis's own method for the command when it has one: on a RESP3 connection those
	// turn map replies (XREAD, XINFO, ...) into the arrays the base expects, which call() doesn't.
	async _command(client, command, ...args) {
		return await this._send(client, command, args);
	}

	async _initializeClientConnection(correlationId, connectionInfo, clientName, config) {
		this._enforceNotNull('RedisRepository', '_initializeClientConnection', connectionInfo, 'connectionInfo', correlationId);
		this._enforceNotEmpty('RedisRepository', '_initializeClientConnection', clientName, 'clientName', correlationId);

		const options = { enableReadyCheck: false, ...(this._clientOptions(correlationId, clientName, config) ?? {}) };

		let client = null;
		if (connectionInfo.port) {
			client = new Redis({
				...options,
				port: connectionInfo.port, // Redis port
				host: connectionInfo.host, // Redis host
				username: connectionInfo.username, // needs Redis >= 6
				password: connectionInfo.password,
				db: connectionInfo.db // Defaults to 0
			});
		}
		else
			client = new Redis(connectionInfo, options);

		this._enforceNotEmpty('RedisRepository', '_initializeClient', client, 'client', correlationId);

		// Without a listener ioredis reports every failed connection attempt as an unhandled error.
		client.on('error', (err) => this._clientError(clientName, err));
		return client;
	}

	_send(target, command, args) {
		const method = target[String(command).toLowerCase()];
		if (typeof method === 'function')
			return method.apply(target, args);
		return target.call(command, ...args);
	}

	async _transaction(client, commands) {
		const multi = client.multi();
		for (const [ command, ...args ] of commands)
			this._send(multi, command, args);
		const results = await multi.exec();
		const replies = [];
		for (const [ err, reply ] of (results ?? [])) {
			if (err)
				throw err;
			replies.push(reply);
		}
		return replies;
	}
}

export default IoredisRedisRepository;
