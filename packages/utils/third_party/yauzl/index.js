// Vendored from https://github.com/thejoshwolfe/yauzl at v3.2.1 under the MIT License.
// See LICENSE for the full text.
//
// Local modifications:
//  - require('./fd-slicer'): unchanged path; fd-slicer.js carries the fix from
//    https://github.com/thejoshwolfe/yauzl/pull/168.
//  - require('buffer-crc32'): rewritten to ./buffer-crc32 (inlined sibling).

var fs = require("fs");
var zlib = require("zlib");
var fd_slicer = require("./fd-slicer");
var crc32 = require("./buffer-crc32");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var Transform = require("stream").Transform;
var PassThrough = require("stream").PassThrough;
var Writable = require("stream").Writable;

exports.open = open;
exports.fromFd = fromFd;
exports.fromBuffer = fromBuffer;
exports.fromRandomAccessReader = fromRandomAccessReader;
exports.dosDateTimeToDate = dosDateTimeToDate;
exports.getFileNameLowLevel = getFileNameLowLevel;
exports.validateFileName = validateFileName;
exports.parseExtraFields = parseExtraFields;
exports.ZipFile = ZipFile;
exports.Entry = Entry;
exports.LocalFileHeader = LocalFileHeader;
exports.RandomAccessReader = RandomAccessReader;

function open(path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = null;
  }
  if (options == null) options = {};
  if (options.autoClose == null) options.autoClose = true;
  if (options.lazyEntries == null) options.lazyEntries = false;
  if (options.decodeStrings == null) options.decodeStrings = true;
  if (options.validateEntrySizes == null) options.validateEntrySizes = true;
  if (options.strictFileNames == null) options.strictFileNames = false;
  if (callback == null) callback = defaultCallback;
  fs.open(path, "r", function(err, fd) {
    if (err) return callback(err);
    fromFd(fd, options, function(err, zipfile) {
      if (err) fs.close(fd, defaultCallback);
      callback(err, zipfile);
    });
  });
}

function fromFd(fd, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = null;
  }
  if (options == null) options = {};
  if (options.autoClose == null) options.autoClose = false;
  if (options.lazyEntries == null) options.lazyEntries = false;
  if (options.decodeStrings == null) options.decodeStrings = true;
  if (options.validateEntrySizes == null) options.validateEntrySizes = true;
  if (options.strictFileNames == null) options.strictFileNames = false;
  if (callback == null) callback = defaultCallback;
  fs.fstat(fd, function(err, stats) {
    if (err) return callback(err);
    var reader = fd_slicer.createFromFd(fd, {autoClose: true});
    fromRandomAccessReader(reader, stats.size, options, callback);
  });
}

function fromBuffer(buffer, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = null;
  }
  if (options == null) options = {};
  options.autoClose = false;
  if (options.lazyEntries == null) options.lazyEntries = false;
  if (options.decodeStrings == null) options.decodeStrings = true;
  if (options.validateEntrySizes == null) options.validateEntrySizes = true;
  if (options.strictFileNames == null) options.strictFileNames = false;
  // limit the max chunk size. see https://github.com/thejoshwolfe/yauzl/issues/87
  var reader = fd_slicer.createFromBuffer(buffer, {maxChunkSize: 0x10000});
  fromRandomAccessReader(reader, buffer.length, options, callback);
}

