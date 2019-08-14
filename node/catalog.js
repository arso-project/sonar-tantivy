const Pipe = require('./rpc')
const p = require('path')
// const hyperdrive = require('hyperdrive')
// const crypto = require('hypercore-crypto')

const cargoToml = p.resolve(p.join(__dirname, '../Cargo.toml'))

module.exports = class IndexCatalog {
  constructor (path, opts) {
    this.path = p.resolve(path)
    this.pipe = new Pipe(`cargo run --manifest-path=${cargoToml} -- ${this.path}`)
  }

  async open (name) {
    // Todo: check if index exists.
    return new Index(this.pipe, name)
  }

  async create (name, schema) {
    // Todo: check if index exists.
    await this.pipe.request('create_index', { name, schema })
    return new Index(this.pipe, name, schema)
  }

  async openOrCreate (name, schema) {
    if (await this.has(name)) {
      return this.open(name)
    } else {
      return this.create(name, schema)
    }
  }

  async has (name) {
    return this.pipe.request('index_exists', name)
  }

  multiQuery (query, indexes) {
    return this.pipe.request('query_multi', { indexes, query })
  }
}

class Index {
  constructor (pipe, name) {
    this.pipe = pipe
    this.name = name
  }

  async query (query) {
    return this.pipe.request('query', { index: this.name, query })
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
