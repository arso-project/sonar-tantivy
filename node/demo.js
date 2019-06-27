const IndexCatalog = require('./catalog')
const fixtures = require('./fixtures')
const util = require('util')

run()

async function run () {
  const catalog = new IndexCatalog('./data')
  let i1 = await catalog.openOrCreate('foo', fixtures.schema)
  await i1.addDocuments(fixtures.docs)
  let i2 = await catalog.openOrCreate('bar', fixtures.schema)
  await i2.addDocuments(fixtures.docs2)
  console.log('query i1', await i1.query('hello'))
  console.log('query i2', await i2.query('hello'))
  console.log('multiquery', util.inspect(await catalog.multiQuery('hello', [i1.name, i2.name]), { depth: null }))
}