function fromRandomAccessReader(reader, totalSize, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = null;
  }
  if (options == null) options = {};
  if (options.autoClose == null) options.autoClose = true;
  if (options.lazyEntries == null) options.lazyEntries = false;
  if (options.decodeStrings == null) options.decodeStrings = true;
  var decodeStrings = !!options.decodeStrings;
  if (options.validateEntrySizes == null) options.validateEntrySizes = true;
  if (options.strictFileNames == null) options.strictFileNames = false;
  if (callback == null) callback = defaultCallback;
  if (typeof totalSize !== "number") throw new Error("expected totalSize parameter to be a number");
  if (totalSize > Number.MAX_SAFE_INTEGER) {
    throw new Error("zip file too large. only file sizes up to 2^52 are supported due to JavaScript's Number type being an IEEE 754 double.");
  }

  // the matching unref() call is in zipfile.close()
  reader.ref();

  // eocdr means End of Central Directory Record.
  // search backwards for the eocdr signature.
  // the last field of the eocdr is a variable-length comment.
  // the comment size is encoded in a 2-byte field in the eocdr, which we can't find without trudging backwards through the comment to find it.
  // as a consequence of this design decision, it's possible to have ambiguous zip file metadata if a coherent eocdr was in the comment.
  // we search backwards for a eocdr signature, and hope that whoever made the zip file was smart enough to forbid the eocdr signature in the comment.
  var eocdrWithoutCommentSize = 22;
  var zip64EocdlSize = 20; // Zip64 end of central directory locator
  var maxCommentSize = 0xffff; // 2-byte size
  var bufferSize = Math.min(zip64EocdlSize + eocdrWithoutCommentSize + maxCommentSize, totalSize);
  var buffer = newBuffer(bufferSize);
  var bufferReadStart = totalSize - buffer.length;
  readAndAssertNoEof(reader, buffer, 0, bufferSize, bufferReadStart, function(err) {
    if (err) return callback(err);
    for (var i = bufferSize - eocdrWithoutCommentSize; i >= 0; i -= 1) {
      if (buffer.readUInt32LE(i) !== 0x06054b50) continue;
      // found eocdr
      var eocdrBuffer = buffer.subarray(i);

      // 0 - End of central directory signature = 0x06054b50
      // 4 - Number of this disk
      var diskNumber = eocdrBuffer.readUInt16LE(4);
      // 6 - Disk where central directory starts
      // 8 - Number of central directory records on this disk
      // 10 - Total number of central directory records
      var entryCount = eocdrBuffer.readUInt16LE(10);
      // 12 - Size of central directory (bytes)
      // 16 - Offset of start of central directory, relative to start of archive
      var centralDirectoryOffset = eocdrBuffer.readUInt32LE(16);
      // 20 - Comment length
      var commentLength = eocdrBuffer.readUInt16LE(20);
      var expectedCommentLength = eocdrBuffer.length - eocdrWithoutCommentSize;
      if (commentLength !== expectedCommentLength) {
        return callback(new Error("Invalid comment length. Expected: " + expectedCommentLength + ". Found: " + commentLength + ". Are there extra bytes at the end of the file? Or is the end of central dir signature `PK☺☻` in the comment?"));
      }
      // 22 - Comment
      // the encoding is always cp437.
      var comment = decodeStrings ? decodeBuffer(eocdrBuffer.subarray(22), false)
                                  : eocdrBuffer.subarray(22);

      // Look for a Zip64 end of central directory locator
      if (i - zip64EocdlSize >= 0 && buffer.readUInt32LE(i - zip64EocdlSize) === 0x07064b50) {
        // ZIP64 format
        var zip64EocdlBuffer = buffer.subarray(i - zip64EocdlSize, i - zip64EocdlSize + zip64EocdlSize);
        // 0 - zip64 end of central dir locator signature = 0x07064b50
        // 4 - number of the disk with the start of the zip64 end of central directory
        // 8 - relative offset of the zip64 end of central directory record
        var zip64EocdrOffset = readUInt64LE(zip64EocdlBuffer, 8);
        // 16 - total number of disks

        // ZIP64 end of central directory record
        var zip64EocdrBuffer = newBuffer(56);
        return readAndAssertNoEof(reader, zip64EocdrBuffer, 0, zip64EocdrBuffer.length, zip64EocdrOffset, function(err) {
          if (err) return callback(err);

          // 0 - zip64 end of central dir signature                           4 bytes  (0x06064b50)
          if (zip64EocdrBuffer.readUInt32LE(0) !== 0x06064b50) {
            return callback(new Error("invalid zip64 end of central directory record signature"));
          }
          // 4 - size of zip64 end of central directory record                8 bytes
          // 12 - version made by                                             2 bytes
          // 14 - version needed to extract                                   2 bytes
          // 16 - number of this disk                                         4 bytes
          diskNumber = zip64EocdrBuffer.readUInt32LE(16);
          if (diskNumber !== 0) {
            // Check this only after zip64 overrides. See #118.
            return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
          }
          // 20 - number of the disk with the start of the central directory  4 bytes
          // 24 - total number of entries in the central directory on this disk         8 bytes
          // 32 - total number of entries in the central directory            8 bytes
          entryCount = readUInt64LE(zip64EocdrBuffer, 32);
          // 40 - size of the central directory                               8 bytes
          // 48 - offset of start of central directory with respect to the starting disk number     8 bytes
          centralDirectoryOffset = readUInt64LE(zip64EocdrBuffer, 48);
          // 56 - zip64 extensible data sector                                (variable size)
          return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options.autoClose, options.lazyEntries, decodeStrings, options.validateEntrySizes, options.strictFileNames));
        });
      }

      // Not ZIP64 format
      if (diskNumber !== 0) {
        return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
      }
      return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options.autoClose, options.lazyEntries, decodeStrings, options.validateEntrySizes, options.strictFileNames));

    }

    // Not a zip file.
    callback(new Error("End of central directory record signature not found. Either not a zip file, or file is truncated."));
  });
}

