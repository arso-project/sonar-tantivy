const test = require('tape')
const { tempdir, copyFiles } = require('./lib/util')
const { getSchema, getDocs, getDocs2 } = require('./lib/fixtures')

const Sonar = require('..')

test('basic indexing and query', async t => {
  const [dir, cleanup] = await tempdir()
  const catalog = new Sonar(dir)
  const schema = getSchema()

  const index1 = await catalog.openOrCreate('first', schema)
  const index2 = await catalog.openOrCreate('second', schema)

  await index1.add(getDocs())
  await index2.add(getDocs2())

  const res1 = await index1.query('hi')
  const res2 = await index2.query('hi')

  t.equal(res1.length, 2)
  t.equal(res2.length, 2)

  t.deepEqual(toIds(res1), ['first1', 'first2'])
  t.deepEqual(toIds(res2), ['second1', 'second2'])

  const segments = await index1.segmentInfo()

  const segmentFiles = segments
    .map(s => s.segment_id)
    .map(id => Sonar.segmentFiles(id))
    .reduce((acc, arr) => [...acc, ...arr], [])

  await copyFiles(index1.storage, index2.storage, segmentFiles)

  await index2.addSegments(await index1.segmentInfo())

  const resFinal = await index2.query('hi')
  t.equal(resFinal.length, 4, '4 results!')
  t.deepEqual(toIds(resFinal), ['first1', 'first2', 'second1', 'second2'])

  await cleanup()
  await catalog.close()
  t.end()
})

function toIds (res) {
  return res.map(r => r.doc.id[0]).sort()
}
