const p = require('path')
const Catalog = require('./catalog')
const Pipe = require('./rpc')

const COMMAND_NAME = 'sonar-tantivy'
const COMMAND_PATH = p.resolve(p.join(__dirname, '../dist', COMMAND_NAME))
const CARGO_TOML = p.resolve(p.join(__dirname, '../Cargo.toml'))

function getCommand () {
  if (process.env.RUST_ENV === 'development') {
    return `cargo run --manifest-path=${CARGO_TOML} --color=always -- `
  } else {
    return COMMAND_PATH
  }
}

module.exports = function openSonar (path, opts = {}) {
  path = p.resolve(path)
  const command = getCommand()
  const pipe = new Pipe(command, [path], {
    log: opts.log || (process.env.RUST_ENV === 'development' && console.log)
  })
  const catalog = new Catalog(pipe, opts)
  return catalog
}
