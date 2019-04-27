const ndjson = require('ndjson')
const p = require('path')
const { spawn } = require('child_process')
const stream = require('stream')

main()

function parse (data) {
  try {
    const string = data.toString()
    console.log('RECIVE: ', string)
    const json = JSON.parse(string)
    return json
  } catch (e) {
    console.log('could not parse: ' + data)
    return null
  }
}

function main () {
  let bin = process.argv[2]
  const { send, receive } = rpc(bin)

  receive.on('data', (data) => {
    console.log('DATA', parse(data))
  })

  const index = 'test_index'
  // send(createIndex(index, schema()))
  // send(addDocuments(index, getDocs()))
  send(query(index, 'hello'))
  // send(addSegment(index, 'foo'))
}

function schema () {
  const schema = [
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
    },
    {
      name: 'tags',
      type: 'text',
      options: {
        indexing: null,
        stored: true
      }
    }
  ]
  return schema
}

function getDocs () {
  return [
    { id: '0', title: 'Hello, world!', body: 'hi there', tags: ['foo', 'bar'] },
    { id: '1', title: 'Hello, moon!', body: 'nothing to see', tags: ['boo', 'baz'] }
  ]
}

function createIndex (name, schema) {
  return {
    type: 'CreateIndex',
    payload: {
      name,
      schema
    }
  }
}

function addDocuments (index, documents) {
  documents = documents.map(doc => {
    let tuples = []
    for (let [field, value] of Object.entries(doc)) {
      if (Array.isArray(value)) {
        value.forEach(val => tuples.push([field, val]))
      } else {
        tuples.push([field, value])
      }
    }
    return tuples
  })

  return {
    type: 'AddDocuments',
    payload: {
      index,
      documents
    }
  }
}

function query (index, query) {
  return {
    type: 'Query',
    payload: {
      index,
      query
    }
  }
}

function addSegment (index, metaJson) {
  return {
    type: 'AddSegment',
    payload: {
      index,
      meta_json: metaJson
    }
  }
}

function rpc () {
  const sonar = spawn('cargo', ['run'])
  let counter = 0
  const sender = ndjson.serialize()
  // const receive = proc.stdout.pipe(ndjson.parse())
  const receive = sonar.stdout

  sonar.stdout.pipe(process.stdout)

  receive.on('error', (err) => {
    console.log('ERROR: ', err)
  })
  sender.pipe(sonar.stdin)

  return { send, receive }

  function send (message) {
    if (!message.id) message.id = String(++counter)
    sender.write(message)
  }
}
