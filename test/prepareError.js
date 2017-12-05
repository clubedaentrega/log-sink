/*global describe, it*/
'use strict'

require('should')

let prepareError = require('../lib/prepareError')

describe('prepareError', () => {
	it('should prepare the stack', () => {
		let error = new Error('message'),
			prepared = prepareError(error)
		prepared.message.should.be.eql('message')
		prepared.stack.should.be.an.Array()
	})

	it('should copy extra data', () => {
		let error = new Error('message')
		error.obj = {
			a: {
				b: 7
			}
		}
		let prepared = prepareError(error)
		prepared.obj.should.not.be.equal(error.obj)
		prepared.obj.should.be.eql(error.obj)
	})

	it('should allow recursive extra data', () => {
		let error = new Error('message')
		error.obj = {}
		error.obj.obj = error.obj
		error.self = error
		error.list = [error, error.obj]
		let prepared = prepareError(error)
		prepared.obj.should.be.eql({
			obj: '[Reference to error.obj]'
		})
		prepared.self.should.be.eql('[Reference to error]')
		prepared.list.should.be.eql(['[Reference to error]', '[Reference to error.obj]'])
	})

	it('should not copy undefined not functions', () => {
		check({
			u: undefined,
			f: () => {}
		}, {})
	})

	it('should not copy deep structures', () => {
		check({
			x: {
				x: {
					x: {
						x: {
							x: {
								x: {}
							}
						}
					}
				}
			}
		}, {
			x: {
				x: {
					x: {
						x: '[Too deep]'
					}
				}
			}
		})
	})

	it('should copy inner errors', () => {
		let errors = []
		for (let i = 0; i < 2; i++) {
			// Create the errors on the same line so that
			// they'll have the same stack
			errors[i] = new Error('message' + i)
		}
		errors[0].value = errors[1]
		let prepared = prepareError(errors[0])
		prepared.value.should.be.eql({
			message: 'message1',
			stack: prepared.stack
		})
	})
})

function check(input, output) {
	let error = new Error('message')
	error.value = input
	let prepared = prepareError(error)
	prepared.value.should.be.eql(output)
}