util.inherits(ZipFile, EventEmitter);
function ZipFile(reader, centralDirectoryOffset, fileSize, entryCount, comment, autoClose, lazyEntries, decodeStrings, validateEntrySizes, strictFileNames) {
  var self = this;
  EventEmitter.call(self);
  self.reader = reader;
  // forward close events
  self.reader.on("error", function(err) {
    // error closing the fd
    emitError(self, err);
  });
  self.reader.once("close", function() {
    self.emit("close");
  });
  self.readEntryCursor = centralDirectoryOffset;
  self.fileSize = fileSize;
  self.entryCount = entryCount;
  self.comment = comment;
  self.entriesRead = 0;
  self.autoClose = !!autoClose;
  self.lazyEntries = !!lazyEntries;
  self.decodeStrings = !!decodeStrings;
  self.validateEntrySizes = !!validateEntrySizes;
  self.strictFileNames = !!strictFileNames;
  self.isOpen = true;
  self.emittedError = false;

  if (!self.lazyEntries) self._readEntry();
}
ZipFile.prototype.close = function() {
  if (!this.isOpen) return;
  this.isOpen = false;
  this.reader.unref();
};

function emitErrorAndAutoClose(self, err) {
  if (self.autoClose) self.close();
  emitError(self, err);
}
function emitError(self, err) {
  if (self.emittedError) return;
  self.emittedError = true;
  self.emit("error", err);
}

ZipFile.prototype.readEntry = function() {
  if (!this.lazyEntries) throw new Error("readEntry() called without lazyEntries:true");
  this._readEntry();
};
ZipFile.prototype._readEntry = function() {
  var self = this;
  if (self.entryCount === self.entriesRead) {
    // done with metadata
    setImmediate(function() {
      if (self.autoClose) self.close();
      if (self.emittedError) return;
      self.emit("end");
    });
    return;
  }
  if (self.emittedError) return;
  var buffer = newBuffer(46);
  readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err) {
    if (err) return emitErrorAndAutoClose(self, err);
    if (self.emittedError) return;
    var entry = new Entry();
    // 0 - Central directory file header signature
    var signature = buffer.readUInt32LE(0);
    if (signature !== 0x02014b50) return emitErrorAndAutoClose(self, new Error("invalid central directory file header signature: 0x" + signature.toString(16)));
    // 4 - Version made by
    entry.versionMadeBy = buffer.readUInt16LE(4);
    // 6 - Version needed to extract (minimum)
    entry.versionNeededToExtract = buffer.readUInt16LE(6);
    // 8 - General purpose bit flag
    entry.generalPurposeBitFlag = buffer.readUInt16LE(8);
    // 10 - Compression method
    entry.compressionMethod = buffer.readUInt16LE(10);
    // 12 - File last modification time
    entry.lastModFileTime = buffer.readUInt16LE(12);
    // 14 - File last modification date
    entry.lastModFileDate = buffer.readUInt16LE(14);
    // 16 - CRC-32
    entry.crc32 = buffer.readUInt32LE(16);
    // 20 - Compressed size
    entry.compressedSize = buffer.readUInt32LE(20);
    // 24 - Uncompressed size
    entry.uncompressedSize = buffer.readUInt32LE(24);
    // 28 - File name length (n)
    entry.fileNameLength = buffer.readUInt16LE(28);
    // 30 - Extra field length (m)
    entry.extraFieldLength = buffer.readUInt16LE(30);
    // 32 - File comment length (k)
    entry.fileCommentLength = buffer.readUInt16LE(32);
    // 34 - Disk number where file starts
    // 36 - Internal file attributes
    entry.internalFileAttributes = buffer.readUInt16LE(36);
    // 38 - External file attributes
    entry.externalFileAttributes = buffer.readUInt32LE(38);
    // 42 - Relative offset of local file header
    entry.relativeOffsetOfLocalHeader = buffer.readUInt32LE(42);

    if (entry.generalPurposeBitFlag & 0x40) return emitErrorAndAutoClose(self, new Error("strong encryption is not supported"));

    self.readEntryCursor += 46;

    buffer = newBuffer(entry.fileNameLength + entry.extraFieldLength + entry.fileCommentLength);
    readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err) {
      if (err) return emitErrorAndAutoClose(self, err);
      if (self.emittedError) return;
      // 46 - File name
      entry.fileNameRaw = buffer.subarray(0, entry.fileNameLength);
      // 46+n - Extra field
      var fileCommentStart = entry.fileNameLength + entry.extraFieldLength;
      entry.extraFieldRaw = buffer.subarray(entry.fileNameLength, fileCommentStart);
      // 46+n+m - File comment
      entry.fileCommentRaw = buffer.subarray(fileCommentStart, fileCommentStart + entry.fileCommentLength);

      // Parse the extra fields, which we need for processing other fields.
      try {
        entry.extraFields = parseExtraFields(entry.extraFieldRaw);
      } catch (err) {
        return emitErrorAndAutoClose(self, err);
      }

      // Interpret strings according to bit flags, extra fields, and options.
      if (self.decodeStrings) {
        var isUtf8 = (entry.generalPurposeBitFlag & 0x800) !== 0;
        entry.fileComment = decodeBuffer(entry.fileCommentRaw, isUtf8);
        entry.fileName = getFileNameLowLevel(entry.generalPurposeBitFlag, entry.fileNameRaw, entry.extraFields, self.strictFileNames);
        var errorMessage = validateFileName(entry.fileName);
        if (errorMessage != null) return emitErrorAndAutoClose(self, new Error(errorMessage));
      } else {
        entry.fileComment = entry.fileCommentRaw;
        entry.fileName = entry.fileNameRaw;
      }
      // Maintain API compatibility. See https://github.com/thejoshwolfe/yauzl/issues/47
      entry.comment = entry.fileComment;

      self.readEntryCursor += buffer.length;
      self.entriesRead += 1;

      // Check for the Zip64 Extended Information Extra Field.
      for (var i = 0; i < entry.extraFields.length; i++) {
        var extraField = entry.extraFields[i];
        if (extraField.id !== 0x0001) continue;
        // Found it.

        var zip64EiefBuffer = extraField.data;
        var index = 0;
        // 0 - Original Size          8 bytes
        if (entry.uncompressedSize === 0xffffffff) {
          if (index + 8 > zip64EiefBuffer.length) {
            return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include uncompressed size"));
          }
          entry.uncompressedSize = readUInt64LE(zip64EiefBuffer, index);
          index += 8;
        }
        // 8 - Compressed Size        8 bytes
        if (entry.compressedSize === 0xffffffff) {
          if (index + 8 > zip64EiefBuffer.length) {
            return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include compressed size"));
          }
          entry.compressedSize = readUInt64LE(zip64EiefBuffer, index);
          index += 8;
        }
        // 16 - Relative Header Offset 8 bytes
        if (entry.relativeOffsetOfLocalHeader === 0xffffffff) {
          if (index + 8 > zip64EiefBuffer.length) {
            return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include relative header offset"));
          }
          entry.relativeOffsetOfLocalHeader = readUInt64LE(zip64EiefBuffer, index);
          index += 8;
        }
        // 24 - Disk Start Number      4 bytes

        break;
      }

      // validate file size
      if (self.validateEntrySizes && entry.compressionMethod === 0) {
        var expectedCompressedSize = entry.uncompressedSize;
        if (entry.isEncrypted()) {
          // traditional encryption prefixes the file data with a header
          expectedCompressedSize += 12;
        }
        if (entry.compressedSize !== expectedCompressedSize) {
          var msg = "compressed/uncompressed size mismatch for stored file: " + entry.compressedSize + " != " + entry.uncompressedSize;
          return emitErrorAndAutoClose(self, new Error(msg));
        }
      }

      self.emit("entry", entry);

      if (!self.lazyEntries) self._readEntry();
    });
  });
};

