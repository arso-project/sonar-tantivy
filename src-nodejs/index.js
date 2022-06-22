const p = require('path')
const Sonar = require('./catalog')
const Pipe = require('./rpc')

const COMMAND_NAME = 'sonar-tantivy'
const COMMAND_PATH = p.resolve(p.join(__dirname, '../dist', COMMAND_NAME))
const CARGO_TOML = p.resolve(p.join(__dirname, '../Cargo.toml'))

module.exports = openSonar
module.exports.segmentFiles = Sonar.segmentFiles

function getCommandAndArgs () {
  if (process.env.RUST_ENV === 'development') {
    const args = [
      'run',
      `--manifest-path=${CARGO_TOML}`,
      '--color=always'
    ]
    if (process.env.RUST_BUILD === 'release') args.push('--release')
    args.push('--')
    return ['cargo', args]
  } else {
    return [COMMAND_PATH, []]
  }
}

function openSonar (path, opts = {}) {
  path = p.resolve(path)
  const [command, args] = getCommandAndArgs()
  args.push(path)
  const pipe = new Pipe(command, args, {
    log: opts.log || (process.env.RUST_ENV === 'development' && console.log)
  })
  opts.path = path
  const catalog = new Sonar(pipe, opts)
  return catalog
}
