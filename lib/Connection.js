'use strict'

var EventEmitter = require('events').EventEmitter,
	context = require('./context'),
	Logger = require('./Logger'),
	LogStream = require('./LogStream'),
	prepareError = require('./prepareError')

/**
 * Fired when {@link Connection#connect}() is called.
 * {@link Connection#state} is CONNECTING
 * @event Connection#connecting
 */

/**
 * Fired when the connection is ready.
 * {@link Connection#state} is CONNECTED
 * @event Connection#connect
 */

/**
 * @event Connection#error
 * @type {Error}
 */

/**
 * Emited when the connection is closed and no more activity will happen.
 * {@link Connection#state} is CLOSED
 * @event Connection#close
 */

/**
 * @typedef {Object} Connection~Range
 * @property {number} [min] - inclusive
 * @property {number} [max] - inclusive
 */

/**
 * @typedef {Object} Connection~Log
 * @property {string} origin
 * @property {Date} date
 * @property {string} name
 * @property {Connection#LEVEL} level
 * @property {Connection#RELEVANCE} relevance
 * @property {number} [time]
 * @property {string} [message]
 * @property {Buffer} [commit]
 * @property {*} [extra]
 */

/**
 * @class
 * @extends EventEmitter
 */
function Connection() {
	EventEmitter.call(this)

	/**
	 * The connection readiness.
	 * If the connection is not ready yet, all commands will be buffered and executed
	 * when appropriate
	 * @member {Connection#STATE}
	 * @readonly
	 */
	this.state = this.STATE.UNINITIALIZED

	/**
	 * Default value for the `commit` field
	 * @member {?Buffer}
	 */
	this.commit = null

	/**
	 * Default value for relevance (initial value is NORMAL)
	 * @member {Connection#RELEVANCE}
	 */
	this.relevance = 1

	/**
	 * User name, set after {@link Connection#connect}() is called
	 * @member {string}
	 * @readonly
	 */
	this.user = ''

	/**
	 * @member {Peer}
	 * @private
	 */
	this._peer = null

	/**
	 * @member {Array<Object>}
	 * @private
	 */
	this._cache = []
}

require('util').inherits(Connection, EventEmitter)
module.exports = Connection

/**
 * Ready state values for {@link Connection#state}
 * @enum {number}
 */
Connection.prototype.STATE = {
	UNINITIALIZED: 0,
	CONNECTING: 1,
	CONNECTED: 2,
	CLOSED: 4
}

/**
 * Standard level values
 * @enum {number}
 */
Connection.prototype.LEVEL = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
	FATAL: 4
}

/**
 * Possible relevance values
 * @enum {number}
 */
Connection.prototype.RELEVANCE = {
	LOW: 0,
	NORMAL: 1,
	HIGH: 2
}

/**
 * Start the connection with the log sink server.
 * To connect to a server using TLS, set `socketOptions.secure` as `true`
 * @param {string} user - account name in the server
 * @param {string} password - base 64 encoded, like `'u4zJEF16B5UAvalmp+oY0QdSSvhqMBxj64WYlK7Omio='`
 * @param {Object|string} socketOptionsOrUrl - In node: an object passed to net.connect or tls.connect, if `socketOptions.secure` is `true`. For browser: the websocket url as a string, like 'wss://example.com:8017/'
 */
Connection.prototype.connect = function (user, password, socketOptionsOrUrl) {
	var that = this
	if (this.state !== this.STATE.UNINITIALIZED && this.state !== this.STATE.CLOSED) {
		throw new Error('Invalid state: already connecting or connected')
	}
	this.state = this.STATE.CONNECTING
	this.user = user

	// Connect and forward events
	this._peer = context.connect(socketOptionsOrUrl, {
		user: user,
		password: password
	}, function () {
		that.state = that.STATE.CONNECTED
		that.emit('connect')
		that._sendCached()
	})
	this._peer.on('error', this.emit.bind(this, 'error'))
	this._peer.once('close', function () {
		that.state = that.STATE.CLOSED
		that.emit('close')
	})
	this.emit('connecting')
}

