/*globals it*/
'use strict'

var should = require('should'),
	sink = require('../'),
	fs = require('fs')

it('should connect to the server', function (done) {
	sink.connect('test', '', {
		secure: true,
		port: 8018,
		ca: fs.readFileSync('test/example-cert.pem')
	})
	sink.once('connect', done)
})

var stream
it('should set a stream', function (done) {
	sink.stream(function (err, stream_) {
		should(err).be.null
		stream = stream_
		done()
	})
})

var minDate
it('should write log and stream it', function (done) {
	stream.on('data', function (log) {
		log.origin.should.be.equal('test')
		log.date.should.be.a.Date
		log.name.should.be.equal('mocha')
		log.level.should.be.equal(sink.LEVEL.INFO)
		log.relevance.should.be.equal(sink.RELEVANCE.NORMAL)
		log.message.should.be.equal('my-message')
		should(log.extra).be.equal(undefined)
		done()
	})
	minDate = new Date
	sink.info('mocha', 'my-message', [3, 14])
})

it('should close the stream', function (done) {
	stream.once('end', done)
	stream.stop()
	stream.stopped.should.be.true
})

it('should query logs', function (done) {
	sink.query({
		date: {
			min: minDate
		}
	}, function (err, logs) {
		should(err).be.null
		logs.should.have.length(1)
		logs[0].name.should.be.equal('mocha')
		done()
	})
})

it('should close the connection', function (done) {
	sink.once('close', done)
	sink.close()
})