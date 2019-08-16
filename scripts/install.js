const fs = require('fs')
const https = require('https')
const p = require('path')
const os = require('os')
const toml = require('toml')
const { execSync, exec } = require('child_process')

const REPO_NAME = 'sonar'
const REPO_ORG = 'Frando'
// const PROJECT_NAME = 'sonar'
// const GITHUB_REPO = 'Frando/sonar'

const OS_TARGETS = {
  linux: 'unknown-linux-gnu',
  darwin: 'apple-darwin'
}

try {
  start((err) => {
    if (err) exit(1, 'Installation failed: ' + err.message)
    console.log('Installation complete!')
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
    buildRelease(opts, cb)
  })
}

function buildRelease (opts, cb) {
  const { binaries, dest } = opts
  cb = once(cb)
  const { stdout, stderr } = exec(`cargo build --release`, (err) => {
    if (err) return cb(err)
    const srcPath = p.join(__dirname, '..', 'target', 'release')
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

  download(url, tarfile, extract)

  function extract (err) {
    if (err) return done(err)
    if (!fs.existsSync(tarfile)) return done(new Error('Error: Download failed.'))
    // TODO: Handle windows?
    execSync(`tar -xzf ${tarfile} -C ${dest}`)
    for (let bin of opts.binaries) {
      if (!fs.existsSync(p.join(dest, bin))) return done(new Error('Error: Binary is not in archive.'))
    }
    done()
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
