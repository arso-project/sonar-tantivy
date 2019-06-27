const IndexCatalog = require('./catalog')
const fixtures = require('./fixtures')

run()

async function run () {
  const catalog = new IndexCatalog('./data')
  const catalog2 = new IndexCatalog('./data2')
  // let i1 = await catalog.openOrCreate('foo', fixtures.schema)
  let i1 = await catalog.create(fixtures.schema)
  await i1.replicator.ready()
  console.log('! i1 create', i1.replicator.drive.key.toString())
  console.log('! i1 create', i1.key)
  await i1.addDocuments(fixtures.docs)
  console.log('! i1 addDocs')
  // let i2 = await catalog.openOrCreate('bar', fixtures.schema)
  // let i2 = await catalog2.create(fixtures.schema)
  // i2.addDocuments(fixtures.docs2)
  let i2 = await catalog2.add(i1.key)
  console.log('! i2 add')
  console.log('query i1', logResults(await i1.query('hello')))
  console.log('query i2', logResults(await i2.query('hello')))
}

function logResults (res) {
  console.log('RES', res)
  return res.results.map(r => r.doc)
}
