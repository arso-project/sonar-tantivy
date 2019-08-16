const docs = [
  { id: '0', title: 'Hello, world!', body: 'hi there' },
  { id: '1', title: 'Hello, moon!', body: 'nothing to see' }
]

const docs2 = [
  { id: '0', title: 'Hello, mars', body: 'hot hot hot' },
  { id: '1', title: 'Hello, jupiter!', body: 'cold cold cold' }
]

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
  }
]

module.exports = { docs, docs2, schema }
