# sonar 

A [tantivy](https://github.com/tantivy-search/tantivy) based search engine for Node.js

## Example

```js
const Sonar = require('@archipel/sonar')

(async function () {
  const catalog = new Sonar('./data')
  const schema = getSchema()
  const index = await catalog.openOrCreate('index-name', schema)
  const docs = getDocs()
  await index.add(docs)
  const results = await index.query('world')
  console.log('query results', results)
})()

function getDocs () {
  return [
    { id: '0', title: 'Hello world!', body: 'tell me more' },
    { id: '1', title: 'Ola mundo!', body: 'que pasa pues' }
  ]
}

function getSchema () {
  return [
    {
      name: 'title',
      type: 'text',
      options: {
        indexing: { record: 'position', tokenizer: 'en_stem' },
        stored: true
      }
    },
    {
      name: 'body',
      type: 'text',
      options: {
        indexing: { record: 'position', tokenizer: 'en_stem' },
        stored: true
      }
    },
    {
      name: 'id',
      type: 'text',
      options: { indexing: null, stored: true }
    },
  ]
}
```

## Installation

#### `npm install @archipel/sonar`

A `postinstall` script automatically tries to download a precompiled binary for the rust/tantivy part. If unsuccessfull the script will try to compile it if a rust toolchain is present.

## API

#### `const catalog = new Sonar(storage)`

`storage` is a file system path where the index will be stored.

#### `const index = await catalog.openOrCreate(indexName, schema)`

`indexName` is a string to identifiy the index. It should only contain characters valid in file system paths.
`schema` is the index schema, expressed as a JSON-serializable object following the [tantivy](https://github.com/tantivy-search/tantivy) schema definition. Documentation is not centralized atm, see example above.

#### `const index = await catalog.create(indexName, schema, opts)`

Create an index. Will throw if an index by this `indexName` exists already. 
`opts` are:

* `ram`: If true create an in-memory index

#### `await index.add(docs)`

`docs` is an array of documents with the same structure as the index schema.

#### `const results = await index.query(query, [limit], [snippetField])`

Query the index. At the moment only string queries are supported, see tantivy docs for details on the supported grammar. `limit` is the max number of documents to return (default 10). `snippetField` is the name of a field for which to return a result snippet with keywords highlighted (as HTML, with `<b>` tags)

#### `const results = await catalog.multiQuery(query, indexes)`

Query all indexes in the catalog. `indexes` is an array of index names.

*To be expanded*

## Implementation details

The rust part is a wrapper around tantivy. It compiles to a binary. The binary is invoked with a storage path as only argument. It listens for newline-delimited JSON messages on STDIN, and replies in the same format.

The node part spawns the rust binary and communicates over the STDIO pipe. It adds a higher-level API around this simple RPC mechanism.

A npm `postinstall` step will try to download a precompiled binary of the rust part from Github releases. The binaries are compiled and deployed via Travis. If it cannot find a matching binary, it will try to compile if a rust toolchain is available. If the environment variable `RUST_ENV=development` is present, `cargo run` (without `--release`) will be invoked instead.
