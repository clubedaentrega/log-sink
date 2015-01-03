'use strict'

var EventEmitter = require('events').EventEmitter,
	context = require('./context'),
	Logger = require('./Logger')

/**
 * Fired when the connection is ready
 * @event Connection#connect
 */

/**
 * @event Connection#error
 * @type {Error}
 */

/**
 * Emited when the connection is closed and no more activity will happen
 * @event Connection#close
 */

/**
 * @class
 * @extends EventEmitter
 */
function Connection() {
	EventEmitter.call(this)

	/**
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
	 * Default value for relevance (from 0 to 2, initial value is 1)
	 * @member {number}
	 */
	this.relevance = 1

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

/**
 * Ready state values
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
 * Start the connection with the log sink server
 * To connect to a server using TLS, set 'secure' as true in socketOptions
 * @param {string} user
 * @param {string} password
 * @param {Object} socketOptions - an object passed to net.connect or tls.connect (if secure is true)
 */
Connection.prototype.connect = function (user, password, socketOptions) {
	var that = this
	if (this.state !== this.STATE.UNINITIALIZED) {
		throw new Error('Invalid state: already initialized')
	}
	this.state = this.STATE.CONNECTING

	// Connect and forward events
	this._peer = context.connect(socketOptions, {
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
}

/**
 * @param {Function} [callback] - added as listener to 'close'
 */
Connection.prototype.close = function (callback) {
	if (this.state === this.STATE.UNINITIALIZED) {
		throw new Error('Can not close, connection is unitialized')
	} else if (this.state === this.STATE.CONNECTING) {
		// Postpone until connected
		this.once('connect', function () {
			this.close(callback)
		})
	} else if (this.state === this.STATE.CLOSED) {
		return
	}

	this._peer.close()
	callback && this.once('close', callback)
}

/**
 * @param {Object} data
 * @param {string} data.name
 * @param {Connection#LEVEL} data.level
 * @param {Date} [data.date=new Date]
 * @param {number} [data.relevance=this.relevance]
 * @param {Buffer} [data.commit=this.commit]
 * @param {number} [data.time]
 * @param {string} [data.message]
 * @param {*} [data.extra]
 * @param {function(?Error)} [callback]
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

	this._cacheOrSend(data, callback)
}

/**
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra]
 */
Connection.prototype.debug = function (name, message, extra) {
	this._base(this.LEVEL.DEBUG, name, message, extra)
}

/**
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra]
 */
Connection.prototype.info = function (name, message, extra) {
	this._base(this.LEVEL.INFO, name, message, extra)
}

/**
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra]
 */
Connection.prototype.warn = function (name, message, extra) {
	this._base(this.LEVEL.WARN, name, message, extra)
}

/**
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra]
 */
Connection.prototype.error = function (name, message, extra) {
	this._base(this.LEVEL.ERROR, name, message, extra)
}

/**
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra]
 */
Connection.prototype.fatal = function (name, message, extra) {
	this._base(this.LEVEL.FATAL, name, message, extra)
}

/**
 * @param {string} name
 * @returns {Logger}
 */
Connection.prototype.bind = function (name) {
	return new Logger(this, name)
}

/**
 * Send a log or cache it, depending on the connection state
 * @param {Object} data
 * @param {Function} [callback]
 * @private
 */
Connection.prototype._cacheOrSend = function (data, callback) {
	if (this.state === this.STATE.UNINITIALIZED ||
		this.state === this.STATE.CONNECTING) {
		this._cache.push({
			data: data,
			callback: callback
		})
	} else if (this.state === this.STATE.CONNECTED) {
		if (callback) {
			this._peer.call('log', data, callback)
		} else {
			this._peer.send('log', data)
		}
	} else if (callback) {
		process.nextTick(function () {
			callback(new Error('Connection is closed'))
		})
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
		if (each.callback) {
			this._peer.call('log', each.data, each.callback)
		} else {
			this._peer.send('log', each.data)
		}
	}, this)
}

/**
 * @param {Connection#LEVEL} level
 * @param {string} name
 * @param {string|Error} [message]
 * @param {*} [extra]
 * @private
 */
Connection.prototype._base = function (level, name, message, extra) {
	if (message instanceof Error) {
		// Support the use of _base(level, name, error)
		extra = {}
		Object.getOwnPropertyNames(message).forEach(function (prop) {
			// Shallow clone (even of non-enum properties)
			extra[prop] = message[prop]
		})
		message = String(message)
	} else if (extra === undefined && typeof message !== 'string') {
		// Support the use of _base(level, name, extra)
		extra = message
		message = null
	}

	this.sendLog({
		level: level,
		name: name,
		message: message,
		extra: extra
	})
}

require('utils').inherits(Connection, EventEmitter)

module.exports = Connection