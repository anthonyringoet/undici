'use strict'

const {
  InvalidArgumentError,
  RequestTimeoutError
} = require('./core/errors')
const { AsyncResource } = require('async_hooks')

const kRequestTimeout = Symbol('request timeout')
const kAbort = Symbol('abort')
const kAborted = Symbol('aborted')
const kListener = Symbol('listener')
const kTimeout = Symbol('timeout')
const kSignal = Symbol('signal')

class BaseHandler extends AsyncResource {
  constructor ({ signal, requestTimeout }) {
    if (signal && typeof signal.on !== 'function' && typeof signal.addEventListener !== 'function') {
      throw new InvalidArgumentError('signal must be an EventEmitter or EventTarget')
    }

    if (requestTimeout != null && (!Number.isInteger(requestTimeout) || requestTimeout < 0)) {
      throw new InvalidArgumentError('requestTimeout must be a positive integer or zero')
    }

    super('UNDICI')

    if (signal) {
      this[kSignal] = signal
      this[kAborted] = false
      this[kAbort] = null
      this[kListener] = () => {
        this[kAborted] = true
        if (this[kAbort]) {
          this[kAbort]()
        }
      }
      if ('addEventListener' in signal) {
        signal.addEventListener('abort', this[kListener])
      } else {
        signal.addListener('abort', this[kListener])
      }
    }

    requestTimeout = requestTimeout != null ? requestTimeout : 30e3

    if (requestTimeout) {
      this[kRequestTimeout] = requestTimeout
      this[kTimeout] = null
    }
  }

  onConnect (abort) {
    if (this[kSignal]) {
      if (this[kAborted]) {
        abort()
        return
      } else {
        this[kAbort] = abort
      }
    }

    if (this[kRequestTimeout]) {
      if (this[kTimeout]) {
        clearTimeout(this[kTimeout])
      }

      this[kTimeout] = setTimeout((abort) => {
        abort(new RequestTimeoutError())
      }, this[kRequestTimeout], abort)
    }
  }

  onHeaders () {
    const {
      [kTimeout]: timeout
    } = this

    if (timeout) {
      this[kTimeout] = null
      clearTimeout(timeout)
    }
  }

  onUpgrade () {
    destroy(this)
  }

  onComplete () {
    destroy(this)
  }

  onError () {
    destroy(this)
  }
}

function destroy (request) {
  const {
    [kTimeout]: timeout,
    [kSignal]: signal
  } = request

  if (timeout) {
    request[kTimeout] = null
    clearTimeout(timeout)
  }

  if (signal) {
    request[kSignal] = null
    if ('removeEventListener' in signal) {
      signal.removeEventListener('abort', request[kListener])
    } else {
      signal.removeListener('abort', request[kListener])
    }
  }
}

module.exports = BaseHandler
