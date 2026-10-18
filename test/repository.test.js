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

describe('_clientOptions', () => {
	it('adds a subclass\'s options for the client by name, on both connection shapes', async () => {
		repository._clientOptions = (correlationId, clientName) => clientName === 'reader' ? { maxRetriesPerRequest: null, commandTimeout: 7 } : { keepAlive: 5 };
		const clients = [
			await repository._initializeClientConnection('cid', { host: '127.0.0.1', port: 6399 }, 'reader'),
			await repository._initializeClientConnection('cid', 'redis://127.0.0.1:6399', 'redis')
		];
		try {
			assert.equal(clients[0].options.maxRetriesPerRequest, null);
			assert.equal(clients[0].options.commandTimeout, 7);
			assert.equal(clients[0].options.port, 6399);
			assert.equal(clients[1].options.keepAlive, 5);
			assert.equal(clients[1].options.enableReadyCheck, false);
		}
		finally {
			clients.forEach(close);
		}
	});

	it('listens for errors, through _clientError', async () => {
		const errors = [];
		repository._clientError = (clientName, err) => errors.push([ clientName, err.message ]);
		const client = await repository._initializeClientConnection('cid', { host: '127.0.0.1', port: 6399 }, 'redis');
		try {
			client.emit('error', new Error('down'));
			assert.deepEqual(errors, [ [ 'redis', 'down' ] ]);
		}
		finally {
			close(client);
		}
	});
});

describe('driver primitives', () => {
	it('_command sends the command by name', async () => {
		const client = { call: async (...args) => args };
		assert.deepEqual(await repository._command(client, 'XADD', 's', '*', 'a', 1), [ 'XADD', 's', '*', 'a', 1 ]);
	});

	it('_command prefers ioredis\'s own method for the command, which shapes its reply', async () => {
		const client = { xread: async (...args) => [ 'named', ...args ], call: async () => 'raw' };
		assert.deepEqual(await repository._command(client, 'XREAD', 'STREAMS', 's', '0-0'), [ 'named', 'STREAMS', 's', '0-0' ]);
	});

	it('_transaction sends them in one MULTI and returns the replies', async () => {
		const queued = [];
		const client = { multi: () => ({ call: (...args) => queued.push(args), exec: async () => queued.map((args, i) => [ null, `${i + 1}-0` ]) }) };
		assert.deepEqual(await repository._transaction(client, [ [ 'XADD', 's', '*', 'a', 1 ], [ 'XADD', 's', '*', 'b', 2 ] ]), [ '1-0', '2-0' ]);
		assert.deepEqual(queued, [ [ 'XADD', 's', '*', 'a', 1 ], [ 'XADD', 's', '*', 'b', 2 ] ]);
	});

	it('_transaction rejects with a command\'s error', async () => {
		const client = { multi: () => ({ call: () => {}, exec: async () => [ [ null, 'OK' ], [ new Error('WRONGTYPE'), null ] ] }) };
		await assert.rejects(() => repository._transaction(client, [ [ 'SET', 'a', 1 ], [ 'XADD', 'a', '*', 'b', 2 ] ]), /WRONGTYPE/);
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
