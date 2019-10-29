# sonar-dat

Integrates the Sonar search index with [hyper-content-db](https://github.com/arso-project/hyper-content-db), a document database for [hyperdrives](https://github.com/mafintosh/hyperdrive).

## Example

```js
const { IslandManager } = require('sonar-dat')

const manager = new IslandManager('/tmp/database')

manager.create('my-db', (err, island) => {
  // Put json records.
  // See hyper-content-db docs for more
  island.put({ schema: 'testdoc', value: { title: 'Hello!' })

  // Query the index.
  island.api.search.query({ query: 'Hello!' })

  // Publish a database.
  manager.share(island.key)
})

```