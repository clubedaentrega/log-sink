'use strict'

var Connection = require('./lib/Connection')

module.exports = new Connection
module.exports.Connection = Connection
module.exports.prepareError = require('./lib/prepareError')