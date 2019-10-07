const { spawn } = require('child_process')
const pump = require('pump')
const Duplexify = require('duplexify')
const { Transform } = require('stream')
const split2 = require('split2')

const debug = require('debug')('sonar')

module.exports = commandPipe

const methods = Symbol('methods')
const callbacks = Symbol('callbacks')
const counter = Symbol('counter')

function commandPipe (command, args = [], opts = {}) {
  const proc = spawn(command, args, { shell: true })

  debug(`Spawn: ${command} ${args.join(' ')}`)

  if (opts.log) {
    logStream(opts.log, proc.stderr, 'rs')
  }

  const procStream = Duplexify(proc.stdin, proc.stdout)
  const rpcStream = new RpcPipe(opts)

  pump(procStream, rpcStream, procStream)

  proc.on('close', code => {
    if (code !== 0) rpcStream.emit('error', new Error('Child process died: ' + code))
    rpcStream.destroy()
  })

  rpcStream.childProcess = proc

  return rpcStream
}

class RpcPipe extends Duplexify {
  constructor (opts = {}) {
    super()
    this[counter] = 0
    this[callbacks] = []
    this[methods] = []

    this.in = split2(function parse (chunk) {
      chunk = String(chunk)
      if (!chunk) return
      try {
        return JSON.parse(chunk)
      } catch (err) {
        debug('Error: Could not parse message: %s (Reason: %s)', chunk.toString(), err.toString())
      }
    })

    this.out = new Transform({
      objectMode: true,
      transform (chunk, enc, done) {
        let json = JSON.stringify(chunk)
        this.push(json + '\n')
        done()
      }
    })

    if (opts.debug) {
      logStream(opts.debug, this.out, 'out')
      logStream(opts.debug, this.in, 'in')
    }

    this.setReadable(this.out)
    this.setWritable(this.in)

    this.out.cork()
    this.in.on('data', msg => this._recv(msg))
  }

  at (method, cb) {
    this[methods][method] = cb
  }

  request (method, msg, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        cb = (err, data) => err ? reject(err) : resolve(data)
        this._sendRequest(method, msg, cb)
      })
    } else {
      this._sendRequest(method, msg, cb)
    }
  }

  _sendRequest (method, msg, cb) {
    const id = ++this[counter]
    if (cb) this[callbacks][id * -1] = cb

    const message = { id, method, msg }

    this.out.write(message)
  }

  _sendResponse (id, err, msg) {
    const message = { id, err, msg }
    this.out.write(message)
  }

  _recv (msg) {
    if (msg.id >= 0 && msg.method) {
      this._onrequest(msg)
    } else if (msg.id < 0) {
      this._onresponse(msg)
    } else {
      this.emit('error', new Error('Invalid message: ' + JSON.stringify(msg)))
    }
  }

  _onrequest (message) {
    const { method, id, msg } = message

    if (method === 'hello') return this.out.uncork()

    if (!this[methods][method]) {
      this.emit('error', new Error('No handler for message: ' + JSON.stringify(message)))
    }
    this[methods][method](msg, (err, response) => {
      this._sendResponse(id, err, response)
    })
  }

  _onresponse (message) {
    const { id, err, msg } = message

    if (!this[callbacks][id]) {
      this.emit('error', new Error('No callback for message: ' + JSON.stringify(message)))
    }
    this[callbacks][id](err, msg)
    // Todo: Keep the callbacks to allow streaming?
    delete this[callbacks][id]
  }
}

function logStream (log, stream, name) {
  if (log === true) log = debug
  stream.on('data', msg => log(`${name}: ${stringify(msg)}`))
  stream.on('error', msg => log(`${name} [ERROR]: ${msg}`))
  function stringify (msg) {
    if (Buffer.isBuffer(msg)) msg = msg.toString()
    if (typeof msg === 'object') msg = JSON.stringify(msg)
    // if (msg.length > 80) msg = msg.substring(0, 100) + '...'
    return msg
  }
}
