# sonar (WIP)

A tantivy frontend through node.js

You need a rust toolchain to install sonar, it should build upon running `npm install @archipel/sonar`.

TODO: Add CI builds and download binaries from github instead of building on install.

```js
  const Sonar = require('@archipel/sonar')

  const catalog = new Sonar('./data')
  const index = await catalog.openOrCreate('foo', fixtures.schema)
  await i1.addDocuments(fixtures.docs)
  await i2.addDocuments(fixtures.docs2)
  console.log('query results', await index.query('hello'))
```

