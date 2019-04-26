const message = {
  type: 'CreateIndex',
  id: '0',
  payload: {
    name: 'testindex',
    schema: 'foo'
  }
}

function send (message) {
  const json = JSON.stringify(message)
  console.log(json)
}

send(message)

// let i = 0
// setInterval(() => {
//   i++
//   console.log('msg' + i)
// }, 500)