/**
 * Close the connection
 * @param {Function} [callback] - added as listener to {@link Connection#event:close}
 */
Connection.prototype.close = function (callback) {
	if (this.state === this.STATE.UNINITIALIZED) {
		throw new Error('Can not close, connection is unitialized')
	} else if (this.state === this.STATE.CONNECTING) {
		// Postpone until connected
		this.once('connect', function () {
			this.close(callback)
		})
		return
	} else if (this.state === this.STATE.CLOSED) {
		return
	}

	callback && this.once('close', callback)
	this._peer.close()
}

/**
 * Disables the connection, making it ignore all logs and always failing in stream() and query().
 * This is useful for a test environment, for example, because otherwise the internal buffer
 * would grow unboundedly
 */
Connection.prototype.disable = function () {
	if (this.state === this.STATE.UNINITIALIZED) {
		this.state = this.STATE.CLOSED
	} else {
		this.close()
	}
}

/**
 * The low level way to send log data to the server.
 * Most of times, {@link Connection#info} (and its family) and {@link Connection#bindName} will be
 * much more useful.
 * @param {Object} data
 * @param {string} data.name
 * @param {Connection#LEVEL} data.level
 * @param {Date} [data.date=new Date]
 * @param {Connection#RELEVANCE} [data.relevance={@link Connection#relevance}]
 * @param {Buffer} [data.commit={@link Connection#commit}]
 * @param {number} [data.time]
 * @param {string} [data.message]
 * @param {*} [data.extra] - any JSON-compatible data (like number, string, boolean, null, array and object)
 * @param {function(?Error)} [callback] - optional cb(err). If not present, the log is sent in a fire-and-forget fashion, provinding better latency and throughput
 */
