/* globals it, before */
'use strict'

let should = require('should'),
	sink = require('../'),
	fs = require('fs'),
	utils = require('./utils')

before(done => utils.start(done))

it('should connect to the server', done => {
	sink.connect('test', '', {
		secure: true,
		port: 8018,
		host: 'localhost',
		ca: fs.readFileSync('test/example-cert.pem')
	})
	sink.once('connect', done)
})

let stream
it('should set a stream', done => {
	sink.stream({}, true, (err, stream_) => {
		should(err).be.null()
		stream = stream_
		done()
	})
})

let minDate
it('should write log and stream it', done => {
	stream.once('data', log => {
		log.origin.should.be.equal('test')
		log.date.should.be.instanceof(Date)
		log.name.should.be.equal('mocha')
		log.level.should.be.equal(sink.LEVEL.INFO)
		log.relevance.should.be.equal(sink.RELEVANCE.NORMAL)
		log.message.should.be.equal('my-message')
		log.extra.should.be.eql([3, 14])
		done()
	})
	minDate = new Date
	sink.info('mocha', 'my-message', [3, 14])
})

it('should write using a binded logger', done => {
	stream.once('data', log => {
		log.origin.should.be.equal('test')
		log.date.should.be.instanceof(Date)
		log.name.should.be.equal('name')
		log.level.should.be.equal(sink.LEVEL.DEBUG)
		log.relevance.should.be.equal(sink.RELEVANCE.HIGH)
		log.message.should.be.equal('message')
		log.extra.should.be.eql({
			a: 2,
			b: 3
		})

		done()
	})
	let logger = sink.getLogger('name', sink.RELEVANCE.HIGH, {
		a: 2
	})
	logger.debug('message', {
		b: 3
	})
})

it('should close the stream', done => {
	stream.once('end', done)
	stream.stop()
	stream.stopped.should.be.true()
})

it('should query logs', done => {
	sink.query({
		date: {
			min: minDate
		}
	}, (err, logs) => {
		should(err).be.null()
		logs.should.have.length(1)
		logs[0].name.should.be.equal('mocha')
		done()
	})
})

it('should get permissions', done => {
	sink.getPermissions((err, permissions) => {
		should(err).be.null()
		permissions.should.be.eql(['test', 'test2'])
		done()
	})
})

it('should log an error instance with extra properties', done => {
	let oid = {
		_bsontype: 'ObjectID'
	}

	Object.defineProperty(oid, 'toJSON', {
		value: () => '5a2018e310901027a949c444'
	})

	let err = new Error('Error msg')
	err.oid = oid

	sink.error('extra log', err)
	sink.query({
		name: 'extra log',
		date: {
			min: minDate
		}
	}, (err, logs) => {
		should(err).be.null()
		logs.should.have.length(1)
		logs[0].name.should.be.equal('extra log')
		done()
	})
})

it('should close the connection', done => {
	sink.once('close', done)
	sink.close()
})

it('should fail on stream and query after closed', done => {
	sink.stream(err => {
		err.message.should.be.equal('Connection is closed')
		sink.query(err => {
			err.message.should.be.equal('Connection is closed')
			done()
		})
	})
})

it('should cap values to 1000 bytes', () => {
	let b1 = '\u000F',
		b2 = '\u00FF',
		b3 = '\u0FFF'

	// One byte
	sink._capByteLength(b1.repeat(900), 1000).should.have.length(900)
	sink._capByteLength(b1.repeat(1000), 1000).should.have.length(1000)
	sink._capByteLength(b1.repeat(1100), 1000).should.have.length(1000)

	// Two bytes
	sink._capByteLength(b2.repeat(400), 1000).should.have.length(400)
	sink._capByteLength(b2.repeat(500), 1000).should.have.length(500)
	sink._capByteLength(b2.repeat(600), 1000).should.have.length(500)

	// Three bytes
	sink._capByteLength(b3.repeat(332), 1000).should.have.length(332)
	sink._capByteLength(b3.repeat(333), 1000).should.have.length(333)
	sink._capByteLength(b3.repeat(334), 1000).should.have.length(334)
	sink._capByteLength(b3.repeat(335), 1000).should.have.length(334)
})