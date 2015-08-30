# next

* Added: `sink.prepareError(error)` to pretty format `Error` instances into JSON objects, including protection against circular references and basic stack trace parsing

# 2.0.0

* Added: `Connection#getPermissions` to query for this user's permissions. Require log-sink-server>=1.3.1

## Breaking changes
* Changed: `Connection#bind` was renamed to `Connection#bindName`. See [#4](https://github.com/clubedaentrega/log-sink/issues/4)