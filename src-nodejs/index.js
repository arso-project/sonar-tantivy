const p = require('path')
const Sonar = require('./catalog')
const Pipe = require('./rpc')

const COMMAND_NAME = 'sonar-tantivy'
const COMMAND_PATH = p.resolve(p.join(__dirname, '../dist', COMMAND_NAME))
const CARGO_TOML = p.resolve(p.join(__dirname, '../Cargo.toml'))

module.exports = openSonar
module.exports.segmentFiles = Sonar.segmentFiles

function getCommand () {
  if (process.env.RUST_ENV === 'development') {
    return `cargo run --manifest-path=${CARGO_TOML} --color=always -- `
  } else {
    return COMMAND_PATH
  }
}

function openSonar (path, opts = {}) {
  path = p.resolve(path)
  const command = getCommand()
  const pipe = new Pipe(command, [path], {
    log: opts.log || (process.env.RUST_ENV === 'development' && console.log)
  })
  opts.path = path
  const catalog = new Sonar(pipe, opts)
  return catalog
}
