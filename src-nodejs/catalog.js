const p = require('path')
const { EventEmitter } = require('events')

module.exports = class IndexCatalog extends EventEmitter {
  constructor (pipe, opts) {
    super()
    this.pipe = pipe
    this.pipe.on('error', err => this.emit('error', err))
  }

  async open (name) {
    // Todo: check if index exists.
    return new Index(this.pipe, name)
  }

  async create (name, schema, opts = {}) {
    // Todo: check if index exists.
    if (await this.has(name)) {
      throw new Error(`Index ${name} already exists.`)
    }
    let method = 'create_index'
    if (opts.ram) method = 'create_ram_index'
    await this.pipe.request(method, { name, schema })
    return new Index(this.pipe, name, schema)
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

  close () {
    this.pipe.destroy()
  }
}

class Index {
  constructor (pipe, name) {
    this.pipe = pipe
    this.name = name
  }

  async query (query, opts = {}) {
    const { limit, snippetField } = opts
    return this.pipe.request('query', { index: this.name, query, limit, snippet_field: snippetField })
  }

  async add (docs) {
    return this.addDocuments(docs)
  }

  async addDocuments (documents) {
    documents = transformDocs(documents)
    return this.pipe.request('add_documents', { index: this.name, documents })
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
