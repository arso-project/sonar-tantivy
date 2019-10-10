const { EventEmitter } = require('events')
const fs = require('fs')
const p = require('path')

const SEGMENT_FILES = [
  '.fast',
  '.fieldnorm',
  '.idx',
  '.pos',
  '.posidx',
  '.store',
  '.term'
]

module.exports = class IndexCatalog extends EventEmitter {
  static segmentFiles (segmentId) {
    const basename = segmentId.replace(/-/g, '')
    return SEGMENT_FILES.map(f => basename + f)
  }

  constructor (pipe, opts) {
    super()
    this.pipe = pipe
    this.path = opts.path
    this.pipe.on('error', err => this.emit('error', err))
  }

  async open (name) {
    // Todo: check if index exists.
    return new Index(this, name)
  }

  async create (name, schema, opts = {}) {
    // Todo: check if index exists.
    if (await this.has(name)) {
      throw new Error(`Index ${name} already exists.`)
    }
    let method = 'create_index'
    if (opts.ram) method = 'create_ram_index'
    await this.pipe.request(method, { name, schema })
    return new Index(this, name)
  }
  async delete (name) {
    if (await this.has(name)) {
      let method = 'delete_index'
      return this.pipe.request(method, name)
    } else {
      throw new Error(`Index ${name} is not here.`)
    }
  }

  async openOrCreate (name, schema, opts) {
    if (await this.has(name)) {
      return this.open(name)
    } else {
      return this.create(name, schema, opts)
    }
  }

  async has (name) {
    return this.pipe.request('index_exists', name)
  }

  multiQuery (query, indexes) {
    return this.pipe.request('query_multi', { indexes, query })
  }

  readMeta (name) {
    return new Promise((resolve, reject) => {
      const path = p.join(this.path, name, 'meta.json')
      fs.readFile(path, (err, buf) => {
        if (err) return reject(err)
        try {
          const json = JSON.parse(buf.toString())
          resolve(json)
        } catch (err) { reject(err) }
      })
    })
  }

  close () {
    this.pipe.destroy()
  }
}

class Index {
  constructor (catalog, name) {
    this.catalog = catalog
    this.request = catalog.pipe.request.bind(catalog.pipe)
    this.name = name
  }

  async meta () {
    return this.catalog.readMeta(this.name)
  }

  async segmentInfo () {
    const meta = await this.meta()
    return meta.segments
  }

  get storage () {
    return p.join(this.catalog.path, this.name)
  }

  async query (query, opts = {}) {
    const { limit, snippetField } = opts
    return this.request('query', { index: this.name, query, limit, snippet_field: snippetField })
  }

  async queryJson (search, opts = {}) {
    const response = await this.request('query_json', { index: this.name, search })
    // TODO: Why is this needed??
    return JSON.parse(response)
  }

  async add (docs) {
    return this.addDocuments(docs)
  }

  async addDocuments (documents) {
    documents = transformDocs(documents)
    return this.request('add_documents', { index: this.name, documents })
  }

  async addSegments (segments) {
    return this.request('add_segments', { index: this.name, segments })
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