Connection.prototype.sendLog = function (data, callback) {
	// Check types of required fields
	if (typeof data !== 'object') {
		throw new Error('Invalid log data, expected an object, got ' + data)
	} else if (typeof data.name !== 'string') {
		throw new Error('Invalid log name, expected a string, got ' + data.name)
	} else if (typeof data.level !== 'number') {
		throw new Error('Invalid log level, expected a number, got ' + data.level)
	}

	// Default values
	if (data.date === undefined) {
		data.date = new Date
	}
	if (data.relevance === undefined) {
		data.relevance = this.relevance
	}
	if (data.commit === undefined) {
		data.commit = this.commit
	}

	// Check optional fields type
	if (!(data.date instanceof Date)) {
		throw new Error('Invalid log date, expected a Date, got ' + data.date)
	}
	if (typeof data.relevance !== 'number') {
		throw new Error('Invalid log relevance, expected a number, got ' + data.relevance)
	}
	if (data.commit !== undefined &&
		data.commit !== null &&
		!Buffer.isBuffer(data.commit)) {
		throw new Error('Invalid log commit, expected a Buffer, got ' + data.commit)
	}
	if (data.time !== undefined &&
		data.time !== null &&
		typeof data.time !== 'number') {
		throw new Error('Invalid log time, expected a number, got ' + data.time)
	}
	if (data.message !== undefined &&
		data.message !== null &&
		typeof data.message !== 'string') {
		throw new Error('Invalid log message, expected a string, got ' + data.message)
	}

	// Limit name and message to 1000 bytes, due to the
	// hard limit of 1024 bytes of mongo's index
	data.name = this._capByteLength(data.name, 1000)
	data.message = this._capByteLength(data.message, 1000)

	this._cacheOrSend('log', data, callback)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as DEBUG
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Connection.prototype.debug = function (name, message, extra) {
	this._base(undefined, this.LEVEL.DEBUG, name, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as INFO
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Connection.prototype.info = function (name, message, extra) {
	this._base(undefined, this.LEVEL.INFO, name, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as WARN
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Connection.prototype.warn = function (name, message, extra) {
	this._base(undefined, this.LEVEL.WARN, name, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as ERROR
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Connection.prototype.error = function (name, message, extra) {
	this._base(undefined, this.LEVEL.ERROR, name, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as FATAL
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Connection.prototype.fatal = function (name, message, extra) {
	this._base(undefined, this.LEVEL.FATAL, name, message, extra)
}

/**
 * Use it to ease logging multiple times with the same `name`, `relevance` and some `extra` keys
 * Logs created this way will have the `time` field set as the elapsed time (in ms) between
 * this call and subsequent calls to {@link Logger} methods.
 * Keys on the `basicExtra` parameter will be assigned to the extra object passed
 * when calling {@link Logger} methods.
 * @param {string} name
 * @param {Connection#RELEVANCE} [relevance={@link Connection#relevance}]
 * @param {Object} [basicExtra]
 * @returns {Logger}
 */
Connection.prototype.getLogger = function (name, relevance, basicExtra) {
	return new Logger(this, name, relevance, basicExtra)
}

/**
 * Use it to ease logging multiple times with the same `name` field.
 * Logs created this way will have the `time` field set as the elapsed time (in ms) between
 * this call and subsequent calls to {@link Logger} methods
 * @deprecated replaced by {@link Connection#getLogger}
 * @param {string} name
 * @returns {Logger}
 */
Connection.prototype.bindName = function (name) {
	return new Logger(this, name)
}

/**
 * Create a log stream.
 * This is done asynchronously: the stream will be passed to the callback
 * @param {Object} [filter={}] - filter the stream
 * @param {string} [filter.origin={@link Connection#user}] - the user must have permission to read from it
 * @param {string} [filter.name]
 * @param {RegExp} [filter.nameRegex] - ignored if `filter.name` is given
 * @param {Connection~Range} [filter.level] - see standard values in {@link Connection#LEVEL}
 * @param {Connection~Range} [filter.relevance] - see possible values in {@link Connection#RELEVANCCE}
 * @param {Connection~Range} [filter.time]
 * @param {string} [filter.message]
 * @param {RegExp} [filter.messageRegex] - ignored if `filter.message` is given
 * @param {Buffer} [filter.commit]
 * @param {boolean} [includeExtra=false] - if false (default), log's `extra` field won't be received, improving performance
 * @param {function(?Error,LogStream)} callback - cb(err, logStream:{@link LogStream})
 */
Connection.prototype.stream = function (filter, includeExtra, callback) {
	if (typeof filter === 'function') {
		callback = filter
		filter = {}
		includeExtra = false
	} else if (typeof includeExtra === 'function') {
		callback = includeExtra
		includeExtra = false
	}
	filter.origin = filter.origin || this.user

	this._cacheOrSend('stream', {
		filter: filter,
		includeExtra: includeExtra
	}, callback)
}

/**
 * Query log data
 * @param {Object} [query={}]
 * @param {Object} [query.date]
 * @param {Date} [query.date.min=yesterday]
 * @param {Date} [query.date.max]
 * @param {string} [query.origin={@link Connection#user}]
 * @param {Connection#RELEVANCE} [query.relevance={@link Connection#relevance}]
 * @param {string} [query.name]
 * @param {RegExp} [query.nameRegex] - ignored if `query.name` is given
 * @param {Connection~Range} [query.level]
 * @param {Connection~Range} [query.time]
 * @param {string} [query.message]
 * @param {RegExp} [query.messageRegex] - ignored if `query.message` is given
 * @param {Buffer} [query.commit]
 * @param {*} [query.extra] - follows mongodb query syntax, see [official docs](http://docs.mongodb.org/manual/tutorial/query-documents/)
 * @param {Object} [options={}]
 * @param {boolean} [options.includeExtra=false] - if false (default), the `extra` field is not received
 * @param {number} [options.limit=100]
 * @param {number} [options.skip=0]
 * @param {string} [options.sort='date'] - same syntax as mongoose, example: 'date -time'
 * @param {function(?Error,Array)} callback - fn(err, logs:Array<Connection~Log>)
 */
Connection.prototype.query = function (query, options, callback) {
	if (typeof query === 'function') {
		callback = query
		query = {}
		options = {}
	} else if (typeof options === 'function') {
		callback = options
		options = {}
	}

	// Defaults
	query.date = query.date || {}
	query.date.min = query.date.min || new Date(Date.now() - 24 * 3600e3)
	query.origin = query.origin || this.user
	query.relevance = query.relevance === undefined ? this.relevance : query.relevance
	options.includeExtra = Boolean(options.includeExtra)
	options.limit = options.limit || 100

	// options.skip is defaulted to 0 at the server
	// options.sort is defaulted to 'date' at the server
	options.query = query

	this._cacheOrSend('query', options, callback)
}

/**
 * Get the list of available permissions for the current user
 * The current user name will be included in the answer and will always be the first element of the array
 * @param {function(?Error,Array<string>)} callback - cb(err,permissions)
 */
Connection.prototype.getPermissions = function (callback) {
	this._cacheOrSend('getPermissions', null, callback)
}

/**
 * Send a command or cache it, depending on the connection state
 * @param {string} action
 * @param {Object} data
 * @param {Function} [callback]
 * @private
 */
Connection.prototype._cacheOrSend = function (action, data, callback) {
	if (this.state === this.STATE.UNINITIALIZED ||
		this.state === this.STATE.CONNECTING) {
		this._cache.push({
			action: action,
			data: data,
			callback: callback
		})
	} else if (this.state === this.STATE.CONNECTED) {
		this._execute(action, data, callback)
	} else if (callback) {
		process.nextTick(function () {
			callback(new Error('Connection is closed'))
		})
	}
}

/**
 * Execute a command. The connection must be open and ready
 * @param {string} action
 * @param {Object} data
 * @param {Function} [callback] - the callback is required for some actions
 * @private
 */
Connection.prototype._execute = function (action, data, callback) {
	var that = this,
		id
	if (action === 'log') {
		// Write
		if (callback) {
			this._peer.call('log', data, callback)
		} else {
			this._peer.send('log', data)
		}
	} else if (action === 'stream') {
		// Set stream
		id = String(Math.random())
		this._peer.call('setStream', {
			id: id,
			includeExtra: data.includeExtra,
			filter: data.filter
		}, function (err) {
			if (err) {
				return callback(err)
			}
			callback(null, new LogStream(that, id))
		})
	} else if (action === 'unsetStream') {
		this._peer.call('unsetStream', data, callback)
	} else if (action === 'query') {
		this._peer.call('query', data, callback)
	} else if (action === 'getPermissions') {
		this._peer.call('getPermissions', callback)
	}
}

/**
 * @private
 */
Connection.prototype._sendCached = function () {
	var cache = this._cache
	if (this.state !== this.STATE.CONNECTED) {
		return
	}
	this._cache = []
	cache.forEach(function (each) {
		this._execute(each.action, each.data, each.callback)
	}, this)
}

/**
 * @param {?number} time
 * @param {Connection#LEVEL} level
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra]
 * @param {?Connection#RELEVANCE} relevance
 * @param {?Object} basicExtra
 * @private
 */
Connection.prototype._base = function (time, level, name, message, extra, relevance, basicExtra) {
	if (message instanceof Error) {
		// Support the use of _base(time, level, name, error)
		extra = prepareError(message)
		message = String(message)
	} else if (extra === undefined && typeof message !== 'string') {
		// Support the use of _base(time, level, name, extra)
		extra = message
		message = null
	}

	// Assign basic extra values
	if (basicExtra && typeof basicExtra === 'object' && extra && typeof extra === 'object') {
		Object.keys(basicExtra).forEach(function (key) {
			extra[key] = basicExtra[key]
		})
	}

	this.sendLog({
		relevance: relevance,
		time: time,
		level: level,
		name: name,
		message: message,
		extra: extra
	})
}

/**
 * Cap the string size to the given length in bytes
 * @param {string} str
 * @param {number} num
 * @returns {string}
 * @private
 */
Connection.prototype._capByteLength = function (str, num) {
	// At most, a UTF-16 code point is represented as 3 bytes
	// in UTF-8 (0xFFFF -> [ef bf bf])
	if (str.length * 3 < num) {
		// Fast case, no need to count the bytes
		return str
	}

	let bytes = Buffer.from(str)
	if (bytes.length <= num) {
		return str
	}

	// Note that this cut may produce invalid UTF-8 encoding
	return bytes.slice(0, num).toString()
}