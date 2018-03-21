'use strict'

/**
 * Use it to ease logging multiple times with the same `name`, `relevance` and some `extra` keys
 * Logs created this way will have the `time` field set as the elapsed time (in ms) between
 * creation by {@link Connection#getLogger} and subsequent calls to its methods.
 * Keys on the `basicExtra` parameter will be assigned to the extra object passed
 * when calling {@link Logger} methods.
 * @class
 * @param {Connection} conn
 * @param {string} name
 * @param {Connection#RELEVANCE} [relevance]
 * @param {Object} [basicExtra]
 */
function Logger(conn, name, relevance, basicExtra) {
	if (relevance && typeof relevance === 'object') {
		basicExtra = relevance
		relevance = undefined
	}

	/**
	 * Parent connection
	 * @member {Connection}
	 */
	this.conn = conn

	/**
	 * Binded `name` value
	 * @member {string}
	 */
	this.name = name

	/**
	 * Binded `relevance` value
	 * @member {?Connection#RELEVANCE}
	 */
	this.relevance = relevance

	/**
	 * Binded keys/values for `extra`
	 * @member {?Object}
	 */
	this.basicExtra = basicExtra

	/**
	 * The timestamp (in ms) when it was created
	 * @member {number}
	 */
	this.then = Date.now()
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as DEBUG
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Logger.prototype.debug = function (message, extra) {
	this._base(this.conn.LEVEL.DEBUG, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as INFO
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Logger.prototype.info = function (message, extra) {
	this._base(this.conn.LEVEL.INFO, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as WARN
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Logger.prototype.warn = function (message, extra) {
	this._base(this.conn.LEVEL.WARN, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as ERROR
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Logger.prototype.error = function (message, extra) {
	this._base(this.conn.LEVEL.ERROR, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as FATAL
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Logger.prototype.fatal = function (message, extra) {
	this._base(this.conn.LEVEL.FATAL, message, extra)
}

/**
 * @param {Connection#LEVEL} level
 * @param {string|Error} [message]
 * @param {*} [extra]
 * @private
 */
Logger.prototype._base = function (level, message, extra) {
	let time = Date.now() - this.then
	this.conn._base(time, level, this.name, message, extra, this.relevance, this.basicExtra)
}

module.exports = Logger