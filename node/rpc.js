const { spawn } = require('child_process')
const pump = require('pump')
const Duplexify = require('duplexify')
const { Transform } = require('stream')
const split2 = require('split2')

const debug = require('debug')('rpc-pipe')

module.exports = commandPipe

function commandPipe (command) {
  const proc = spawn(command, [], { shell: true })
  logStream(proc.stderr, 'proc.stderr')

  // logStream(proc.stdin, 'proc.stdin')
  // logStream(proc.stdout, 'proc.stdout')

  const procStream = Duplexify(proc.stdin, proc.stdout)
  const rpcStream = new RpcPipe()

  rpcStream.at('foobar', (msg, cb) => {
    console.log('YEAH!', msg)
    if (msg === 'hi') cb(null, 'heia')
    else cb()
  })

  pump(procStream, rpcStream, procStream)

  return rpcStream
}

const methods = Symbol('methods')
const callbacks = Symbol('callbacks')
const counter = Symbol('counter')

class RpcPipe extends Duplexify {
  constructor () {
    super()
    this[counter] = 0
    this[callbacks] = []
    this[methods] = []

    this.in = split2(parse)
    function parse (chunk) {
      chunk = String(chunk)
      if (!chunk) return
      try {
        return JSON.parse(chunk)
      } catch (err) {
          debug('Error: Could not parse message: %s (Reason: %s)', chunk.toString(), err.toString())
      }
    }

    // this.in = split2('\n').pipe(new Transform({
    //   objectMode: true,
    //   transform (chunk, encoding, done) {
    //     console.log(chunk, chunk.toString())
    //     try {
    //       this.push(JSON.parse(chunk.toString()))
    //     } catch (err) {
    //       debug('Error: Could not parse message: %s (Reason: %s)', chunk.toString(), err.toString())
    //     }
    //     done()
    //   }
    // }))

    this.out = new Transform({
      objectMode: true,
      transform (chunk, enc, done) {
        let json = JSON.stringify(chunk)
        this.push(json + '\n')
        done()
      }
    })

    logStream(this.out, 'out')
    logStream(this.in, 'in')

    this.setReadable(this.out)
    this.setWritable(this.in)

    this.out.cork()
    this.in.on('data', msg => this._handle(msg))
  }

  at (method, cb) {
    this[methods][method] = cb
  }

  sendRequest (method, msg, cb) {
    let id = ++this[counter]
    if (cb) {
      this[callbacks][id] = cb
    }

    let message = {
      id,
      method,
      msg
    }

    this.out.write(message)
  }

  sendResponse (request, err, msg) {
    let message = {
      request_id: request.id,
      err,
      msg
    }

    this.out.write(message)
  }

  async request (method, msg) {
    return new Promise((resolve, reject) => {
      this.sendRequest(method, msg, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
  }

  _handle (message) {
    if (message.method) this._onRequest(message)
    else if (message.request_id) this._onResponse(message)
    else this.emit('error', new Error('Invalid message: ' + JSON.stringify(message)))
  }

  _onRequest (message) {
    const { method, id, msg } = message

    if (method === 'hello') return this.out.uncork()

    if (!this[methods][method]) {
      this.emit('error', new Error('No handler for message: ' + JSON.stringify(message)))
    }
    this[methods][method](msg, (err, response) => {
      this.sendResponse(message, err, response)
    })
  }

  _onResponse (message) {
    const { request_id: requestId, err, msg } = message

    if (!this[callbacks][requestId]) {
      this.emit('error', new Error('No callback for message: ' + JSON.stringify(message)))
    }
    this[callbacks][requestId](err, msg)
    // Todo: Keep the callbacks to allow streaming?
    delete this[callbacks][requestId]
  }
}

function logStream (stream, name) {
  stream.on('data', msg => debug(name, stringify(msg)))
  stream.on('error', msg => debug('ERROR', name, msg))
  function stringify (msg) {
    if (Buffer.isBuffer(msg)) msg = msg.toString()
    if (typeof msg === 'object') msg = JSON.stringify(msg)
    if (msg.length > 80) msg = msg.substring(0, 100) + '...'
    return msg
  }
}
