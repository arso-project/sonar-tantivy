const fs = require('fs')
const https = require('https')
const p = require('path')
const os = require('os')
const toml = require('toml')
const { execSync, exec } = require('child_process')

const REPO_NAME = 'sonar-tantivy'
const REPO_ORG = 'arso-project'

const BASE_PATH = p.join(__dirname, '..')
const CARGO_PATH = p.join(BASE_PATH, 'Cargo.toml')
const DIST_PATH = p.join(BASE_PATH, 'dist')

const OS_TARGETS = {
  linux: 'unknown-linux-gnu',
  darwin: 'apple-darwin'
}

try {
  start((err) => {
    if (err) exit(1, 'Installation failed: ' + err.message)
  })
} catch (err) {
  exit(1, err.message)
}

function start (cb) {
  const ct = cargoToml()

  const binaries = ct.bin ? ct.bin.map(b => b.name) : [ct.name]

  const opts = {
    tag: `v${ct.package.version}`,
    binaries,
    targetTriple: targetTriple(),
    dest: DIST_PATH
  }

  console.log(`Installing ${ct.package.name} ${opts.tag}...`)

  if (!fs.existsSync(opts.dest)) {
    fs.mkdirSync(opts.dest)
  }

  downloadRelease(opts, err => {
    // console.log('download finished', err)
    if (!err) return done()
    if (err) console.log('  Error: ' + err.message)
    console.log('  Download of prebuild release failed, try to build...')
    buildRelease(opts, done)
  })

  function done (err) {
    if (err) return cb(err)
    console.log(`Installation of ${ct.package.name} ${opts.tag} successful!`)
  }
}

function buildRelease (opts, cb) {
  const { binaries, dest } = opts
  cb = once(cb)
  const { stdout, stderr } = exec(`cargo build --release --manifest-path=${CARGO_PATH} --color=always`, (err) => {
    if (err) return cb(err)
    const srcPath = p.join(p.dirname(CARGO_PATH), 'target', 'release')
    console.log('  Compilation successful!')
    copyFiles(binaries, srcPath, dest, cb)
  })
  stdout.pipe(process.stdout)
  stderr.pipe(process.stderr)
}

function downloadRelease (opts, cb) {
  cb = once(cb)
  const { tag, targetTriple, dest } = opts

  const filename = `${REPO_NAME}-${tag}-${targetTriple}.tar.gz`
  const url = `https://github.com/${REPO_ORG}/${REPO_NAME}/releases/download/${tag}/${filename}`
  const tarfile = p.join(dest, filename)

  console.log(`  Download: ${url}`)
  download(url, tarfile, extract)

  function extract (err) {
    if (err) return done(err)
    if (!fs.existsSync(tarfile)) return done(new Error('Error: Download failed.'))
    // TODO: Handle windows?
    try {
      execSync(`tar -xzf ${tarfile} -C ${dest}`)
      for (let bin of opts.binaries) {
        if (!fs.existsSync(p.join(dest, bin))) return done(new Error('Error: Binary is not in archive.'))
      }
      done()
    } catch (e) {
      done(e)
    }
  }

  function done (err) {
    fs.unlink(tarfile, err2 => cb(err || err2))
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
  const str = fs.readFileSync(CARGO_PATH).toString()
  return toml.parse(str)
}

function exit (code, msg) {
  const log = code ? console.error : console.log
  if (msg) log(msg)
  process.exit(code)
}

function download (url, dest, cb) {
  cb = once(cb)
  const target = fs.createWriteStream(dest)
  const request = https.get(url, response => {
    // console.log(`  -> Status ${response.statusCode} ${response.statusMessage}`)
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      // console.log('  -> Redirecting...')
      return download(response.headers.location, dest, cb)
    } else if (response.statusCode !== 200) {
      return cb(new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`))
    }

    let size = response.headers['content-length']
    let len = 0
    let msg = '  Downloading ' + pretty(size)
    let status = () => console.log(msg + '... ' + Math.round((len / size) * 100) + '%')
    let report = setInterval(status, 1000)
    status()
    response.pipe(target)
    response.on('data', d => (len = len + d.length))
    target.on('finish', () => {
      clearInterval(report)
      status()
      cb()
    })
  })
  request.on('error', err => {
    fs.unlink(dest, () => cb(err))
  })
}

function copyFiles (files, srcPath, dstPath, cb) {
  cb = once(cb)
  let paths = files.map(f => [p.join(srcPath, f), p.join(dstPath, f)])
  let pending = paths.length
  paths.forEach(([src, dst]) => fs.copyFile(src, dst, done))
  function done (err) {
    if (err) cb(err)
    else if (!--pending) cb()
  }
}

function once (fn) {
  let finish = false
  return (...args) => {
    if (finish) return
    finish = true
    fn(...args)
  }
}
function pretty (bytes) {
  let prefixes = ['', 'KB', 'MB', 'GB', 'TB']
  let base = 1024
  for (let pow = prefixes.length - 1; pow >= 0; pow--) {
    if (bytes > Math.pow(base, pow)) {
      return Math.round((bytes / Math.pow(base, pow)) * 100) / 100 + ' ' + prefixes[pow]
    }
  }
  return bytes
}
