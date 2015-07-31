'use strict'

/**
 * Used to ease logging multiple times with the same `name` field.
 * Logs created this way will have the `time` field set as the elapsed time (in ms) between
 * creation by {@link Connection#bindName} and subsequent calls to its methods.
 * @class
 * @param {Connection} conn
 * @param {string} name
 */
function Logger(conn, name) {
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
	this.conn._base(Date.now() - this.then, this.conn.LEVEL.DEBUG, this.name, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as INFO
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Logger.prototype.info = function (message, extra) {
	this.conn._base(Date.now() - this.then, this.conn.LEVEL.INFO, this.name, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as WARN
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Logger.prototype.warn = function (message, extra) {
	this.conn._base(Date.now() - this.then, this.conn.LEVEL.WARN, this.name, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as ERROR
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Logger.prototype.error = function (message, extra) {
	this.conn._base(Date.now() - this.then, this.conn.LEVEL.ERROR, this.name, message, extra)
}

/**
 * Simpler way for {@link Connection#sendLog} with `level` set as FATAL
 * @param {string|Error} [message]
 * @param {*} [extra] - any JSON-compatible value
 */
Logger.prototype.fatal = function (message, extra) {
	this.conn._base(Date.now() - this.then, this.conn.LEVEL.FATAL, this.name, message, extra)
}

module.exports = Logger