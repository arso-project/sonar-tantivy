const hyperdrive = require('hyperdrive')
// const hypercore = require('hypercore')
const mirror = require('mirror-folder')
const p = require('path')
const pump = require('pump')
const fs = require('fs')
const debug = require('debug')('replicate')
const raf = require('random-access-file')

// function replicateIndex (indexPath, cb) {
//   let path = p.join(indexPath, 'meta.json')
//   fs.readFile(path, (err, data) => {
//     if (err) cb(err)
//     let meta = JSON.parse(data)
//     this.segments = meta.segments
//   }
// }
//
class Replicator {
  constructor (index, storage) {
    this.index = index

    // this.storage = nestStorage(storage, name)
    // this.storage = nestStorage(raf(storage), 'files')
    // this.meta = hypercore(this.storage('meta'), {
    //   valueEncoding: 'json'
    // })
    this.drive = hyperdrive(storage, index.key, { secretKey: index.secretKey })
  }

  async ready () {
    const self = this
    if (this._ready) return
    return new Promise((resolve, reject) => {
      this.drive.ready(err => {
        console.log('drive ready', this.drive.key.toString('hex'))
        if (err) return reject(err)
        this.writable = this.drive.writable
        this.drive.watch('meta.json', this.onDriveChange.bind(this))

        if (this.index.remote) {
          this.copy('meta.json', err => {
            if (err) reject(err)
            finish()
          })
        } else finish()

        function finish () {
          self.index.meta(meta => self.start(meta))
          self.index.watch(meta => self.onIndexChange(meta))
          self._ready = true
          resolve()
        }
      })
    })
  }

  async start (meta) {
    this.onIndexChange(meta)
  }

  copy (name, cb) {
    this.drive.readFile(name, (err, buf) => {
      if (err) return cb(err)
      fs.writeFile(p.join(this.index.path, name), buf, (err) => {
        cb(err)
      })
    })
  }

  async onIndexChange (meta) {
    await this.ready()
    if (!this.writable) return
    let dst = { fs: this.drive, name: '/' }
    mirror(this.index.path, dst, { ignore }, err => {
      if (err) console.error('mirror i->d ERROR', err)
      else console.log('mirror i->d SUCCESS')
    })
    function ignore (file) {
      return false
    }
  }

  async driveMeta (cb) {
    console.log('pre')
    await this.ready()
    console.log('ready')
    this.drive.readFile('meta.json', (err, buf) => {
      console.log('drive read meta.json', err, buf)
      if (err) cb(err)
      if (!buf) cb(new Error('meta.json not found.'))
      let meta = JSON.parse(buf)
      cb(null, meta)
    })
  }

  onDriveChange () {
    // For now: Only react on drive changes for copies,
    // (i.e. not writable drives)
    if (this.writable) return
    const self = this
    this.driveMeta((err, dmeta) => {
      if (err) return console.error(err) // todo
      this.index.meta(imeta => {
        // this._replicate(dmeta, imeta)
        let src = { fs: this.drive, name: '/' }
        mirror(src, this.index.path, { ignore }, done.bind(self))
        function done (err) {
          if (err) console.error('mirror d->i ERROR', err)
          else console.log('mirror d->i SUCCESS')
          this._addSegments(dmeta, imeta)
        }
      })

      function ignore (file) {
        // todo: Filter out merges from dmeta?
        if (file === 'meta.json') return true
        return false
      }
    })
  }

  async _addSements (dmeta, imeta) {
    let dsegments = dmeta.segments.map(s => s.segment_id)
    let isegments = imeta.segments.map(s => s.segment_id)
    let newIds = dsegments.filter(id => isegments.indexOf(id) < 0)
    let newSegments = newIds.map(id => dmeta.segments[dsegments.indexOf(id)])

    for (let segment of newSegments) {
      await this.index.addSegment(uuidNoDashes(segment.segment_id), segment.max_doc)
      console.log('segment added', segment.segment_id)
    }

    function uuidNoDashes (uuid) {
      return uuid.replace(/-/g, '')
    }

    // newsegments.forEach(id => {
    //   let filename = id.replace(/-/g, '')
    //   let read = this.drive.createReadStream(filename)
    //   let write = fs.createWriteStream(p.join(this.index.path, filename))
    //   pump(read, write)
    // })
  }
}

module.exports = Replicator

function nestStorage (storage, ...prefixes) {
  return function (name, opts) {
    let path = p.join(...prefixes, name)
    let ret = storage(path, opts)
    return ret
  }
}
