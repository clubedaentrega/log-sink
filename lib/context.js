'use strict'

var AC = require('asynconnection-node'),
	cntxt = new AC

var range = {
	'min?': 'uint',
	'max?': 'uint'
}

var log = {
	origin: 'string',
	date: 'date',
	name: 'string',
	level: 'uint',
	relevance: 'uint',
	'time?': 'uint',
	'message?': 'string',
	'commit?': 'Buffer',
	'extra?': 'json'
}

var query = {
	origin: 'string',
	date: {
		min: 'date',
		'max?': 'date'
	},
	relevance: 'uint',
	'name?': 'string',
	'nameRegex?': 'regex',
	'level?': range,
	'time?': range,
	'message?': 'string',
	'messageRegex?': 'regex',
	'commit?': 'Buffer',
	'extra?': 'json'
}

// Write api
var writeLog = {
	date: 'date',
	name: 'string',
	level: 'uint',
	relevance: 'uint',
	'time?': 'uint',
	'message?': 'string',
	'commit?': 'Buffer',
	'extra?': 'json'
}
cntxt.addClientMessage(1, 'log', writeLog)
cntxt.addClientCall(1, 'log', writeLog, null)

// Live stream api
cntxt.addClientCall(2, 'setLogStream', {
	id: 'string',
	includeExtra: 'boolean',
	filter: {
		origin: 'string',
		'name?': 'string',
		'nameRegex?': 'regex',
		'level?': range,
		'relevance?': range,
		'time?': range,
		'message?': 'string',
		'messageRegex?': 'regex',
		'commit?': 'Buffer'
	}
}, null)
cntxt.addClientCall(3, 'unsetLogStream', {
	id: 'string'
}, 'boolean')
cntxt.addClientCall(4, 'unsetAllLogStreams', null, null)
cntxt.addServerMessage(1, 'logStream', {
	id: 'string',
	includeExtra: 'boolean',
	log: log
}, function (data) {
	this.emit('logStream', data)
})

// Query api
cntxt.addClientCall(5, 'query', {
	includeExtra: 'boolean',
	query: query,
	limit: 'uint',
	'skip?': 'uint',
	'sort?': 'string'
}, [log])

module.exports = cntxt