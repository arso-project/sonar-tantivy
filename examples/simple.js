const IndexCatalog = require('..')
const fixtures = require('./_fixtures')
const util = require('util')
const { tempdir } = require('../test/lib/util')

example().catch(err => console.error('Error', err))

async function example () {
  const [dir, cleanup] = await tempdir()
  const catalog = new IndexCatalog(dir)
  catalog.on('error', err => {
    throw err
  })
  const opts = { ram: true }
  let i1 = await catalog.openOrCreate('foo', fixtures.schema, opts)
  await i1.addDocuments(fixtures.docs)
  let i2 = await catalog.openOrCreate('bar', fixtures.schema, opts)
  await i2.addDocuments(fixtures.docs2)

  console.log('query i1', await i1.query('hello'))
  console.log('query i2', await i2.query('hello'))
  console.log('multiquery', util.inspect(await catalog.multiQuery('hello', [i1.name, i2.name]), { depth: null }))

  await cleanup()
  await catalog.close()
  console.log('done')
}
