/*
* Author: John Meresey
* Server related tasks
**/

//dependencies
const http = require('http');
const https = require('https')
const url = require('url');
const { StringDecoder } = require('string_decoder');
const fs = require('fs');
const path = require('path')
const config = require('./config');
const handlers = require('./handlers')
const helpers = require('./helpers')
const util = require('util')

const debug = util.debuglog('server')


// Declare server module object
const server = {}

//instantiate http server
server.httpServer = http.createServer((req, res) => {
  server.unifiedServer(req, res)
})

//instantiate https server
server.httpsServerOptions = {
  'key': fs.readFileSync(path.join(__dirname, '../', 'https/key.pem')),
  'cert': fs.readFileSync(path.join(__dirname, '../', 'https/cert.pem'))
}
server.httpsServer = https.createServer(server.httpsServerOptions, (req, res) => {
  server.unifiedServer(req, res)
})

server.router = {
  '': handlers.index,
  'accounts/create': handlers.accountCreate,
  'accounts/edit': handlers.accountEdit,
  'accounts/deleted': handlers.accountDeleted,
  'session/create': handlers.sessionCreate,
  'session/deleted': handlers.sessionDeleted,
  'checks/all': handlers.checksList,
  'checks/create': handlers.checksCreate,
  'checks/edit': handlers.checksEdit,
  'ping': handlers.ping,
  'api/users': handlers.users,
  'api/tokens': handlers.tokens,
  'api/checks': handlers.checks,
  'favicon.ico': handlers.favicon,
  'public': handlers.public
}

//unified server logic
server.unifiedServer = (req, res) => {
  //get the URL and parse it
  const parsedURL = url.parse(req.url, true);

  //get the path
  const path = parsedURL.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, '');

  //get query string object
  const queryStringObject = parsedURL.query;
  //get params

  //get request method
  const method = req.method.toLowerCase()

  //get request headers
  const headers = req.headers;

  //get the payload
  const decoder = new StringDecoder('utf-8');
  let buffer = '';
  req.on('data', data => buffer += decoder.write(data))
  req.on('end', () => {
    buffer += decoder.end()
    
    //choose handler for this request
    let chosenHandler = typeof (server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;
    // if request is within the public directory, use the public handler instance
    chosenHandler = trimmedPath.indexOf('public/') > -1 ?  handlers.public : chosenHandler
    //if (trimmedPath.indexOf('public/') > -1) debug('public path')
    const data = {
      trimmedPath,
      queryStringObject,
      headers,
      method,
      payload: helpers.parseToJSON(buffer)
    }

    //route the request to the chosen handler
    chosenHandler(data, (statuscode = 200, payload, ContentType = 'json') => {
      // Return the response that are content-specific
      debug('type of ' + typeof payload)
      let payloadString = ''
      switch (ContentType) {
        case 'json':
          res.setHeader('Content-Type', 'application/json')
          payload = typeof payload == 'object' ? payload : {}
          payloadString = JSON.stringify(payload)
          break
        case 'html':
          res.setHeader('Content-Type', 'text/html')
          payloadString = typeof payload !== 'undefined' ? payload.toString() : ''
          break
        case 'jpeg':
          res.setHeader('Content-Type', 'image/jpeg')
          payloadString = typeof payload !== 'undefined' ? payload : ''
          break
        case 'ico':
          res.setHeader('Content-Type', 'image/x-icon')
          payloadString = typeof payload !== 'undefined' ? payload : ''
          break
        case 'favicon':
          res.setHeader('Content-Type', 'image/x-icon')
          payloadString = typeof payload !== 'undefined' ? payload : ''
          break
        case 'css':
          res.setHeader('Content-Type', 'text/css')
          payloadString = typeof payload !== 'undefined' ? payload.toString() : ''
          break
        case 'png':
          res.setHeader('Content-Type', 'image/png')
          payloadString = typeof payload !== 'undefined' ? payload : ''
          break
        default:
          res.setHeader('Content-Type', 'text/plain')
          payloadString = typeof payload !== 'undefined' ? payload.toString() : ''
      }
      // Return the response parts that are common to all responses    
      res.writeHead(statuscode)
      res.end(payloadString)

      //log the request path
      if (statuscode == 200) {
        debug('\x1b[32m%s\x1b[0m', `${method.toUpperCase()} /${trimmedPath} ${statuscode} ContentType: ${ContentType}`)
      } else {
        debug('\x1b[31m%s\x1b[0m', `${method.toUpperCase()} /${trimmedPath} ${statuscode}`)
      }
    })

  })
}

// Init function
server.init = () => {
  // start http server
  server.httpServer.listen(config.httpPort, () => {
    console.log('\x1b[35m%s\x1b[0m', `Server is now listening on port ${config.httpPort}. Environemnt name is ${config.envname}`)
  })
  // Start https server
  server.httpsServer.listen(config.httpsPort, () => {
    console.log('\x1b[36m%s\x1b[0m', `Server is now listening on port ${config.httpsPort}. Environemnt name is ${config.envname}`)
  })
}

// Export module
module.exports = server