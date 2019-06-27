const { spawn } = require('child_process')
const debug = require('debug')
const { Transform } = require('stream')
const EOL = require('os').EOL

const debugR = debug('pipe-rust')
const debugN = debug('pipe-node')

class RustPipe {
  constructor (command) {
    this.counter = 0
    this.command = command || 'cargo run'
    this.callbacks = {}
    this.ready()
  }

  ready () {
    this.proc = spawn(this.command, [], { shell: true })

    this.receiver = new Transform({
      objectMode: true,
      transform (chunk, encoding, done) {
        let str = chunk.toString()
        let lines = str.split(EOL).filter(f => f)
        lines.forEach(line => {
          try {
            this.push(JSON.parse(line))
          } catch (e) {
            debugN('Could not parse message: %s (Reason: %s)', str, e.toString())
          }
        })
        done()
      }
    })

    this.sender = new Transform({
      objectMode: true,
      transform (chunk, enc, done) {
        let json = JSON.stringify(chunk)
        this.push(json + EOL)
        done()
      }
    })

    this.sender.pipe(this.proc.stdin)

    this.proc.stderr.on('data', d => debugR(d.toString()))
    this.proc.stdout.pipe(this.receiver)

    this.receiver.on('error', err => {
      debugN('ERROR: ', err.toString())
    })
    this.receiver.on('data', msg => {
      this.onmessage(msg)
    })

    this.sender.on('data', d => debugN('SEND', d))
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

    this.sender.write(message)
  }

  async request (type, msg) {
    return new Promise((resolve, reject) => {
      this.send(type, msg, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
  }

  onmessage (msg) {
    let id = msg.request_id
    if (!this.callbacks[id]) {
      debugN('Error: No callback', msg)
    }
    this.callbacks[id](msg.err, msg.msg)
  }
}

module.exports = RustPipe
