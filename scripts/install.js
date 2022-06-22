const fs = require('fs')
const unzip = require('unzip-stream')
const https = require('https')
const p = require('path')
const os = require('os')
const { pipeline } = require('stream')
const toml = require('toml')
const { exec, spawnSync } = require('child_process')

const REPO_NAME = 'sonar-tantivy'
const REPO_ORG = 'arso-project'

const TARGETS = {
  linux: {
    x64: 'x86_64-unknown-linux-musl',
    arm: 'armv7-unknown-linux-musleabihf',
    arm64: 'aarch64-unknown-linux-musl'
  },
  win32: {
    x64: 'x86_64-pc-windows-msvc'
  },
  darwin: {
    x64: 'x86_64-apple-darwin'
  }
}

const BASE_PATH = p.join(__dirname, '..')
const CARGO_PATH = p.join(BASE_PATH, 'Cargo.toml')
const DIST_PATH = p.join(BASE_PATH, 'dist')

run().catch(err => {
  console.error('Installation failed: ' + err.message)
  process.exit(1)
})

async function run () {
  const ct = cargoToml()
  const platform = process.env.CI_PLATFORM || os.platform()
  const arch = process.env.CI_ARCH || os.arch()

  if (!TARGETS[platform]) {
    throw new Error(`Platform ${platform} is not supported.`)
  }
  if (!TARGETS[platform][arch]) {
    throw new Error(`Architecture ${arch} is not supported on platform ${platform}.`)
  }
  const targetTriple = TARGETS[platform][arch]

  const binaries = ct.bin ? ct.bin.map(b => b.name) : [ct.name]
  binaries.forEach((bin, i) => {
    if (platform === 'win32') binaries[i] = bin + '.exe'
  })

  const opts = {
    tag: `v${ct.package.version}`,
    binaries,
    targetTriple,
    dest: DIST_PATH,
    platform
  }

  console.log(`Installing ${ct.package.name} ${opts.tag}...`)

  if (!fs.existsSync(opts.dest)) {
    fs.mkdirSync(opts.dest)
  }

  try {
    await downloadAndExtractRelease(opts)
  } catch (err) {
    console.log('  Error: ' + err.message)
    if (process.env.SKIP_BUILD) throw err
    console.log('  Download of prebuild release failed, try to build...')
    await buildRelease(opts)
  }

  console.log(`Installation of ${ct.package.name} ${opts.tag} successful!`)
}

async function buildRelease (opts) {
  const { binaries, dest } = opts
  await new Promise((resolve, reject) => {
    const { stdout, stderr } = exec(`cargo build --release --manifest-path=${CARGO_PATH} --color=always`, (err) => {
      if (err) reject(err)
      else resolve()
    })
    stdout.pipe(process.stdout)
    stderr.pipe(process.stderr)
  })
  const srcPath = p.join(p.dirname(CARGO_PATH), 'target', 'release')
  console.log('  Compilation successful!')
  copyFiles(binaries, srcPath, dest)
}

function copyFiles (files, srcPath, dstPath) {
  const paths = files.map(f => [p.join(srcPath, f), p.join(dstPath, f)])
  for (const [src, dst] of paths) {
    fs.copyFileSync(src, dst)
  }
}

async function downloadAndExtractRelease (opts) {
  const { tag, targetTriple, platform, dest } = opts

  let filename
  if (platform === 'win32') {
    filename = `${REPO_NAME}-${tag}-${targetTriple}.zip`
  } else {
    filename = `${REPO_NAME}-${tag}-${targetTriple}.tar.gz`
  }
  const url = `https://github.com/${REPO_ORG}/${REPO_NAME}/releases/download/${tag}/${filename}`
  const filepath = p.join(dest, filename)

  console.log(`  Download: ${url}`)
  await download(url, filepath)
  console.log('  Download successful.')
  await extract(filepath, dest)

  for (const bin of opts.binaries) {
    const bpath = p.join(dest, bin)
    if (!fs.existsSync(bpath)) {
      throw new Error(`Error: Binary not found in archive (\`${bpath} not found after extracting)`)
    }
  }

  fs.unlinkSync(filepath)
}

function cargoToml () {
  const str = fs.readFileSync(CARGO_PATH).toString()
  return toml.parse(str)
}

async function extract (filepath, dest) {
  if (!fs.existsSync(filepath)) throw new Error('Error: Download failed.')
  if (filepath.endsWith('.zip')) {
    await new Promise((resolve, reject) => {
      pipeline(fs.createReadStream(filepath), unzip.Extract({ path: dest }), err => err ? reject(err) : resolve())
    })
  } else {
    const res = spawnSync('tar', ['-xzf', filepath, '-C', dest])
    if (res.error) {
      throw new Error('Failed to extract archive, Error: ' + res.error.message)
    }
  }
}

async function download (url, dest) {
  const [request, response] = await new Promise(resolve => {
    const request = https.get(url, response => resolve([request, response]))
  })
  // console.log(`  -> Status ${response.statusCode} ${response.statusMessage}`)
  if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    // console.log('  -> Redirecting...')
    return download(response.headers.location, dest)
  } else if (response.statusCode !== 200) {
    throw new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`)
  }

  const size = response.headers['content-length']
  let len = 0
  const msg = '  Downloading ' + pretty(size)
  const status = () => console.log(msg + '... ' + Math.round((len / size) * 100) + '%')
  const report = setInterval(status, 1000)
  status()
  const target = fs.createWriteStream(dest)
  response.pipe(target)
  response.on('data', d => (len = len + d.length))
  await new Promise((resolve, reject) => {
    target.on('error', reject)
    request.on('error', err => {
      fs.unlink(dest, () => reject(err))
    })
    target.on('finish', () => {
      clearInterval(report)
      status()
      resolve('adsf')
    })
  })
}

function pretty (bytes) {
  const prefixes = ['', 'KB', 'MB', 'GB', 'TB']
  const base = 1024
  for (let pow = prefixes.length - 1; pow >= 0; pow--) {
    if (bytes > Math.pow(base, pow)) {
      return Math.round((bytes / Math.pow(base, pow)) * 100) / 100 + ' ' + prefixes[pow]
    }
  }
  return bytes
}
