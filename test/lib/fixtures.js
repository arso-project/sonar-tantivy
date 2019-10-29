exports.getDocs = function () {
  return [
    { id: 'first1', title: 'Hello world!', body: 'hi first tell me more' },
    { id: 'first2', title: 'Ola mundo!', body: 'hi first que pasa pues' }
  ]
}

exports.getDocs2 = function () {
  return [
    { id: 'second1', textdump: 'second1 Bonjour monde! hi second tres bien', title: 'Bonjour monde!', body: 'hi second tres bien' },
    { id: 'second2', textdump: 'ALERT', title: 'Ciao mondo!', body: 'hi second buon giorno' }
  ]
}

exports.getSchema = function () {
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
exports.getSchema2 = function () {
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
      type: 'i64',
      options: {
        indexed: true,
        stored: true
      }
    },
    {
      name: 'textdump',
      type: 'text',
      options: {
        indexing: {
          record: 'position',
          tokenizer: 'en_stem'
        },
        stored: false
      }
    }
  ]
}
