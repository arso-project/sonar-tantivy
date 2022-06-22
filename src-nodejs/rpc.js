const { spawn } = require('child_process')
const pump = require('pump')
const Duplexify = require('duplexify')
const c = require('ansi-colors')
const { Transform } = require('stream')
const split2 = require('split2')

const debug = require('debug')('sonar-tantivy')

module.exports = commandPipe

const methods = Symbol('methods')
const callbacks = Symbol('callbacks')
const counter = Symbol('counter')

function commandPipe (command, args = [], opts = {}) {
  debug(`Spawn: ${command} ${args.join(' ')}`)
  const proc = spawn(command, args)

  logStream(debug, proc.stderr)

  const procStream = Duplexify(proc.stdin, proc.stdout)
  const rpcStream = new RpcPipe(opts)
  let closed = false

  const onError = (code, err) => {
    if (closed) return
    closed = true
    if (code !== null && code !== 0) {
      if (!rpcStream._started || err?.code === 'ENOENT') {
        console.error(c.red.bold('ERROR: sonar-tantivy failed to start the tantivy process.'))
        console.error(c.yellow('Make sure that the sonar-tantivy binary was downloaded.'))
        console.error(c.yellow('Run the following command to re-run the download script:'))
        console.error('    cd node_modules/@arso-project/sonar-tantivy; npm run postinstall')
        console.error(c.yellow('or set the environement variable'))
        console.error('    DEBUG=sonar-tantivy')
        console.error(c.yellow('to see the full error log.'))
        rpcStream.emit('error', new Error('sonar-tantivy failed to start.'))
      } else {
        console.error(c.red.bold('ERROR: sonar-tantivy crashed.') + c.red(` (exit code: ${code})`))
        console.error(c.yellow('Set environement variable') + ' DEBUG=sonar-tantivy ' + c.yellow('to see the error output.'))
        rpcStream.emit('error', new Error('sonar-tantivy crashed.'))
      }
    }
    rpcStream.destroy()
  }

  proc.on('error', err => onError(1, err))
  proc.on('close', code => onError(code))

  pump(procStream, rpcStream, procStream)
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
        const json = JSON.stringify(chunk)
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
    if (!this._started) this._started = true
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
  name = name ? name + ':' : ''
  stream.on('data', msg => log(`${name} ${stringify(msg)}`))
  stream.on('error', msg => log(`${name} [ERROR] ${msg}`))
  function stringify (msg) {
    if (Buffer.isBuffer(msg)) msg = msg.toString()
    if (typeof msg === 'object') msg = JSON.stringify(msg)
    // if (msg.length > 80) msg = msg.substring(0, 100) + '...'
    return msg
  }
}
