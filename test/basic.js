const test = require('tape')
const { tempdir } = require('./lib/util')
const { getDocs, getDocs2, getSchema, getSchema2 } = require('./lib/fixtures')

const Sonar = require('..')

test('create and delete index', async t => {
  try {
    const [dir, cleanup] = await tempdir()
    const catalog = new Sonar(dir)
    const schema = getSchema()
    const index1 = await catalog.openOrCreate('index1', schema)
    const index2 = await catalog.openOrCreate('index2', schema)
    const docs = getDocs()
    const docs2 = getDocs2()
    await index1.add(docs)
    await index2.add(docs2)
    t.equal(await catalog.has('index1'), true)
    t.equal(await catalog.has('index2'), true)
    await catalog.delete('index1')
    t.equal(await catalog.has('index1'), false)
    t.equal(await catalog.has('index2'), true)
    await catalog.delete('index2')
    t.equal(await catalog.has('index2'), false)
    await catalog.close()
    await cleanup()
    t.end()
  } catch (err) {
    t.error(err)
  }
})

test('basic indexing and query', async t => {
  const [dir, cleanup] = await tempdir()
  const catalog = new Sonar(dir)
  const schema = getSchema()
  const index = await catalog.openOrCreate('index-name', schema)
  const docs = getDocs()
  await index.add(docs)

  let results = await index.query('mundo')
  t.equal(results.length, 1)
  let first = results[0]
  t.equal(first.doc.id[0], 'first2')
  t.equal(first.snippet, null)
  // console.log(results[0])

  results = await index.query('more', { snippetField: 'body' })
  t.equal(results.length, 1)
  first = results[0]
  t.equal(first.doc.id[0], 'first1')
  t.equal(first.snippet, 'hi first tell me <b>more</b>')
  // console.log(results[0])
  // console.log(await index.meta())

  await catalog.close()
  await cleanup()
  console.log('HERE')
  t.end()
})

test('basic indexing and query', async t => {
  const [dir, cleanup] = await tempdir()
  const catalog = new Sonar(dir)
  const schema = getSchema()
  const index = await catalog.openOrCreate('index-name', schema)
  const docs = getDocs()
  await index.add(docs)
  const query = {
    query: {
      bool: {
        must: [{ term: { body: 'hi' } }],
        must_not: [{ term: { title: 'world' } }]
      }
    }
  }
  console.log('QUERY', query.query)
  let results = await index.queryJson(query)
  console.log('RESULTS 1', typeof results, results)
  t.equal(results.docs.length, 1, 'one result')
  query.query.bool.must_not[0].term.title = 'foo'
  console.log('QUERY', query.query)
  results = await index.queryJson(query)
  console.log('RESULTS 2', results)
  t.equal(results.docs.length, 2, 'two result')
  catalog.close()
  await cleanup()
  t.end()
})

test('create index and update schema', async t => {
  console.log("HELLO")
  const [dir, cleanup] = await tempdir()
  const catalog = new Sonar(dir)
  const schema = getSchema()
  const schema2 = getSchema2()
  const index = await catalog.openOrCreate('index', schema)
  console.log("SCHEMA: ",await index.getSchema())
  t.equal(await index.getSchema(), schema)
  catalog.update('index', schema2)
  t.equal(await Json.parse(index.getSchema()), schema2)
  catalog.close()
  t.end()
})