ZipFile.prototype.openReadStream = function(entry, options, callback) {
  var self = this;
  // parameter validation
  var relativeStart = 0;
  var relativeEnd = entry.compressedSize;
  if (callback == null) {
    callback = options;
    options = null;
  }
  if (options == null) {
    options = {};
  } else {
    // validate options that the caller has no excuse to get wrong
    if (options.decrypt != null) {
      if (!entry.isEncrypted()) {
        throw new Error("options.decrypt can only be specified for encrypted entries");
      }
      if (options.decrypt !== false) throw new Error("invalid options.decrypt value: " + options.decrypt);
      if (entry.isCompressed()) {
        if (options.decompress !== false) throw new Error("entry is encrypted and compressed, and options.decompress !== false");
      }
    }
    if (options.decompress != null) {
      if (!entry.isCompressed()) {
        throw new Error("options.decompress can only be specified for compressed entries");
      }
      if (!(options.decompress === false || options.decompress === true)) {
        throw new Error("invalid options.decompress value: " + options.decompress);
      }
    }
    if (options.start != null || options.end != null) {
      if (entry.isCompressed() && options.decompress !== false) {
        throw new Error("start/end range not allowed for compressed entry without options.decompress === false");
      }
      if (entry.isEncrypted() && options.decrypt !== false) {
        throw new Error("start/end range not allowed for encrypted entry without options.decrypt === false");
      }
    }
    if (options.start != null) {
      relativeStart = options.start;
      if (relativeStart < 0) throw new Error("options.start < 0");
      if (relativeStart > entry.compressedSize) throw new Error("options.start > entry.compressedSize");
    }
    if (options.end != null) {
      relativeEnd = options.end;
      if (relativeEnd < 0) throw new Error("options.end < 0");
      if (relativeEnd > entry.compressedSize) throw new Error("options.end > entry.compressedSize");
      if (relativeEnd < relativeStart) throw new Error("options.end < options.start");
    }
  }
  // any further errors can either be caused by the zipfile,
  // or were introduced in a minor version of yauzl,
  // so should be passed to the client rather than thrown.
  if (!self.isOpen) return callback(new Error("closed"));
  if (entry.isEncrypted()) {
    if (options.decrypt !== false) return callback(new Error("entry is encrypted, and options.decrypt !== false"));
  }
  var decompress;
  if (entry.compressionMethod === 0) {
    // 0 - The file is stored (no compression)
    decompress = false;
  } else if (entry.compressionMethod === 8) {
    // 8 - The file is Deflated
    decompress = options.decompress != null ? options.decompress : true;
  } else {
    return callback(new Error("unsupported compression method: " + entry.compressionMethod));
  }

  self.readLocalFileHeader(entry, {minimal: true}, function(err, localFileHeader) {
    if (err) return callback(err);
    self.openReadStreamLowLevel(
      localFileHeader.fileDataStart, entry.compressedSize,
      relativeStart, relativeEnd,
      decompress, entry.uncompressedSize,
      callback);
  });
};

