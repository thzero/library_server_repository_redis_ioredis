import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import '@thzero/library_common/utility/string.js';
import IoredisRedisRepository from '../index.js';
import openSource from '../openSource.js';

const inject = (target, name, value) => {
	Object.defineProperty(target, name, { value, writable: true, configurable: true });
	return target;
};

const newLogger = () => ({ debug() {}, info() {}, warn() {}, error() {}, exception() {}, fatal() {}, trace() {} });

// The client is built but never connected to anything: nothing is listening on
// this port, so swallow the connection error and drop the socket straight away.
const close = (client) => {
	if (!client)
		return;
	client.on('error', () => {});
	client.disconnect();
};

let repository;

beforeEach(() => {
	repository = new IoredisRedisRepository();
	inject(repository, '_logger', newLogger());
	inject(repository, '_config', { get: () => null });
});

describe('_initializeClientConnection', () => {
	it('requires connection info and a client name', async () => {
		await assert.rejects(() => repository._initializeClientConnection('cid', null, 'redis'), /connectionInfo is null/);
		await assert.rejects(() => repository._initializeClientConnection('cid', {}, null), /clientName is empty/);
	});

	it('maps a host and port block onto the ioredis options', async () => {
		const client = await repository._initializeClientConnection('cid',
			{ host: '127.0.0.1', port: 6399, username: 'u', password: 'p', db: 2 }, 'redis');
		try {
			assert.equal(client.options.host, '127.0.0.1');
			assert.equal(client.options.port, 6399);
			assert.equal(client.options.username, 'u');
			assert.equal(client.options.db, 2);
			assert.equal(client.options.enableReadyCheck, false);
		}
		finally {
			close(client);
		}
	});

	it('passes a connection string straight through when there is no port', async () => {
		const client = await repository._initializeClientConnection('cid', 'redis://127.0.0.1:6399', 'redis');
		try {
			assert.equal(client.options.port, 6399);
			assert.equal(client.options.enableReadyCheck, false);
		}
		finally {
			close(client);
		}
	});
});

describe('openSource', () => {
	it('lists every package this repository pulls in', () => {
		const names = openSource().map(entry => entry.name);
		assert.ok(names.includes('ioredis'));
		assert.ok(names.includes('@thzero/library_server_repository_redis'));
		assert.ok(names.includes('@thzero/library_server_repository_redis_ioredis'));
	});

	it('gives every entry a category, url and licence', () => {
		for (const entry of openSource()) {
			assert.equal(entry.category, 'server');
			assert.ok(entry.url, `${entry.name} has a url`);
			assert.ok(entry.licenseName, `${entry.name} has a licence name`);
			assert.ok(entry.licenseUrl, `${entry.name} has a licence url`);
		}
	});
});
