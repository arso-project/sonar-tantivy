const { spawn } = require('child_process')
const { Transform } = require('stream')
const EOL = require('os').EOL
const { Duplex } = require('stream')
const pump = require('pump')
const Duplexify = require('duplexify')

const debug = require('debug')('rpc-pipe')

module.exports = commandPipe

function commandPipe (command) {
  const proc = spawn(command, [], { shell: true })
  const rpc = new RpcPipe()

  logStream(proc.stderr, 'proc.stderr')

  const stream = Duplexify(proc.stdin, proc.stdout)
  pump(rpc, stream, rpc)

  return rpc
}

class RpcPipe extends Duplexify {
  constructor () {
    super()
    this.counter = 0
    this.callbacks = {}

    this.in = new Transform({
      objectMode: true,
      transform (chunk, encoding, done) {
        // console.log('CHUNK LENGHT', chunk.length)
        let str = chunk.toString()
        // console.log('CHUNK STR LENGTH', str.length)
        let lines = str.split(EOL).filter(f => f)
        // console.log('LINES LENGTH', lines.length)
        lines.forEach(line => {
          try {
            this.push(JSON.parse(line))
          } catch (err) {
            debug('error', 'Could not parse message: %s (Reason: %s)', str, err.toString())
          }
        })
        done()
      }
    })

    this.out = new Transform({
      objectMode: true,
      transform (chunk, enc, done) {
        let json = JSON.stringify(chunk)
        this.push(json + EOL)
        done()
      }
    })

    logStream(this.out, 'out')
    logStream(this.in, 'in')

    this.setReadable(this.out)
    this.setWritable(this.in)

    // pump(this.out, this.proc.stdin)
    // pump(this.proc.stdout, this.in)

    this.in.on('data', msg => this._push(msg))
  }

  send (type, msg, cb) {
    let id = ++this.counter
    if (cb) {
      this.callbacks[id] = cb
    }

    let message = {
      id,
      msgtype: type,
      msg
    }

    this.out.write(message)
  }

  async request (type, msg) {
    return new Promise((resolve, reject) => {
      this.send(type, msg, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
  }

  _push (msg) {
    let id = msg.request_id
    if (!this.callbacks[id]) {
      this.emit('error', new Error('Error: No callback for message: ' + JSON.stringify(msg)))
    }
    this.callbacks[id](msg.err, msg.msg)
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
