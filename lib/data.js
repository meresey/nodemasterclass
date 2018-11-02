/*
* Library for working with data
*/

const fs = require('fs');
const path = require('path');

const helpers = require('./helpers')

const lib = {};
//define base directory for data
lib.baseDir = path.join(__dirname, '../.data/')
lib.create = (dir, file, data, cb) => {
  // open the file for writing
  fs.open(path.join(lib.baseDir, dir, file + '.json'), 'wx', (err, fd) => {
    if (err) return cb('Error opening file, it may already exist');
    fs.writeFile(fd, JSON.stringify(data), err => {
      if (err) return cb('Error writing to file');
      fs.close(fd, err => {
        if (err) return cb('Error closing file');
        return cb(null, 'File written successfully')
      })
    })
  })
};

lib.read = (dir, file, cb) => {
  fs.readFile(path.join(lib.baseDir, dir, file + '.json'), (err, data) => {
    if (err) return cb(err);
    return cb(err, helpers.parseToJSON(data));
  })
}

lib.update = (dir, file, data, cb) => {
  fs.open(path.join(lib.baseDir, dir, file + '.json'), 'r+', (err, fd) => {
    if (err) return cb('Could not open the file for update, it may not exist yet');
    //truncate and update the file
    fs.ftruncate(fd, err => {
      if (err) return cb('Error trucating the file');
      fs.writeFile(fd, JSON.stringify(data), err => {
        if (err) return cb('Error updating file');
        fs.close(fd, err => {
          if (err) return cb('Error closing file');
          return cb(null, 'File updated successfully')
        })
      })
    });
  })
}

lib.delete = (dir, file, cb) => {
  fs.unlink(path.join(lib.baseDir, dir, file + '.json'), err => {
    if (err) return cb(err)
    return cb(null, 'File deleted successfully')
  })
}

// List directory
lib.list = (dir,cb) => {
  fs.readdir(path.join(lib.baseDir,dir,'/'), (err,data) => {
    if (err) return cb(err)
    if (data.length > 0) {
      const trimmedFileNames =  data.map(fileName => fileName.replace('.json',''))
      cb(null,trimmedFileNames)
    } else {
      cb(null, [])
    }
  })
}

module.exports = lib;