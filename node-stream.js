main()

function main() {
  const send = rpc()
  const index = 'test_index'
  send(createIndex(index, schema()))
  send(addDocuments(index, getDocs()))
  send(query(index, 'hello'))
  send(addSegment(index, 'foo'))
}

function schema() {
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

function getDocs() {
  return [
    { id: '0', title: 'Hello, world!', body: 'hi there', tags: ['foo', 'bar'] },
    { id: '1', title: 'Hello, moon!', body: 'nothing to see', tags: ['boo', 'baz'] }
  ]
}

function createIndex(name, schema) {
  return {
    type: 'CreateIndex',
    payload: {
      name,
      schema
    }
  }
}

function addDocuments(index, documents) {
  return {
    type: 'AddDocuments',
    payload: {
      index,
      documents
    }
  }
}

function query(index, query) {
  return {
    type: 'Query',
    payload: {
      index,
      query
    }
  }
}

function addSegment(index, metaJson) {
  return {
    type: 'AddSegment',
    payload: {
      index,
      meta_json: metaJson
    }
  }
}

function rpc() {
  let counter = 0
  function send(message) {
    if (!message.id) message.id = String(++counter)
    const json = JSON.stringify(message)
    console.log(json)
  }
  return send
}



// let i = 0
// setInterval(() => {
//   i++
//   console.log('msg' + i)
// }, 500)