ZipFile.prototype.openReadStreamLowLevel = function(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize, callback) {
  var self = this;

  var fileDataEnd = fileDataStart + compressedSize;
  var readStream = self.reader.createReadStream({
    start: fileDataStart + relativeStart,
    end: fileDataStart + relativeEnd,
  });
  var endpointStream = readStream;
  if (decompress) {
    var destroyed = false;
    var inflateFilter = zlib.createInflateRaw();
    readStream.on("error", function(err) {
      // setImmediate here because errors can be emitted during the first call to pipe()
      setImmediate(function() {
        if (!destroyed) inflateFilter.emit("error", err);
      });
    });
    readStream.pipe(inflateFilter);

    if (self.validateEntrySizes) {
      endpointStream = new AssertByteCountStream(uncompressedSize);
      inflateFilter.on("error", function(err) {
        // forward zlib errors to the client-visible stream
        setImmediate(function() {
          if (!destroyed) endpointStream.emit("error", err);
        });
      });
      inflateFilter.pipe(endpointStream);
    } else {
      // the zlib filter is the client-visible stream
      endpointStream = inflateFilter;
    }
    // this is part of yauzl's API, so implement this function on the client-visible stream
    installDestroyFn(endpointStream, function() {
      destroyed = true;
      if (inflateFilter !== endpointStream) inflateFilter.unpipe(endpointStream);
      readStream.unpipe(inflateFilter);
      // TODO: the inflateFilter may cause a memory leak. see Issue #27.
      readStream.destroy();
    });
  }
  callback(null, endpointStream);
};

ZipFile.prototype.readLocalFileHeader = function(entry, options, callback) {
  var self = this;
  if (callback == null) {
    callback = options;
    options = null;
  }
  if (options == null) options = {};

  self.reader.ref();
  var buffer = newBuffer(30);
  readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader, function(err) {
    try {
      if (err) return callback(err);
      // 0 - Local file header signature = 0x04034b50
      var signature = buffer.readUInt32LE(0);
      if (signature !== 0x04034b50) {
        return callback(new Error("invalid local file header signature: 0x" + signature.toString(16)));
      }

      var fileNameLength = buffer.readUInt16LE(26);
      var extraFieldLength = buffer.readUInt16LE(28);
      var fileDataStart = entry.relativeOffsetOfLocalHeader + 30 + fileNameLength + extraFieldLength;
      // We now have enough information to do this bounds check.
      if (fileDataStart + entry.compressedSize > self.fileSize) {
        return callback(new Error("file data overflows file bounds: " +
            fileDataStart + " + " + entry.compressedSize + " > " + self.fileSize));
      }

      if (options.minimal) {
        return callback(null, {fileDataStart: fileDataStart});
      }

      var localFileHeader = new LocalFileHeader();
      localFileHeader.fileDataStart = fileDataStart;

      // 4 - Version needed to extract (minimum)
      localFileHeader.versionNeededToExtract = buffer.readUInt16LE(4);
      // 6 - General purpose bit flag
      localFileHeader.generalPurposeBitFlag = buffer.readUInt16LE(6);
      // 8 - Compression method
      localFileHeader.compressionMethod = buffer.readUInt16LE(8);
      // 10 - File last modification time
      localFileHeader.lastModFileTime = buffer.readUInt16LE(10);
      // 12 - File last modification date
      localFileHeader.lastModFileDate = buffer.readUInt16LE(12);
      // 14 - CRC-32
      localFileHeader.crc32 = buffer.readUInt32LE(14);
      // 18 - Compressed size
      localFileHeader.compressedSize = buffer.readUInt32LE(18);
      // 22 - Uncompressed size
      localFileHeader.uncompressedSize = buffer.readUInt32LE(22);
      // 26 - File name length (n)
      localFileHeader.fileNameLength = fileNameLength;
      // 28 - Extra field length (m)
      localFileHeader.extraFieldLength = extraFieldLength;
      // 30 - File name
      // 30+n - Extra field

      buffer = newBuffer(fileNameLength + extraFieldLength);
      self.reader.ref();
      readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader + 30, function(err) {
        try {
          if (err) return callback(err);
          localFileHeader.fileName = buffer.subarray(0, fileNameLength);
          localFileHeader.extraField = buffer.subarray(fileNameLength);
          return callback(null, localFileHeader);
        } finally {
          self.reader.unref();
        }
      });
    } finally {
      self.reader.unref();
    }
  });
};

