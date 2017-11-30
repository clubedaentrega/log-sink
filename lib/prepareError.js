'use strict'

var basePath = require('path').resolve('.')

/**
 * Prepare error instance for logging
 * @param {?Error} error
 * @returns {Object}
 */
module.exports = function prepareError(error) {
	if (error === null || error === undefined) {
		return null
	} else if (typeof error !== 'object') {
		throw new Error('Invalid error, expected an object, got a ' + typeof error)
	}

	var obj = {
		stack: []
	}

	Object.getOwnPropertyNames(error).forEach(function (key) {
		var value = error[key]

		if (key === 'domain' ||
			key === 'domainEmitter' ||
			key === 'domainBound' ||
			key === 'domainThrown') {
			// Ignore properties set by domain, because
			// they're too noisy (complex objects) and 
			// give no useful information in practice
			return
		}

		if (key === 'stack') {
			// Parse stack
			obj.stack = prepareStack(String(value))
			return
		}

		var foundObjects = [],
			paths = []
		obj[key] = copyDeep(value, key)

		// Make a deep copy, but avoid multiple/circular references
		function copyDeep(value, path) {
			if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
				value = value.toJSON()
			}

			if (value && typeof value === 'object') {
				var pos = foundObjects.indexOf(value)
				if (pos !== -1) {
					return '[Reference ' + paths[pos] + ']'
				}
				foundObjects.push(value)
				paths.push(path)

				if (Array.isArray(value)) {
					return value.map(function (value, key) {
						return copyDeep(value, path + '.' + key)
					})
				} else if (value instanceof Error) {
					return prepareError(value)
				}

				return Object.keys(value).reduce(function (obj, key) {
					obj[key] = copyDeep(value[key], path + '.' + key)
					return obj
				}, {})
			}
			return value
		}
	})

	return obj
}

/**
 * Split each stack frame and normalize paths
 * @param {string} stack
 * @returns {Array<string>}
 * @private
 */
function prepareStack(stack) {
	var lines = stack.split('\n').slice(1)

	if (lines.length > 500) {
		// Stack too big, probably this is caused by stack overflow
		// Remove middle values
		var skipped = lines.length - 500,
			top = lines.slice(0, 250),
			bottom = lines.slice(-250)
		lines = top.concat('--- skipped ' + skipped + ' frames ---', bottom)
	}

	return lines.map(function (line) {
		return line.trim().replace(/^at /, '').replace(basePath, '.')
	})
}