const test = require('tape')
const { tempdir } = require('./lib/util')
const { getDocs, getSchema } = require('./lib/fixtures')

const Sonar = require('..')

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

test.only('basic indexing and query', async t => {
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
  t.end()
})
