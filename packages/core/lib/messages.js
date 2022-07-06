// This file is auto generated by the protocol-buffers compiler

/* eslint-disable quotes */
/* eslint-disable indent */
/* eslint-disable no-redeclare */
/* eslint-disable camelcase */

// Remember to `npm install --save protocol-buffers-encodings`
var encodings = require('protocol-buffers-encodings')
var varint = encodings.varint
var skip = encodings.skip

var Header = exports.Header = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var Record = exports.Record = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var Changes = exports.Changes = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

defineHeader()
defineRecord()
defineChanges()

function defineHeader () {
  Header.encodingLength = encodingLength
  Header.encode = encode
  Header.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.type)) throw new Error("type is required")
    var len = encodings.string.encodingLength(obj.type)
    length += 1 + len
    if (defined(obj.metadata)) {
      var len = encodings.bytes.encodingLength(obj.metadata)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.type)) throw new Error("type is required")
    buf[offset++] = 10
    encodings.string.encode(obj.type, buf, offset)
    offset += encodings.string.encode.bytes
    if (defined(obj.metadata)) {
      buf[offset++] = 18
      encodings.bytes.encode(obj.metadata, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      type: "",
      metadata: null
    }
    var found0 = false
    while (true) {
      if (end <= offset) {
        if (!found0) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.type = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        obj.metadata = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineRecord () {
  Record.Op = {
    PUT: 0,
    DEL: 1
  }

  Record.encodingLength = encodingLength
  Record.encode = encode
  Record.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.id)) throw new Error("id is required")
    var len = encodings.string.encodingLength(obj.id)
    length += 1 + len
    if (defined(obj.op)) {
      var len = encodings.enum.encodingLength(obj.op)
      length += 1 + len
    }
    if (!defined(obj.type)) throw new Error("type is required")
    var len = encodings.string.encodingLength(obj.type)
    length += 1 + len
    if (defined(obj.value)) {
      var len = encodings.bytes.encodingLength(obj.value)
      length += 1 + len
    }
    if (defined(obj.timestamp)) {
      var len = encodings.varint.encodingLength(obj.timestamp)
      length += 1 + len
    }
    if (defined(obj.links)) {
      for (var i = 0; i < obj.links.length; i++) {
        if (!defined(obj.links[i])) continue
        var len = encodings.string.encodingLength(obj.links[i])
        length += 1 + len
      }
    }
    if (defined(obj.typeVersion)) {
      var len = encodings.string.encodingLength(obj.typeVersion)
      length += 1 + len
    }
    if (defined(obj.deleted)) {
      var len = encodings.bool.encodingLength(obj.deleted)
      length += 1 + len
    }
    if (defined(obj.changes)) {
      var len = Changes.encodingLength(obj.changes)
      length += varint.encodingLength(len)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.id)) throw new Error("id is required")
    buf[offset++] = 10
    encodings.string.encode(obj.id, buf, offset)
    offset += encodings.string.encode.bytes
    if (defined(obj.op)) {
      buf[offset++] = 16
      encodings.enum.encode(obj.op, buf, offset)
      offset += encodings.enum.encode.bytes
    }
    if (!defined(obj.type)) throw new Error("type is required")
    buf[offset++] = 26
    encodings.string.encode(obj.type, buf, offset)
    offset += encodings.string.encode.bytes
    if (defined(obj.value)) {
      buf[offset++] = 34
      encodings.bytes.encode(obj.value, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    if (defined(obj.timestamp)) {
      buf[offset++] = 40
      encodings.varint.encode(obj.timestamp, buf, offset)
      offset += encodings.varint.encode.bytes
    }
    if (defined(obj.links)) {
      for (var i = 0; i < obj.links.length; i++) {
        if (!defined(obj.links[i])) continue
        buf[offset++] = 50
        encodings.string.encode(obj.links[i], buf, offset)
        offset += encodings.string.encode.bytes
      }
    }
    if (defined(obj.typeVersion)) {
      buf[offset++] = 58
      encodings.string.encode(obj.typeVersion, buf, offset)
      offset += encodings.string.encode.bytes
    }
    if (defined(obj.deleted)) {
      buf[offset++] = 64
      encodings.bool.encode(obj.deleted, buf, offset)
      offset += encodings.bool.encode.bytes
    }
    if (defined(obj.changes)) {
      buf[offset++] = 74
      varint.encode(Changes.encodingLength(obj.changes), buf, offset)
      offset += varint.encode.bytes
      Changes.encode(obj.changes, buf, offset)
      offset += Changes.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      id: "",
      op: 0,
      type: "",
      value: null,
      timestamp: 0,
      links: [],
      typeVersion: "",
      deleted: false,
      changes: null
    }
    var found0 = false
    var found2 = false
    while (true) {
      if (end <= offset) {
        if (!found0 || !found2) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.id = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        obj.op = encodings.enum.decode(buf, offset)
        offset += encodings.enum.decode.bytes
        break
        case 3:
        obj.type = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found2 = true
        break
        case 4:
        obj.value = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        case 5:
        obj.timestamp = encodings.varint.decode(buf, offset)
        offset += encodings.varint.decode.bytes
        break
        case 6:
        obj.links.push(encodings.string.decode(buf, offset))
        offset += encodings.string.decode.bytes
        break
        case 7:
        obj.typeVersion = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        break
        case 8:
        obj.deleted = encodings.bool.decode(buf, offset)
        offset += encodings.bool.decode.bytes
        break
        case 9:
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.changes = Changes.decode(buf, offset, offset + len)
        offset += Changes.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineChanges () {
  Changes.encodingLength = encodingLength
  Changes.encode = encode
  Changes.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.format)) throw new Error("format is required")
    var len = encodings.string.encodingLength(obj.format)
    length += 1 + len
    if (!defined(obj.payload)) throw new Error("payload is required")
    var len = encodings.bytes.encodingLength(obj.payload)
    length += 1 + len
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.format)) throw new Error("format is required")
    buf[offset++] = 10
    encodings.string.encode(obj.format, buf, offset)
    offset += encodings.string.encode.bytes
    if (!defined(obj.payload)) throw new Error("payload is required")
    buf[offset++] = 18
    encodings.bytes.encode(obj.payload, buf, offset)
    offset += encodings.bytes.encode.bytes
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      format: "",
      payload: null
    }
    var found0 = false
    var found1 = false
    while (true) {
      if (end <= offset) {
        if (!found0 || !found1) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.format = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        obj.payload = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        found1 = true
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defined (val) {
  return val !== null && val !== undefined && (typeof val !== 'number' || !isNaN(val))
}