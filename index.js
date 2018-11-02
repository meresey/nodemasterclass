/*
* Author: John Meresey
* 
**/

//dependencies
const server = require('./lib/server')
const workers = require('./lib/workers')

// Declare app
const app = {}

// Init function
app.init = () => {
  // Init server
  server.init()
  // Init workers
  workers.init()
}

// Execute
app.init()

// Export app
module.exports = app