# 3.0.0

## Breaking change
* Drop support for Node.JS < 6

# 2.4.1
* Fixed: typo in previous release

# 2.4.0
* Added: `sink.prepareError(error)` accepts a new argument `maxDepth` with default value of 4
* Fixed: `sink.prepareError(error)` does not stack-overflow with error instances with self reference

# 2.3.0
* Changed: `sink.prepareError(error)` call `toJSON()` on properties when available

# 2.2.0
* Deprecated: `Connection#bindName`
* Added: `Connection#getLogger` that replaces `Connection#bindName` and adds support for setting relevance and some basic extra keys per logger

# 2.1.0
* Added: `sink.prepareError(error)` to pretty format `Error` instances into JSON objects, including protection against circular references and basic stack trace parsing

# 2.0.0
* Added: `Connection#getPermissions` to query for this user's permissions. Require log-sink-server>=1.3.1

## Breaking changes
* Changed: `Connection#bind` was renamed to `Connection#bindName`. See [#4](https://github.com/clubedaentrega/log-sink/issues/4)