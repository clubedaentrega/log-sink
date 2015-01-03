'use strict'

var Readable = require('stream').Readable

/**
 * @class
 * @extends Readable
 * @param {Connection} connection
 * @param {string} id
 */
function LogStream(connection, id) {
	Readable.call(this, {
		objectMode: true
	})

	/**
	 * @member {Connection}
	 * @readonly
	 */
	this.connection = connection

	/**
	 * @member {boolean}
	 * @readonly
	 */
	this.stopped = false

	/**
	 * @member {string}
	 * @private
	 */
	this._id = id
	
	/**
	 * @member {Function}
	 * @private
	 */
	this._bindedOnlog = this._onlog.bind(this)

	connection._peer.on('logStream', this._bindedOnlog)
	connection.once('close', this._stop.bind(this))
}

/**
 * Unset this stream
 */
LogStream.prototype.stop = function () {
	var that = this
	if (!this.stopped) {
		this._stop()
		this.connection._execute('unsetStream', {
			id: this._id
		}, function (err) {
			if (err) {
				that.emit('error', err)
			}
		})
	}
}

/**
 * @private
 */
LogStream.prototype._read = function () {
	// Data is pushed outside of read
}

/**
 * @param {Object} data
 * @private
 */
LogStream.prototype._onlog = function (data) {
	if (!this.stopped && data.id === this._id) {
		this.push(data.log)
	}
}

/**
 * @private
 */
LogStream.prototype._stop = function () {
	if (!this.stopped) {
		this.stopped = true
		this.push(null)
		this.connection._peer.removeListener('logStream', this._bindedOnlog)
	}
}

require('util').inherits(LogStream, Readable)
module.exports = LogStream