function Entry() {
}
Entry.prototype.getLastModDate = function(options) {
  if (options == null) options = {};

  if (!options.forceDosFormat) {
    // Check extended fields.
    for (var i = 0; i < this.extraFields.length; i++) {
      var extraField = this.extraFields[i];
      if (extraField.id === 0x5455) {
        // Info-ZIP "universal timestamp" extended field (`0x5455` aka `"UT"`).
        // See the Info-ZIP source code unix/unix.c:set_extra_field() and zipfile.c:ef_scan_ut_time().
        var data = extraField.data;
        if (data.length < 5) continue; // Too short.
        // The flags define which of the three fields are present: mtime, atime, ctime.
        // We only care about mtime.
        // Also, ctime is never included in practice.
        // And also, atime is only included in the local file header for some reason
        // despite the flags lying about its inclusion in the central header.
        var flags = data[0];
        var HAS_MTIME = 1;
        if (!(flags & HAS_MTIME)) continue; // This will realistically never happen.
        // Although the positions of all of the fields shift around depending on the presence of other fields,
        // mtime is always first if present, and that's the only one we care about.
        var posixTimestamp = data.readInt32LE(1);
        return new Date(posixTimestamp * 1000);
      } else if (extraField.id === 0x000a) {
        var data = extraField.data;
        if (data.length !== 32) continue; // The length is always the same.
        // 4 bytes reserved
        // 2 bytes Tag
        if (data.readUInt16LE(4) !== 1) continue; // Tag1 is actually the only defined Tag.
        // 2 bytes Size
        if (data.readUInt16LE(6) !== 24) continue; // Size is always 24.
        // 8 bytes Mtime
        var hundredNanoSecondsSince1601 = data.readUInt32LE(8) + 4294967296 * data.readInt32LE(12);
        // Convert from NTFS to POSIX milliseconds.
        // The big number below is the milliseconds between year 1601 and year 1970
        // (i.e. the negative POSIX timestamp of 1601-01-01 00:00:00Z)
        var millisecondsSince1970 = hundredNanoSecondsSince1601 / 10000 - 11644473600000;
        // Note on numeric precision: JavaScript Number objects lose precision above Number.MAX_SAFE_INTEGER,
        // and NTFS timestamps are typically much bigger than that limit.
        // (MAX_SAFE_INTEGER would represent 1629-07-17T23:58:45.475Z.)
        // However, we're losing precision in the conversion from 100nanosecond units to millisecond units anyway,
        // and the time at which we also lose 1-millisecond precision is year 275760, the JavaScript Date limit (by design).
        // Up through the year 2057, this conversion only drops 4 bits of precision,
        // which is well under the 13-14 bits ratio between the milliseconds and 100nanoseconds.
        return new Date(millisecondsSince1970);
      }
    }
  }

  // Fallback to non-extended encoding.
  return dosDateTimeToDate(this.lastModFileDate, this.lastModFileTime, options.timezone);
};
Entry.prototype.isEncrypted = function() {
  return (this.generalPurposeBitFlag & 0x1) !== 0;
};
Entry.prototype.isCompressed = function() {
  return this.compressionMethod === 8;
};

function LocalFileHeader() {
}

