const fs = require('fs')
const https = require('https')
const p = require('path')
const os = require('os')
const toml = require('toml')
const hyperquest = require('hyperquest')
const { execSync, exec } = require('child_process')

const GITHUB_REPO = 'Frando/sonar'
const BINARY_NAME = 'sonar-search'

const OS_TARGETS = {
  linux: 'unknown-linux-gnu',
  darwin: 'apple-darwin'
}

try {
  start((err) => {
    if (err) exit(1, 'Installation failed: ' + err.message)
    console.log('Download complete!')
  })
} catch (err) {
  exit(1, err.message)
}

function start (cb) {
  const ct = cargoToml()

  const opts = {
    tag: `v${ct.package.version}`,
    name: `${ct.package.name}`,
    repo: GITHUB_REPO,
    targetTriple: targetTriple(),
    dest: p.join(__dirname, '..', 'dist')
  }

  if (!fs.existsSync(opts.dest)) {
    fs.mkdirSync(opts.dest)
  }

  downloadRelease(opts, err => {
    // console.log('download finished', err)
    if (!err) return cb()
    if (err) console.log('Error: ' + err.message)
    console.log('Download of prebuild release failed, try to build...')
    build(opts, cb)
  })
}

function build (opts, cb) {
  cb = once(cb)
  const { stdout, stderr } = exec(`cargo build --release`, (err) => {
    if (err) return cb(err)
    const binary = p.join(__dirname, 'target', 'release', BINARY_NAME)
    fs.copyFile(binary, p.join(opts.dest, BINARY_NAME), err => {
      if (err) return cb(err)
      cb()
    })
  })
  stdout.pipe(process.stdout)
  stderr.pipe(process.stderr)
}

function downloadRelease (opts, cb) {
  cb = once(cb)
  const { name, tag, targetTriple, repo, dest } = opts

  const filename = `${name}-${tag}-${targetTriple}.tar.gz`
  const url = `https://github.com/${repo}/releases/download/${tag}/${filename}`


  const tarfile = p.join(dest, filename)

  download(url, tarfile, extract)

  function extract (err) {
    if (err) return cb(err)
    if (!fs.existsSync(tarfile)) return cb(new Error('Error: Download failed.'))
    // TODO: Handle windows
    execSync(`tar -xzf ${tarfile} -C ${dest}`)
    if (!fs.existsSync(p.join(dest, BINARY_NAME))) return cb(new Error('Error: Binary is not in archive.'))
    fs.unlinkSync(tarfile)
    cb()
  }
}

function targetTriple () {
  const platform = os.platform()
  const arch = os.arch()
  if (arch !== 'x64') throw new Error('Only x64 is supported at the moment.')
  if (!OS_TARGETS[platform]) throw new Error(`Platform ${platform} is not supported.`)
  const target = OS_TARGETS[platform]
  return `x86_64-${target}`
}

function cargoToml () {
  const str = fs.readFileSync(p.join(__dirname, '../Cargo.toml')).toString()
  return toml.parse(str)
}

function exit (code, msg) {
  const log = code ? console.error : console.log
  if (msg) log(msg)
  process.exit(code)
}

function download (url, dest, opts, cb) {
  if (!cb) return download(url, dest, {}, opts)
  cb = once(cb)
  // console.log(`Download options: ${JSON.stringify(opts)}`)
  console.log(`Download: ${url}`)
  // console.log(`Save to: ${dest}`)
  const target = fs.createWriteStream(dest)
  https.get(url, opts, response => {
    // console.log(`Status: ${response.statusCode} ${response.statusMessage}`)
    if (response.statusCode === 302) {
      console.log('Redirect to: ' + response.headers.location)
      return download(response.headers.location, dest, opts, cb)
    } else if (response.statusCode !== 200) {
      return cb(new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`))
    }

    response.pipe(target)
    target.on('finish', () => {
      cb()
    })
  }).on('error', err => {
    fs.unlink(dest, () => cb(err))
  })
}

function once (fn) {
  let finish = false
  return (...args) => {
    if (finish) return
    finish = true
    fn(...args)
  }
}
