const tarExtract = require('./extract')
const fs = require('fs')
const path = require('path')
const { pipeline } = require('stream/promises')

const win32 = process.platform === 'win32'


function head (list) {
  return list.length ? list[list.length - 1] : null
}

function processGetuid () {
  return process.getuid ? process.getuid() : -1
}

function processUmask () {
  return process.umask ? process.umask() : 0
}

exports.extract = function extract (cwd, opts) {
  if (!cwd) cwd = '.'
  if (!opts) opts = {}

  const xfs = opts.fs || fs
  const ignore = opts.ignore || opts.filter || noop
  const mapStream = opts.mapStream || echo
  const own = opts.chown !== false && !win32 && processGetuid() === 0
  const extract = opts.extract || tarExtract()
  const stack = []
  const now = new Date()
  const umask = typeof opts.umask === 'number' ? ~opts.umask : ~processUmask()
  const strict = opts.strict !== false

  let map = opts.map || noop
  let dmode = typeof opts.dmode === 'number' ? opts.dmode : 0
  let fmode = typeof opts.fmode === 'number' ? opts.fmode : 0

  if (opts.strip) map = strip(map, opts.strip)

  if (opts.readable) {
    dmode |= parseInt(555, 8)
    fmode |= parseInt(444, 8)
  }
  if (opts.writable) {
    dmode |= parseInt(333, 8)
    fmode |= parseInt(222, 8)
  }

  extract.on('entry', onentry)

  if (opts.finish) extract.on('finish', opts.finish)

  return extract

  function onentry (header, stream, next) {
    header = map(header) || header
    header.name = normalize(header.name)

    const name = path.join(cwd, path.join('/', header.name))

    if (ignore(name, header)) {
      stream.resume()
      return next()
    }

    if (header.type === 'directory') {
      stack.push([name, header.mtime])
      return mkdirfix(name, {
        fs: xfs,
        own,
        uid: header.uid,
        gid: header.gid,
        mode: header.mode
      }, stat)
    }

    const dir = path.dirname(name)

    validate(xfs, dir, path.join(cwd, '.'), function (err, valid) {
      if (err) return next(err)
      if (!valid) return next(new Error(dir + ' is not a valid path'))

      mkdirfix(dir, {
        fs: xfs,
        own,
        uid: header.uid,
        gid: header.gid,
        // normally, the folders with rights and owner should be part of the TAR file
        // if this is not the case, create folder for same user as file and with
        // standard permissions of 0o755 (rwxr-xr-x)
        mode: 0o755
      }, function (err) {
        if (err) return next(err)

        switch (header.type) {
          case 'file': return onfile()
          case 'link': return onlink()
          case 'symlink': return onsymlink()
        }

        if (strict) return next(new Error('unsupported type for ' + name + ' (' + header.type + ')'))

        stream.resume()
        next()
      })
    })

    function stat (err) {
      if (err) return next(err)
      utimes(name, header, function (err) {
        if (err) return next(err)
        if (win32) return next()
        chperm(name, header, next)
      })
    }

    function onsymlink () {
      if (win32) return next() // skip symlinks on win for now before it can be tested
      xfs.unlink(name, function () {
        xfs.symlink(header.linkname, name, stat)
      })
    }

    function onlink () {
      if (win32) return next() // skip links on win for now before it can be tested
      xfs.unlink(name, function () {
        const srcpath = path.join(cwd, path.join('/', header.linkname))

        xfs.link(srcpath, name, function (err) {
          if (err && err.code === 'EPERM' && opts.hardlinkAsFilesFallback) {
            stream = xfs.createReadStream(srcpath)
            return onfile()
          }

          stat(err)
        })
      })
    }

    function onfile () {
      const ws = xfs.createWriteStream(name)
      const rs = mapStream(stream, header)

      ws.on('error', function (err) { // always forward errors on destroy
        rs.destroy(err)
      })

      pipeline(rs, ws).then(stat).catch(next);
    }
  }

  function utimesParent (name, cb) { // we just set the mtime on the parent dir again everytime we write an entry
    let top
    while ((top = head(stack)) && name.slice(0, top[0].length) !== top[0]) stack.pop()
    if (!top) return cb()
    xfs.utimes(top[0], now, top[1], cb)
  }

  function utimes (name, header, cb) {
    if (opts.utimes === false) return cb()

    if (header.type === 'directory') return xfs.utimes(name, now, header.mtime, cb)
    if (header.type === 'symlink') return utimesParent(name, cb) // TODO: how to set mtime on link?

    xfs.utimes(name, now, header.mtime, function (err) {
      if (err) return cb(err)
      utimesParent(name, cb)
    })
  }

  function chperm (name, header, cb) {
    const link = header.type === 'symlink'

    /* eslint-disable n/no-deprecated-api */
    const chmod = link ? xfs.lchmod : xfs.chmod
    const chown = link ? xfs.lchown : xfs.chown
    /* eslint-enable n/no-deprecated-api */

    if (!chmod) return cb()

    const mode = (header.mode | (header.type === 'directory' ? dmode : fmode)) & umask

    if (chown && own) chown.call(xfs, name, header.uid, header.gid, onchown)
    else onchown(null)

    function onchown (err) {
      if (err) return cb(err)
      if (!chmod) return cb()
      chmod.call(xfs, name, mode, cb)
    }
  }

  function mkdirfix (name, opts, cb) {
    // when mkdir is called on an existing directory, the permissions
    // will be overwritten (?), to avoid this we check for its existance first
    xfs.stat(name, function (err) {
      if (!err) return cb(null)
      if (err.code !== 'ENOENT') return cb(err)
      xfs.mkdir(name, { mode: opts.mode, recursive: true }, function (err, made) {
        if (err) return cb(err)
        chperm(name, opts, cb)
      })
    })
  }
}

function validate (fs, name, root, cb) {
  if (name === root) return cb(null, true)
  fs.lstat(name, function (err, st) {
    if (err && err.code === 'ENOENT') return validate(fs, path.join(name, '..'), root, cb)
    else if (err) return cb(err)
    cb(null, st.isDirectory())
  })
}

function noop () {}

function echo (name) {
  return name
}

function normalize (name) {
  return win32 ? name.replace(/\\/g, '/').replace(/[:?<>|]/g, '_') : name
}

function strip (map, level) {
  return function (header) {
    header.name = header.name.split('/').slice(level).join('/')

    const linkname = header.linkname
    if (linkname && (header.type === 'link' || path.isAbsolute(linkname))) {
      header.linkname = linkname.split('/').slice(level).join('/')
    }

    return map(header)
  }
}