function dosDateTimeToDate(date, time, timezone) {
  var day = date & 0x1f; // 1-31
  var month = (date >> 5 & 0xf) - 1; // 1-12, 0-11
  var year = (date >> 9 & 0x7f) + 1980; // 0-128, 1980-2108

  var millisecond = 0;
  var second = (time & 0x1f) * 2; // 0-29, 0-58 (even numbers)
  var minute = time >> 5 & 0x3f; // 0-59
  var hour = time >> 11 & 0x1f; // 0-23

  if (timezone == null || timezone === "local") {
    return new Date(year, month, day, hour, minute, second, millisecond);
  } else if (timezone === "UTC") {
    return new Date(Date.UTC(year, month, day, hour, minute, second, millisecond));
  } else {
    throw new Error("unrecognized options.timezone: " + options.timezone);
  }
}

function getFileNameLowLevel(generalPurposeBitFlag, fileNameBuffer, extraFields, strictFileNames) {
  var fileName = null;

  // check for Info-ZIP Unicode Path Extra Field (0x7075)
  // see https://github.com/thejoshwolfe/yauzl/issues/33
  for (var i = 0; i < extraFields.length; i++) {
    var extraField = extraFields[i];
    if (extraField.id === 0x7075) {
      if (extraField.data.length < 6) {
        // too short to be meaningful
        continue;
      }
      // Version       1 byte      version of this extra field, currently 1
      if (extraField.data.readUInt8(0) !== 1) {
        // > Changes may not be backward compatible so this extra
        // > field should not be used if the version is not recognized.
        continue;
      }
      // NameCRC32     4 bytes     File Name Field CRC32 Checksum
      var oldNameCrc32 = extraField.data.readUInt32LE(1);
      if (crc32.unsigned(fileNameBuffer) !== oldNameCrc32) {
        // > If the CRC check fails, this UTF-8 Path Extra Field should be
        // > ignored and the File Name field in the header should be used instead.
        continue;
      }
      // UnicodeName   Variable    UTF-8 version of the entry File Name
      fileName = decodeBuffer(extraField.data.subarray(5), true);
      break;
    }
  }

  if (fileName == null) {
    // The typical case.
    var isUtf8 = (generalPurposeBitFlag & 0x800) !== 0;
    fileName = decodeBuffer(fileNameBuffer, isUtf8);
  }

  if (!strictFileNames) {
    // Allow backslash.
    fileName = fileName.replace(/\\/g, "/");
  }
  return fileName;
}

function validateFileName(fileName) {
  if (fileName.indexOf("\\") !== -1) {
    return "invalid characters in fileName: " + fileName;
  }
  if (/^[a-zA-Z]:/.test(fileName) || /^\//.test(fileName)) {
    return "absolute path: " + fileName;
  }
  if (fileName.split("/").indexOf("..") !== -1) {
    return "invalid relative path: " + fileName;
  }
  // all good
  return null;
}

function parseExtraFields(extraFieldBuffer) {
  var extraFields = [];
  var i = 0;
  while (i < extraFieldBuffer.length - 3) {
    var headerId = extraFieldBuffer.readUInt16LE(i + 0);
    var dataSize = extraFieldBuffer.readUInt16LE(i + 2);
    var dataStart = i + 4;
    var dataEnd = dataStart + dataSize;
    if (dataEnd > extraFieldBuffer.length) throw new Error("extra field length exceeds extra field buffer size");
    var dataBuffer = extraFieldBuffer.subarray(dataStart, dataEnd);
    extraFields.push({
      id: headerId,
      data: dataBuffer,
    });
    i = dataEnd;
  }
  return extraFields;
}

function readAndAssertNoEof(reader, buffer, offset, length, position, callback) {
  if (length === 0) {
    // fs.read will throw an out-of-bounds error if you try to read 0 bytes from a 0 byte file
    return setImmediate(function() { callback(null, newBuffer(0)); });
  }
  reader.read(buffer, offset, length, position, function(err, bytesRead) {
    if (err) return callback(err);
    if (bytesRead < length) {
      return callback(new Error("unexpected EOF"));
    }
    callback();
  });
}

util.inherits(AssertByteCountStream, Transform);
function AssertByteCountStream(byteCount) {
  Transform.call(this);
  this.actualByteCount = 0;
  this.expectedByteCount = byteCount;
}
AssertByteCountStream.prototype._transform = function(chunk, encoding, cb) {
  this.actualByteCount += chunk.length;
  if (this.actualByteCount > this.expectedByteCount) {
    var msg = "too many bytes in the stream. expected " + this.expectedByteCount + ". got at least " + this.actualByteCount;
    return cb(new Error(msg));
  }
  cb(null, chunk);
};
AssertByteCountStream.prototype._flush = function(cb) {
  if (this.actualByteCount < this.expectedByteCount) {
    var msg = "not enough bytes in the stream. expected " + this.expectedByteCount + ". got only " + this.actualByteCount;
    return cb(new Error(msg));
  }
  cb();
};

