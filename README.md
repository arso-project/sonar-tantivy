# sonar (WIP)

A tantivy frontend through node.js

You need a rust toolchain to install sonar, it should build upon running `npm install @archipel/sonar`.

TODO: Add CI builds and download binaries from github instead of building on install.

```js
const Sonar = require('@archipel/sonar')

example()

async function example () {
  const catalog = new Sonar('./data')
  const index = await catalog.openOrCreate('indexname', getSchema())
  await i1.addDocuments(getDocs())
  console.log('query results', await index.query('world'))
}

function getDocs () {
  return [
    { id: '0', title: 'Hello, world!', body: 'hi there', tags: ['foo', 'bar'] },
    { id: '1', title: 'Hello, moon!', body: 'nothing to see', tags: ['boo', 'baz'] }
  ]
}

function getSchema () {
  return [
    {
      name: 'title',
      type: 'text',
      options: {
        indexing: {
          record: 'position',
          tokenizer: 'en_stem'
        },
        stored: true
      }
    },
    {
      name: 'body',
      type: 'text',
      options: {
        indexing: {
          record: 'position',
          tokenizer: 'en_stem'
        },
        stored: true
      }
    },
    {
      name: 'id',
      type: 'text',
      options: {
        indexing: null,
        stored: true
      }
    },
    {
      name: 'tags',
      type: 'text',
      options: {
        indexing: null,
        stored: true
      }
    }
  ]
}
```

