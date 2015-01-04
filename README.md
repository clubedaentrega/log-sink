# Log Sink
A service for streaming, storage and query of log data.

This is the client-side implementation in nodejs. For the server-side implementation and server public API, see [log-sink-server](https://github.com/clubedaentrega/log-sink-server).

## Install
`npm install log-sink --save`

## Usage
```js
var sink = require('log-sink'),
	fs = require('fs')

// Connect to log sink server using a secure connection
sink.connect('my-user', 'my-password', {
	secure: true,
	// If the server is using a self-signed certificate,
	// include it here
	ca: fs.readFileSync('keys/self-signed-cert.pem')
})

// Write
// sink.{debug,info,warn,error,fatal}(name, [message], [extra])
// If the connection is not ready yet, it will be buffered and
// executed when it gets ready
sink.info('readme', 'My first log', ['custom data', 17])
sink.error('readme', new Error('We had a problem'))

// Or avoid typing the required name every time
var logger = sink.bind('readme')
logger.debug('Got here!')

// Streaming
sink.stream(function (err, stream) {
	if (err) throw err
	// stream is a ReadableStream in object mode
	stream.on('data', function (log) {
		console.log(log)
	})
	// call stream.stop() when you are done
})

// Querying
sink.query({
	level: {
		min: sink.LEVEL.WARN
	}
}, function (err, logs) {
	if (err) throw err
	console.log(logs)
})
```

## Multiple connections
```js
var sink = require('log-sink'),
	conn = new sink.Connection,
	conn2 = new sink.Connection

conn.connect('user', 'pass', options)
conn2.connect('user2', 'pass2', options2)
```

## Log Sink
To understand more about log sink, read the doc on the [server project](https://github.com/clubedaentrega/log-sink-server)

## Docs
All public methods are described in the generated docs: