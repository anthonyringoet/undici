'use strict'

const {
  InvalidArgumentError
} = require('./core/errors')
const BaseHandler = require('./client-base')
const util = require('./core/util')

class UpgradeHandler extends BaseHandler {
  constructor (opts, callback) {
    if (!opts || typeof opts !== 'object') {
      throw new InvalidArgumentError('invalid opts')
    }

    super(opts)

    this.opaque = opts.opaque || null
    this.callback = callback
  }

  onConnect (abort) {
    super.onConnect(abort)
  }

  onUpgrade (statusCode, headers, socket) {
    super.onConnect(statusCode, headers, socket)

    const { callback, opaque } = this

    this.callback = null
    this.runInAsyncScope(callback, null, null, {
      headers: util.parseHeaders(headers),
      socket,
      opaque
    })
  }

  onError (err) {
    super.onError(err)

    const { callback, opaque } = this

    if (callback) {
      this.callback = null
      process.nextTick((self, callback, err, opaque) => {
        self.runInAsyncScope(callback, null, err, { opaque })
      }, this, callback, err, opaque)
    }
  }
}

function upgrade (opts, callback) {
  if (callback === undefined) {
    return new Promise((resolve, reject) => {
      upgrade.call(this, opts, (err, data) => {
        return err ? reject(err) : resolve(data)
      })
    })
  }

  if (typeof callback !== 'function') {
    throw new InvalidArgumentError('invalid callback')
  }

  try {
    const upgradeHandler = new UpgradeHandler(opts, callback)
    const {
      path,
      method,
      headers,
      servername,
      signal,
      requestTimeout,
      protocol
    } = opts
    this.dispatch({
      path,
      method: method || 'GET',
      headers,
      servername,
      signal,
      requestTimeout,
      upgrade: protocol || 'Websocket'
    }, upgradeHandler)
  } catch (err) {
    process.nextTick(callback, err, null)
  }
}

module.exports = upgrade
