/*
* Libary for storing and rotating logs
*
*
*/

// Dependencies
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

// Declare container
const lib = {}

// Base directory
lib.baseDir = path.join(__dirname, '../.logs/')

// Function to append logs
lib.append = (file, str, callback) => {
  // Open the file for appending
  fs.open(path.join(lib.baseDir,file+'.log'),'a',(err,fd) => {
    if (err) return callback('Could not open file for appending')
    fs.appendFile(fd,str+'\n', err => {
      if (err) return callback('Error appending to file')
      fs.close(fd, err => {
        if (err) return callback('Error closing file')
        callback(null)
      })
    })
  })
}

// Function to list all logs
lib.list = (flag, callback) => {
  // read file from directory
  fs.readdir(lib.baseDir, (err, logFiles) => {
      if (err) return callback('Error reading logfiles')
      let trimmedLogs = []
      trimmedLogs = logFiles.filter(logFile => {
        if (logFile.indexOf('.log') > -1) return true
        return flag && logFile.indexOf('.gz.b64') > -1 ? true : false
      }).map(logFile => {
        if (logFile.indexOf('.log') > -1) return logFile.replace('.log','')
        return logFile.replace('.gz.b64','')
      })
      // return trimmed log files
      callback(null, trimmedLogs)
  })
}

// Function to compress
lib.compress = (logId, newFileId,callback) => {
  const sourceFile = logId + '.log'
  const destFile = newFileId + '.gz.b64'

  //Read source read file
  fs.readFile(path.join(lib.baseDir,sourceFile), 'utf8', (err, inputString) => {
    if (err) return callback(`Error reading log file ${sourceFile}: ${err}`)
    // Compress data using zlib
    zlib.gzip(inputString, (err, buffer) => {
      if (err) return callback(err)
      /// Send data to destination file
      fs.open(path.join(lib.baseDir,destFile),'wx', (err, fd) => {
        if (err) return callback(`Error opening destination zip file (${destFile}: ${err})`)
        // write to destionation file
        fs.writeFile(fd, buffer.toString('base64'), err => {
          if (err) return callback(`Error writing to ${destFile}: ${err}`)
          fs.close(fd, err => {
            if (err) return callback(`Error closing file: ${destFile}: ${err}`)
            callback(null)
          })
        })
      })
    })
  })
}

// Decompress function
lib.decompress = (zipfile, callback) => {
  //verify that it's a zip file
  zipfile = zipfile + 'gz.b64'
  fs.readFile(path.join(lib.baseDir, zipfile), (err, data) => {
    if (err) return callback(`Error reading file ${zipfile}: ${err}`)
    // decompress data
    const inputBuffer =  Buffer.from(str, 'base64')
    zlib.unzip(inputBuffer, (err, outputBuffer) => {
      if (err) return callback(`Error decompressing file ${zipfile}: ${err}`)
      callback(null, outputBuffer.toString())
    })
  })
}

// Function - Truncate log file
lib.truncate = (logId, callback) => {
  fs.truncate(path.join(lib.baseDir,logId+'.log'), err => {
    if (err) return callback(`Error truncating log file ${logId}.log`)
    callback(null)
  })
}

// Export module
module.exports = lib