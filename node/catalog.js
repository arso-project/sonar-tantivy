const Pipe = require('./rpc')
const p = require('path')
const hyperdrive = require('hyperdrive')
const crypto = require('hypercore-crypto')
const fs = require('fs')
const thunky = require('thunky')
const Replicator = require('./replicate.js')

module.exports = class IndexCatalog {
  constructor (path) {
    this.path = p.resolve(path)
    this.indexPath = p.join(this.path, 'indexes')
    this.storagePath = p.join(this.path, 'hyperdrives')
    this.pipe = new Pipe(`cargo run -- ${this.indexPath}`)
  }

  async open (key, opts) {
    // Todo: check if index exists.
    return new Index(this, key, opts)
  }

  async create (schema, opts) {
    const { publicKey, secretKey } = crypto.keyPair()
    const key = hex(publicKey)
    await this.pipe.request('create_index', { name: key, schema })
    return new Index(this, key, { secretKey })
  }

  async add (key) {
    return new Promise((resolve, reject) => {
      console.log('start now')
      let index = new Index(this, key, { remote: true })
      index.replicator.driveMeta(async (err, meta) => {
        console.log('got meta', meta)
        if (err) reject(err)
        const schema = meta.schema
        await this.pipe.request('create_index', { name: key, schema })
        console.log('created index')
        resolve(index)
      })
    })
  }

  // async openOrCreate (name, schema) {
  //   if (await this.has(name)) {
  //     return this.open(name)
  //   } else {
  //     return this.create(name, schema)
  //   }
  // }

  async has (name) {
    return this.pipe.request('index_exists', name)
  }
}

class Index {
  constructor (catalog, key, opts) {
    opts = opts || {}
    this.catalog = catalog

    this.pipe = catalog.pipe
    this.key = key
    if (opts.secretKey) this.secretKey = opts.secretKey
    if (opts.remote) this.remote = true

    this._watchers = []

    this.path = p.join(this.catalog.indexPath, key)
    this.storage = p.join(this.catalog.storagePath, key)
    this.replicator = new Replicator(this, this.storage, this.remote)
  }

  // _ready () {
  //   let opts = {}
  //   if (!this.key) {
  //     const { publicKey, secretKey } = crypto.keyPair()
  //     this.key = hex(publicKey)
  //     opts.secretKey = secretKey
  //   }
  //   this.drive = hyperdrive(this.storage, this.key, opts)
  // }

  async query (query) {
    return this.pipe.request('query', { index: this.key, query: 'Hello' })
  }

  async addDocuments (documents) {
    documents = transformDocs(documents)
    return this.pipe.request('add_documents', { index: this.key, documents })
  }

  async addSegment (segmentId, maxDoc) {
    return this.pipe.request('add_segment', { index: this.key, segment_id: segmentId, max_doc: maxDoc })
  }

  meta (cb) {
    let path = p.join(this.path, 'meta.json')
    fs.readFile(path, (err, data) => {
      if (err) throw err // todo
      this._meta = JSON.parse(data)
      cb(this._meta)
    })
  }

  metaPath () {
    return p.join(this.path, 'meta.json')
  }

  watch (cb, onfirst) {
    const self = this
    this._watchers.push(cb)
    if (!this._watcher) {
      this._watcher = fs.watch(this.metaPath(), onchange)
    }

    return () => {
      this._watchers = this._watchers.filter(f => f !== cb)
    }

    function onchange () {
      self.meta((err, meta) => {
        if (err) return
        self._watchers.forEach(cb => process.nextTick(cb, meta))
      })
    }
  }

  replicate () {
  }
}

function transformDocs (documents) {
  documents = documents.map(doc => {
    let tuples = []
    for (let [field, value] of Object.entries(doc)) {
      if (Array.isArray(value)) {
        value.forEach(val => tuples.push([field, val]))
      } else {
        tuples.push([field, value])
      }
    }
    return tuples
  })
  return documents
}

function hex (buf) {
  if (!Buffer.isBuffer(buf)) return buf
  return buf.toString('hex')
}
