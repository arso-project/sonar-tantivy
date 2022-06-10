import type { Collection, FileBody } from '..'
import tape from 'tape'
import { createOne, createMany } from './lib/create.js'
tape('simple files test', async (t) => {
  const { cleanup, client } = await createOne()
  const col = await client.createCollection('first')
  await col.files.createFile('foo')
  await col.files.createFile('bar')
  const res = await readFiles(col)
  t.deepEqual(res.sort(), ['bar', 'foo'])
  await cleanup()
})
tape('error on empty file write', async (t) => {
  const { cleanup, client } = await createOne()
  const col = await client.createCollection('first')
  try {
    await col.files.createFile(new Uint8Array(), { requestType: 'buffer' })
    t.fail('Expected error to be thrown for empty file write')
  } catch (err) {
    t.equal((err as Error).message, 'Remote error (code 500): Stream was empty')
  }
  await cleanup()
})
tape('minimal file replication', async (t) => {
  const { cleanup, clients } = await createMany(2)
  const [client1, client2] = clients
  const collection1 = await client1.createCollection('first')
  const record1 = await collection1.files.createFile('hi', { filename: 'test.txt' })
  const collection2 = await client2.createCollection(collection1.key as string)
  const content = await collection2.files.readFile(record1.id, { responseType: 'buffer' })
  t.equal('hi', content.toString('utf8'))
  await cleanup()
})
tape('replicate files', { timeout: 5000 }, async (t) => {
  const { cleanup, clients } = await createMany(2)
  const [client1, client2] = clients
  const collection1 = await client1.createCollection('first')
  const collection2 = await client2.createCollection('second', {
    key: collection1.key as string,
    alias: 'second'
  })
  t.equal(collection1.info!.key, collection1.info!.localKey)
  t.equal(collection2.info!.key, collection1.info!.key)
  t.notEqual(collection2.info!.key, collection2.info!.localKey)
  await writeFile(collection1, 'one', 'onfirst')
  // TODO: This refetches the schema. We should automate this.
  await collection2.updateInfo()
  await writeFile(collection2, 'two', 'onsecond')
  // t.equal(file1.key, collection1.info.localKey, 'key of file1 ok')
  // t.equal(file2.key, collection2.info.localKey, 'key of resourc2 ok')
  // await timeout(500)
  let contents1 = await readFiles(collection1)
  t.deepEqual(contents1.sort(), ['onfirst'], 'collection 1 ok')
  let contents2 = await readFiles(collection2)
  t.deepEqual(contents2.sort(), ['onfirst', 'onsecond'], 'collection 2 ok')
  await collection1.addFeed(collection2.info!.localKey, { alias: 'seconda' })
  await collection1.sync()
  try {
    contents1 = await readFiles(collection1)
    t.deepEqual(contents1.sort(), ['onfirst', 'onsecond'], 'collection 1 ok')
    contents2 = await readFiles(collection2)
    t.deepEqual(contents2.sort(), ['onfirst', 'onsecond'], 'collection 2 ok')
  } catch (err) { }
  await collection1.fetch('/debug')
  await collection2.fetch('/debug')
  await cleanup()
})
async function readFiles (collection: Collection) {
  const records = await collection.query('records', { type: 'sonar/file' }, { sync: true })
  const contents = await Promise.all(records.map(record => {
    return collection.files
      .readFile(record.id, { responseType: 'buffer' })
      .then(c => c.toString())
  }))
  return contents
}
async function writeFile (collection: Collection, filename: string, content: FileBody) {
  await collection.files.createFile(content, { filename })
}
async function timeout (ms: number) {
  return await new Promise(resolve => setTimeout(resolve, ms))
}
