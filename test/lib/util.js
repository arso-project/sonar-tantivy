const temporaryDirectory = require('temporary-directory')

module.exports = { tempdir }

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
