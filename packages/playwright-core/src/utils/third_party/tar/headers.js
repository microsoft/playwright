const ZERO_OFFSET = '0'.charCodeAt(0)
const USTAR_MAGIC = Buffer.from([0x75, 0x73, 0x74, 0x61, 0x72, 0x00]) // ustar\x00
const GNU_MAGIC = Buffer.from([0x75, 0x73, 0x74, 0x61, 0x72, 0x20]) // ustar\x20
const GNU_VER = Buffer.from([0x20, 0x00])
const MAGIC_OFFSET = 257
const VERSION_OFFSET = 263

exports.decodeLongPath = function decodeLongPath (buf, encoding) {
  return decodeStr(buf, 0, buf.length, encoding)
}

exports.encodePax = function encodePax (opts) { // TODO: encode more stuff in pax
  let result = ''
  if (opts.name) result += addLength(' path=' + opts.name + '\n')
  if (opts.linkname) result += addLength(' linkpath=' + opts.linkname + '\n')
  const pax = opts.pax
  if (pax) {
    for (const key in pax) {
      result += addLength(' ' + key + '=' + pax[key] + '\n')
    }
  }
  return Buffer.from(result)
}

exports.decodePax = function decodePax (buf) {
  const result = {}

  while (buf.length) {
    let i = 0
    while (i < buf.length && buf[i] !== 32) i++
    const len = parseInt(buf.toString('ascii', 0, i), 10)
    if (!len) return result

    const b = buf.subarray('ascii', i + 1, len - 1)
    const keyIndex = b.indexOf('=')
    if (keyIndex === -1) return result
    result[b.slice(0, keyIndex)] = b.slice(keyIndex + 1)

    buf = buf.subarray(len)
  }

  return result
}

exports.decode = function decode (buf, filenameEncoding, allowUnknownFormat) {
  let typeflag = buf[156] === 0 ? 0 : buf[156] - ZERO_OFFSET

  let name = decodeStr(buf, 0, 100, filenameEncoding)
  const mode = decodeOct(buf, 100, 8)
  const uid = decodeOct(buf, 108, 8)
  const gid = decodeOct(buf, 116, 8)
  const size = decodeOct(buf, 124, 12)
  const mtime = decodeOct(buf, 136, 12)
  const type = toType(typeflag)
  const linkname = buf[157] === 0 ? null : decodeStr(buf, 157, 100, filenameEncoding)
  const uname = decodeStr(buf, 265, 32)
  const gname = decodeStr(buf, 297, 32)
  const devmajor = decodeOct(buf, 329, 8)
  const devminor = decodeOct(buf, 337, 8)

  const c = cksum(buf)

  // checksum is still initial value if header was null.
  if (c === 8 * 32) return null

  // valid checksum
  if (c !== decodeOct(buf, 148, 8)) throw new Error('Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?')

  if (isUSTAR(buf)) {
    // ustar (posix) format.
    // prepend prefix, if present.
    if (buf[345]) name = decodeStr(buf, 345, 155, filenameEncoding) + '/' + name
  } else if (isGNU(buf)) {
    // 'gnu'/'oldgnu' format. Similar to ustar, but has support for incremental and
    // multi-volume tarballs.
  } else {
    if (!allowUnknownFormat) {
      throw new Error('Invalid tar header: unknown format.')
    }
  }

  // to support old tar versions that use trailing / to indicate dirs
  if (typeflag === 0 && name && name[name.length - 1] === '/') typeflag = 5

  return {
    name,
    mode,
    uid,
    gid,
    size,
    mtime: new Date(1000 * mtime),
    type,
    linkname,
    uname,
    gname,
    devmajor,
    devminor,
    pax: null
  }
}

function isUSTAR (buf) {
  return USTAR_MAGIC.equals(buf.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6))
}

function isGNU (buf) {
  return GNU_MAGIC.equals(buf.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6)) &&
    GNU_VER.equals(buf.subarray(VERSION_OFFSET, VERSION_OFFSET + 2))
}

function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function toType (flag) {
  switch (flag) {
    case 0:
      return 'file'
    case 1:
      return 'link'
    case 2:
      return 'symlink'
    case 3:
      return 'character-device'
    case 4:
      return 'block-device'
    case 5:
      return 'directory'
    case 6:
      return 'fifo'
    case 7:
      return 'contiguous-file'
    case 72:
      return 'pax-header'
    case 55:
      return 'pax-global-header'
    case 27:
      return 'gnu-long-link-path'
    case 28:
    case 30:
      return 'gnu-long-path'
  }

  return null
}

function indexOf (block, num, offset, end) {
  for (; offset < end; offset++) {
    if (block[offset] === num) return offset
  }
  return end
}

function cksum (block) {
  let sum = 8 * 32
  for (let i = 0; i < 148; i++) sum += block[i]
  for (let j = 156; j < 512; j++) sum += block[j]
  return sum
}

/* Copied from the node-tar repo and modified to meet
 * tar-stream coding standard.
 *
 * Source: https://github.com/npm/node-tar/blob/51b6627a1f357d2eb433e7378e5f05e83b7aa6cd/lib/header.js#L349
 */
function parse256 (buf) {
  // first byte MUST be either 80 or FF
  // 80 for positive, FF for 2's comp
  let positive
  if (buf[0] === 0x80) positive = true
  else if (buf[0] === 0xFF) positive = false
  else return null

  // build up a base-256 tuple from the least sig to the highest
  const tuple = []
  let i
  for (i = buf.length - 1; i > 0; i--) {
    const byte = buf[i]
    if (positive) tuple.push(byte)
    else tuple.push(0xFF - byte)
  }

  let sum = 0
  const l = tuple.length
  for (i = 0; i < l; i++) {
    sum += tuple[i] * Math.pow(256, i)
  }

  return positive ? sum : -1 * sum
}

function decodeOct (val, offset, length) {
  val = val.subarray(offset, offset + length)
  offset = 0

  // If prefixed with 0x80 then parse as a base-256 integer
  if (val[offset] & 0x80) {
    return parse256(val)
  } else {
    // Older versions of tar can prefix with spaces
    while (offset < val.length && val[offset] === 32) offset++
    const end = clamp(indexOf(val, 32, offset, val.length), val.length, val.length)
    while (offset < end && val[offset] === 0) offset++
    if (end === offset) return 0
    return parseInt(val.toString('ascii', offset, end), 8)
  }
}

function decodeStr (val, offset, length, encoding) {
  return val.toString(encoding, offset, indexOf(val, 0, offset, offset + length))
}

function addLength (str) {
  const len = Buffer.byteLength(str)
  let digits = Math.floor(Math.log(len) / Math.log(10)) + 1
  if (len + digits >= Math.pow(10, digits)) digits++

  return (len + digits) + str
}
