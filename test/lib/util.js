const temporaryDirectory = require('temporary-directory')
const fs = require('fs')
const p = require('path')

module.exports = { tempdir, copyFiles }

function tempdir () {
  return new Promise((resolve, reject) => {
    temporaryDirectory('sonar', (err, dir, cleanupCb) => {
      if (err) return reject(err)
      const cleanup = () => new Promise((resolve, reject) => {
        cleanupCb(err => err ? reject(err) : resolve())
      })
      resolve([dir, cleanup])
    })
  })
}

function copyFiles (src, dst, files) {
  return new Promise((resolve, reject) => {
    let pending = files.length
    for (const file of files) {
      fs.copyFile(p.join(src, file), p.join(dst, file), done)
    }
    function done (err) {
      if (err) return reject(err)
      else if (--pending === 0) resolve()
    }
  })
}