util.inherits(RandomAccessReader, EventEmitter);
function RandomAccessReader() {
  EventEmitter.call(this);
  this.refCount = 0;
}
RandomAccessReader.prototype.ref = function() {
  this.refCount += 1;
};
RandomAccessReader.prototype.unref = function() {
  var self = this;
  self.refCount -= 1;

  if (self.refCount > 0) return;
  if (self.refCount < 0) throw new Error("invalid unref");

  self.close(onCloseDone);

  function onCloseDone(err) {
    if (err) return self.emit('error', err);
    self.emit('close');
  }
};
RandomAccessReader.prototype.createReadStream = function(options) {
  if (options == null) options = {};
  var start = options.start;
  var end = options.end;
  if (start === end) {
    var emptyStream = new PassThrough();
    setImmediate(function() {
      emptyStream.end();
    });
    return emptyStream;
  }
  var stream = this._readStreamForRange(start, end);

  var destroyed = false;
  var refUnrefFilter = new RefUnrefFilter(this);
  stream.on("error", function(err) {
    setImmediate(function() {
      if (!destroyed) refUnrefFilter.emit("error", err);
    });
  });
  installDestroyFn(refUnrefFilter, function() {
    stream.unpipe(refUnrefFilter);
    refUnrefFilter.unref();
    stream.destroy();
  });

  var byteCounter = new AssertByteCountStream(end - start);
  refUnrefFilter.on("error", function(err) {
    setImmediate(function() {
      if (!destroyed) byteCounter.emit("error", err);
    });
  });
  installDestroyFn(byteCounter, function() {
    destroyed = true;
    refUnrefFilter.unpipe(byteCounter);
    refUnrefFilter.destroy();
  });

  return stream.pipe(refUnrefFilter).pipe(byteCounter);
};
RandomAccessReader.prototype._readStreamForRange = function(start, end) {
  throw new Error("not implemented");
};
RandomAccessReader.prototype.read = function(buffer, offset, length, position, callback) {
  var readStream = this.createReadStream({start: position, end: position + length});
  var writeStream = new Writable();
  var written = 0;
  writeStream._write = function(chunk, encoding, cb) {
    chunk.copy(buffer, offset + written, 0, chunk.length);
    written += chunk.length;
    cb();
  };
  writeStream.on("finish", callback);
  readStream.on("error", function(error) {
    callback(error);
  });
  readStream.pipe(writeStream);
};
RandomAccessReader.prototype.close = function(callback) {
  setImmediate(callback);
};

util.inherits(RefUnrefFilter, PassThrough);
function RefUnrefFilter(context) {
  PassThrough.call(this);
  this.context = context;
  this.context.ref();
  this.unreffedYet = false;
}
RefUnrefFilter.prototype._flush = function(cb) {
  this.unref();
  cb();
};
RefUnrefFilter.prototype.unref = function(cb) {
  if (this.unreffedYet) return;
  this.unreffedYet = true;
  this.context.unref();
};

var cp437 = '\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
function decodeBuffer(buffer, isUtf8) {
  if (isUtf8) {
    return buffer.toString("utf8");
  } else {
    var result = "";
    for (var i = 0; i < buffer.length; i++) {
      result += cp437[buffer[i]];
    }
    return result;
  }
}

function readUInt64LE(buffer, offset) {
  // There is no native function for this, because we can't actually store 64-bit integers precisely.
  // after 53 bits, JavaScript's Number type (IEEE 754 double) can't store individual integers anymore.
  // but since 53 bits is a whole lot more than 32 bits, we do our best anyway.
  // As of 2020, Node has added support for BigInt, which obviates this whole function,
  // but yauzl hasn't been updated to depend on BigInt (yet?).
  var lower32 = buffer.readUInt32LE(offset);
  var upper32 = buffer.readUInt32LE(offset + 4);
  // we can't use bitshifting here, because JavaScript bitshifting only works on 32-bit integers.
  return upper32 * 0x100000000 + lower32;
  // as long as we're bounds checking the result of this function against the total file size,
  // we'll catch any overflow errors, because we already made sure the total file size was within reason.
}

// Node 10 deprecated new Buffer().
var newBuffer;
if (typeof Buffer.allocUnsafe === "function") {
  newBuffer = function(len) {
    return Buffer.allocUnsafe(len);
  };
} else {
  newBuffer = function(len) {
    return new Buffer(len);
  };
}

// Node 8 introduced a proper destroy() implementation on writable streams.
function installDestroyFn(stream, fn) {
  if (typeof stream.destroy === "function") {
    // New API.
    stream._destroy = function(err, cb) {
      fn();
      if (cb != null) cb(err);
    };
  } else {
    // Old API.
    stream.destroy = fn;
  }
}

function defaultCallback(err) {
  if (err) throw err;
}
