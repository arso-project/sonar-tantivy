const test = require('tape')
const { tempdir } = require('./lib/util')

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
  t.equal(first.doc.id[0], '1')
  t.equal(first.snippet, null)
  console.log(results[0])

  results = await index.query('more', { snippetField: 'body' })
  t.equal(results.length, 1)
  first = results[0]
  t.equal(first.doc.id[0], '0')
  t.equal(first.snippet, 'tell me <b>more</b>')
  console.log(results[0])

  await catalog.close()
  await cleanup()
  t.end()

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
      }
    ]
  }
})
