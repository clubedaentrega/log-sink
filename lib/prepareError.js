'use strict'

let basePath = require('path').resolve('.')

/**
 * Prepare error instance for logging
 * @param {?Error} error
 * @param {number} [maxDepth=4]
 * @returns {?Object}
 */
module.exports = function prepareError(error, maxDepth = 4) {
	if (error === null || error === undefined) {
		return null
	} else if (typeof error !== 'object') {
		throw new Error('Invalid error, expected an object, got a ' + typeof error)
	}

	let foundObjects = new Map()
	return copyDeep(error, 'error', 0)

	/**
	 * Make a deep copy, but avoid multiple/circular references
	 * @param {*} value
	 * @param {string} path
	 * @param {number} depth
	 * @returns {*}
	 */
	function copyDeep(value, path, depth) {
		if (typeof value === 'function') {
			// Functions can't be JSON-fied
			return
		}

		if (!value || typeof value !== 'object') {
			// Primitive value
			return value
		}

		// Non-primitive, by reference, value

		// Avoid call stack overflow
		if (depth > maxDepth) {
			return '[Too deep]'
		}

		// Avoid recursion
		let prevPath = foundObjects.get(value)
		if (prevPath) {
			return '[Reference to ' + prevPath + ']'
		}
		foundObjects.set(value, path)

		if (typeof value.toJSON === 'function') {
			// Convert to a more JSON-friendly value if possible
			return copyDeep(value.toJSON(), path, depth)
		}

		if (Array.isArray(value)) {
			// To clone an array clone its elements
			return value.map((value, key) => copyDeep(value, path + '.' + key, depth + 1))
		} else if (value instanceof Error) {
			// Cloning an error is close to cloning an object, except:
			// 1) also copy non-enumerable props
			// 2) ignore domain-related props
			// 3) treat stack especially
			let copied = {
				stack: []
			}
			for (let key of Object.getOwnPropertyNames(value)) {
				if (key === 'domain' ||
					key === 'domainEmitter' ||
					key === 'domainBound' ||
					key === 'domainThrown') {
					// Ignore properties set by domain, because
					// they're too noisy (complex objects) and
					// give no useful information in practice
					continue
				}

				if (key === 'stack') {
					// Parse stack
					copied.stack = prepareStack(String(value[key]))
					continue
				}

				let copiedValue = copyDeep(value[key], path + '.' + key, depth + 1)
				if (copiedValue !== undefined) {
					copied[key] = copiedValue
				}
			}
			return copied
		}

		let copied = {}
		for (let key of Object.keys(value)) {
			let copiedValue = copyDeep(value[key], path + '.' + key, depth + 1)
			if (copiedValue !== undefined) {
				copied[key] = copiedValue
			}
		}
		return copied
	}
}

/**
 * Split each stack frame and normalize paths
 * @param {string} stack
 * @returns {Array<string>}
 * @private
 */
function prepareStack(stack) {
	let lines = stack.split('\n').slice(1)

	if (lines.length > 500) {
		// Stack too big, probably this is caused by stack overflow
		// Remove middle values
		let skipped = lines.length - 500,
			top = lines.slice(0, 250),
			bottom = lines.slice(-250)
		lines = top.concat('--- skipped ' + skipped + ' frames ---', bottom)
	}

	return lines.map(line => line.trim().replace(/^at /, '').replace(basePath, '.'))
}