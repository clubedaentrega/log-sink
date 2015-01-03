'use strict'

/**
 * @class
 * @param {Connection} conn
 */
function Logger(conn, name) {
	/**
	 * @member {Connection}
	 */
	this.conn = conn
	
	/**
	 * @member {string}
	 */
	this.name = name
}

/**
 * @param {string|Error} [message]
 * @param {*} [extra]
 */
Logger.prototype.debug = function (message, extra) {
	this.conn.debug(this.name, message, extra)
}

/**
 * @param {string|Error} [message]
 * @param {*} [extra]
 */
Logger.prototype.info = function (message, extra) {
	this.conn.info(this.name, message, extra)
}

/**
 * @param {string|Error} [message]
 * @param {*} [extra]
 */
Logger.prototype.warn = function (message, extra) {
	this.conn.warn(this.name, message, extra)
}

/**
 * @param {string|Error} [message]
 * @param {*} [extra]
 */
Logger.prototype.error = function (message, extra) {
	this.conn.error(this.name, message, extra)
}

/**
 * @param {string|Error} [message]
 * @param {*} [extra]
 */
Logger.prototype.fatal = function (message, extra) {
	this.conn.fatal(this.name, message, extra)
}

module.exports = Logger