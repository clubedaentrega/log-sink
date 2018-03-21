'use strict'

let cp = require('child_process'),
	fs = require('fs'),
	started = false

module.exports.start = function (done) {
	if (started) {
		return done()
	}

	// Fork server
	fs.copyFileSync('node_modules/log-sink-server/example-config.js', 'node_modules/log-sink-server/config.js')
	let children = cp.fork('.', ['--test-mode'], {
		cwd: 'node_modules/log-sink-server'
	})
	children.on('message', data => {
		if (data === 'online') {
			started = true
			return done()
		}
	})
}