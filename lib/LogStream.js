'use strict'

let Readable = require('stream').Readable

/**
 * A live stream of matching logs being written to the server.
 * You are not expected to create instances of this class,
 * instead they are handed to you by the {@link Connection#stream} callback.
 *
 * This is a ReadableStream in object mode.
 * See {@link Connection~Log} for the received object format.
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
	 * Parent connection
	 * @member {Connection}
	 * @readonly
	 */
	this.connection = connection

	/**
	 * Whether this stream has been shut down
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

	connection._peer.on('stream', this._bindedOnlog)
	connection.once('close', this._stop.bind(this))
}

require('util').inherits(LogStream, Readable)
module.exports = LogStream

/**
 * Shutdown this stream
 */
LogStream.prototype.stop = function () {
	let that = this
	if (!this.stopped) {
		this._stop()
		this.connection._execute('unsetStream', this._id, err => {
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
		this.connection._peer.removeListener('stream', this._bindedOnlog)
	}
}