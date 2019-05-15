const IndexCatalog = require('./catalog')
const fixtures = require('./fixtures')

run()

async function run () {
  const catalog = new IndexCatalog('./data')
  let i1 = await catalog.openOrCreate('foo', fixtures.schema)
  i1.addDocuments(fixtures.docs)
  let i2 = await catalog.openOrCreate('bar', fixtures.schema)
  console.log('query i1', await i1.query('hello'))
  console.log('query i2', await i2.query('hello'))
}
