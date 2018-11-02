/*
* Request handlers
*
*/

//dependencies
const _data = require('./data')
const helpers = require('./helpers')
const config = require('./config')


//define handlers
const handlers = {};

/*
* HTML handlers
*/

// Index handler
handlers.index = (data, callback) => {
  if (data.method !== 'get') return callback(405, undefined, 'html')
  // Prepare data for interpolation
  const templateData = {
    'head.title': 'Watcher App',
    'head.description': 'This is meta description',
    'body.class': 'index',
    'body.title': 'Welcome to my very own templating engine'
  }

  // Read in a template a string
  helpers.getTemplate('index', templateData, (err, str) => {
    if (err) return callback(500, undefined, 'html')
    // Add header and footer
    helpers.addUniversalTemplates(str, templateData, (error, finalString) => {
      if (error) return callback(400)
      return callback(200, finalString, 'html')
    })

  })
}

// Favicon handler
handlers.favicon = (data, callback) => {
  if (data.method !== 'get') return callback(405)
  // server favicon
  helpers.getStaticAsset('favicon.ico', (err, data) => {
    if (err) return callback(500)
    // return data
    callback(200, data, 'favicon')
  })
}

// Server static assets -Public 
handlers.public = (data, callback) => {
  if (data.method !== 'get') return callback(405)
  // Get the filename being requested
  const trimmedAssetName = data.trimmedPath.replace('public/', '')
  if (trimmedAssetName.length === 0) return callback(404)

  // server requested assset
  helpers.getStaticAsset(trimmedAssetName, (err, assetData) => {
    if (err) return callback(500)
    // determine asset type in order to return correct mime type
    let ContentType = 'plain'
    if(trimmedAssetName.indexOf('.css') > -1) ContentType = 'css'
    if(trimmedAssetName.indexOf('.png') > -1) ContentType = 'png'
    if(trimmedAssetName.indexOf('.jpeg') > -1) ContentType = 'jpeg'
    if(trimmedAssetName.indexOf('.ico') > -1) ContentType = 'favicon'
    callback(200, assetData, ContentType)
  })
}


/*
* JSON api handlers
*/


//users
handlers.users = (data, callback) => {
  var acceptableMethods = ['post', 'get', 'delete', 'put'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback)
  } else {
    callback(405)
  }
}

// private handlers for users
handlers._users = {};

// POST method
// Required data: username, firstname,lastname,phone,password, tosAgreement
// optional data: none
handlers._users.post = (data, callback) => {
  //validate data
  const firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
  const lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
  //const userName = typeof(data.payload.userName) == 'string' && data.payload.userName.trim().length > 0 ? data.payload.userName.trim() : false;
  const phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 12 ? data.payload.phone.trim() : false;
  const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  const tosAgreement = typeof (data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement === true ? true : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    //make user that the user doesn't exist
    _data.read('users', phone + '.json', (err, data) => {
      if (err) {
        // User doesn't exist.
        // hash the password
        var hashedPassword = helpers.hash(password)
        if (!hashedPassword) return callback(500, { 'Error': 'Failed to hash password' })
        // Object to hold user data
        let user = {
          firstName,
          lastName,
          phone,
          password: hashedPassword,
          tosAgreement
        }
        // Create user
        _data.create('users', phone, user, (err, res) => {
          if (err) return callback(400, { 'Error': 'Failed to create user' })
          callback(201, { res })
        })
      } else {
        // User already exists
        callback(400, { 'Error': `User with phone number ${phone} already exists` })
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required fields' })
  }
}

// GET method
// Required data: phone
// Optional data: none
// @TODO: only authenticated users should be able to view their own objects
handlers._users.get = (data, callback) => {
  const phone = typeof data.queryStringObject.phone == 'string' && data.queryStringObject.phone.trim().length === 12 ? data.queryStringObject.phone.trim() : false;
  if (phone) {
    //get token from header and verify
    const token = typeof data.headers.token == 'string' ? data.headers.token.trim() : false
    if (!token) return callback(403)
    handlers._tokens.verifyToken(token, phone, res => {
      if (!res) return callback(403, { 'Error': 'Missing or invalid token in header' })
      _data.read('users', phone, (err, user) => {
        if (err) return callback(404, { 'Error': 'User not found' })
        return callback(200, helpers.filterUserFields(user))
      })
    })
  } else {
    return callback(400, { 'Error': 'Missing required field' })
  }
}

//Delete method
// Required fields: phone
// Optional fields: none
// @TODO only configure authenticated users to delete their own objects
handlers._users.delete = (data, callback) => {
  const phone = typeof data.queryStringObject.phone == 'string' && data.queryStringObject.phone.trim().length === 12 ? data.queryStringObject.phone.trim() : false;
  if (phone) {
    //get token from header and verify
    const token = typeof data.headers.token == 'string' ? data.headers.token.trim() : false
    if (!token) return callback(403)
    handlers._tokens.verifyToken(token, phone, res => {
      if (!res) return callback(403, { 'Error': 'Missing or invalid token in header' })
      _data.read('users', phone, (err, user) => {
        if (err) return callback(400, { 'Error': 'User does not exist' })
        _data.delete('users', phone, err => {
          if (err) return callback(500, { 'Error': 'Internal error. Unable to delete user.' })
          // Delete associated checks
          let deletionErrors = false;
          let deletedChecks = 0;
          user.checks.forEach(check => {
            _data.delete('checks', check, err => {
              if (err) deletionErrors = true;
            })
            deletedChecks++;
          })
          if (deletionErrors) {
            callback(500, { 'Error': 'User deleted successfully but some associated checks failed to delete' })
          } else {
            callback(200)
          }
        })
      })
    })
  } else {
    return callback(400, { 'Error': 'Misssing required data' })
  }
}

//PUT method
// Required filed: phone
// Optional fields: at least one of the other fields: fistName, lastName, password
// @TODO only authenticated user should be able to update their objects
handlers._users.put = (data, callback) => {
  const phone = typeof data.payload.phone == 'string' && data.payload.phone.trim().length === 12 ? data.payload.phone.trim() : false;
  // Optional fields
  const firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
  const lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
  const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

  if (phone) {
    if (firstName || lastName || password) {

      //get token from header and verify
      const token = typeof data.headers.token == 'string' ? data.headers.token.trim() : false
      if (!token) return callback(403)
      handlers._tokens.verifyToken(token, phone, res => {
        if (!res) return callback(403, { 'Error': 'Missing or invalid token in header' })
        //lookup user
        _data.read('users', phone, (err, user) => {
          if (err) return callback(400, { 'Error': 'User does not exist' })
          // Create user object
          const modifiedUser = {
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            password: typeof (password) == 'string' ? helpers.hash(password) : user.password
          }

          //update user object
          const updatedUserObject = Object.assign({}, user, modifiedUser)
          _data.update('users', phone, updatedUserObject, (err, data) => {
            if (err) return callback(500, { 'Error': 'Internal error. Could not update user.' })
            return callback(200)
          })
        })
      })
    } else {
      return callback(400, { 'Error': 'Missing fields to update' })
    }
  } else {
    return callback(400, { 'Error': 'Missing required field' })
  }
}

//tokens
handlers.tokens = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'delete', 'put'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback)
  } else {
    callback(405)
  }
}

// Tokens private handlers
handlers._tokens = {}

// POST
// Required fields: phone and password
handlers._tokens.post = (data, callback) => {
  const phone = typeof data.payload.phone == 'string' && data.payload.phone.trim().length === 12 ? data.payload.phone.trim() : false;
  const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

  if (phone && password) {
    //lookup user who matches phone number
    _data.read('users', phone, (err, user) => {
      if (err) return callback(400, 'User not found')
      // user is valid
      // validate password by hashing and comparing with password sent
      const suppliedPassword = helpers.hash(data.payload.password)
      if (!suppliedPassword) return callback(500, { 'Error': 'Internal error. Unable to hash password' })
      if (user.password === suppliedPassword) {
        // create and return token
        const id = helpers.createRandomString(config.lengthOfToken)
        const expires = Date.now() + 1000 * 60 * 60
        const tokenObject = {
          phone,
          id,
          expires
        }
        // store token
        _data.create('tokens', id, tokenObject, (err, res) => {
          if (err) return callback(400, { 'Error': 'Unable to create token' })
          // return token to user
          return callback(200, tokenObject)
        })
      } else {
        callback(401, { 'Error': 'Password did not match.' })
      }

    })
  } else {
    callback(400, { 'Error': 'Missing required fields' })
  }
}

// GET handler for tokens
// required: id
handlers._tokens.get = (data, callback) => {
  const id = typeof data.queryStringObject.id == 'string' && data.queryStringObject.id.trim().length === config.lengthOfToken ? data.queryStringObject.id.trim() : false;
  if (id) {
    _data.read('tokens', id, (err, token) => {
      if (err) return callback(404, { 'Error': 'Token does not exist' })
      callback(200, token)
    })
  } else {
    return callback(400, { 'Error': 'Misssing required data' })
  }
}


// PUT handler for tokens
handlers._tokens.put = (data, callback) => {
  const id = typeof data.payload.id == 'string' && data.payload.id.trim().length === config.lengthOfToken ? data.payload.id.trim() : false;
  const extendFlag = typeof data.payload.extend == 'boolean' && data.payload.extend === true ? true : false;
  if (id && extendFlag) {
    _data.read('tokens', id, (err, token) => {
      if (err) return callback(404, { 'Error': 'Token does not exist' })
      // Ensure that the token has not expired first
      if (token.expires < Date.now()) return callback(403, { 'Error': 'Token is already expired' })
      // create new token object
      const tokenData = Object.assign({}, token, { 'expires': Date.now() + 1000 * 60 * 60 })
      _data.update('tokens', id, tokenData, err => {
        if (err) return callback(500, { 'Error': 'Internal error. Failed to extend token' });
        return callback(200, tokenData)
      })
    })
  } else {
    return callback(400, { 'Error': 'Misssing required data' })
  }
}

// DELETE handler for tokens
// Required data: id
handlers._tokens.delete = (data, callback) => {
  const id = typeof data.queryStringObject.id == 'string' && data.queryStringObject.id.trim().length === config.lengthOfToken ? data.queryStringObject.id.trim() : false;
  if (id) {
    _data.read('tokens', id, (err, token) => {
      if (err) return callback(404, { 'Error': 'Token does not exist' })
      _data.delete('tokens', id, err => {
        if (err) return callback(500, { 'Error': 'Internal error. Token was not deleted.' })
        callback(200)
      })
    })
  } else {
    return callback(400, { 'Error': 'Misssing required data' })
  }
}

// checks
handlers.checks = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'delete', 'put'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback)
  } else {
    callback(405)
  }
}

// Checks - container
handlers._checks = {}

// Checks - post
// Required data: protocal, url, method, successCodes, timeoutSeconds
// Optional data: none
handlers._checks.post = (data, callback) => {
  // validate data
  const protocol = typeof data.payload.protocol == 'string' && ['http', 'https'].indexOf(data.payload.protocol.trim()) > -1 ? data.payload.protocol.trim() : false;
  const url = typeof data.payload.url == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  const method = typeof data.payload.method == 'string' && ['post', 'get', 'put', 'delete', 'head'].indexOf(data.payload.method.trim()) > -1 ? data.payload.method.trim() : false;
  const successCodes = typeof data.payload.successCodes == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  const timeoutSeconds = typeof data.payload.timeoutSeconds == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 ? data.payload.timeoutSeconds : false;

  if (protocol && url && method && successCodes && timeoutSeconds) {
    const token = typeof data.headers.token == 'string' ? data.headers.token : false
    //validate token
    _data.read('tokens', token, (err, tokenData) => {
      // invalid token - not matched to user's phone
      if (err) return callback(403, { 'Error': 'Invalid token' })
      // Valid token 
      _data.read('users', tokenData.phone, (err, user) => {
        if (err) return callback(403, { 'Error': 'User not found' })
        const userChecks = typeof user.checks == 'object' && user.checks instanceof Array ? user.checks : []
        //verify that user has not exceeded checks limit
        if (userChecks.length < config.maxChecks) {
          //create random-Id for the checks
          const checkId = helpers.createRandomString(config.lengthOfToken)
          //object to hold check data
          const checkObject = {
            'id': checkId,
            'phone': user.phone,
            protocol,
            url,
            method,
            successCodes,
            timeoutSeconds
          }
          //create the check
          _data.create('checks', checkId, checkObject, err => {
            if (err) return callback(500, { 'Error': 'Internal error. Could not create the check' })
            //add the checkId to usersObject
            userChecks.push(checkId)
            user.checks = userChecks

            //save user data
            _data.update('users', user.phone, user, err => {
              if (err) return callback(500, { 'Error': 'Internal error. Could not update user data' })
              callback(200, checkObject)
            })
          })
        } else {
          callback(400, { 'Error': `User has reached maximum (${config.maxChecks}) number of checks allowed.` })
        }
      })
    })
  } else {
    callback(400, { 'Error': 'Missing required inputs or inputs are invalid' })
  }
}

// Checks - GET
// Required data: id
// Optional data: none
handlers._checks.get = (data, callback) => {
  // check that id is valid
  const id = typeof data.queryStringObject.id == 'string' && data.queryStringObject.id.trim().length === config.lengthOfToken ? data.queryStringObject.id.trim() : false;
  if (id) {
    // lookup the check
    _data.read('checks', id, (err, checkData) => {
      if (err) return callback(403)
      //get token from header and verify
      const token = typeof data.headers.token == 'string' ? data.headers.token.trim() : false

      handlers._tokens.verifyToken(token, checkData.phone, res => {
        // Invalid token - unathorized
        if (!res) return callback(403)
        // valid token, return check data
        callback(200, checkData)
      })
    })
  } else {
    return callback(400, { 'Error': 'Missing required field' })
  }
}

// Checks - PUT
// Required data: id
// Optional data (at least one): protocal, url, timeoutSeconds, successCodes
handlers._checks.put = (data, callback) => {
  const id = typeof data.payload.id == 'string' && data.payload.id.trim().length === config.lengthOfToken ? data.payload.id.trim() : false;
  // Optional fields
  const protocol = typeof data.payload.protocol == 'string' && ['http', 'https'].indexOf(data.payload.protocol.trim()) > -1 ? data.payload.protocol.trim() : false;
  const url = typeof data.payload.url == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  const method = typeof data.payload.method == 'string' && ['post', 'get', 'put', 'delete', 'head'].indexOf(data.payload.method.trim()) > -1 ? data.payload.method.trim() : false;
  const successCodes = typeof data.payload.successCodes == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  const timeoutSeconds = typeof data.payload.timeoutSeconds == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 ? data.payload.timeoutSeconds : false;

  if (id) {
    if (protocol || url || method || successCodes || timeoutSeconds) {
      _data.read('checks', id, (err, checkData) => {
        if (err) return callback(403)
        //get token from header and verify
        const token = typeof data.headers.token == 'string' ? data.headers.token.trim() : false

        handlers._tokens.verifyToken(token, checkData.phone, res => {
          // Invalid token - unathorized
          if (!res) return callback(403)
          // valid token
          const tempCheck = {
            protocol: protocol || checkData.protocol,
            url: url || checkData.url,
            method: method || checkData.method,
            successCodes: successCodes || checkData.successCodes,
            timeoutSeconds: timeoutSeconds || checkData.timeoutSeconds
          }
          //update check
          const updatedCheck = Object.assign({}, checkData, tempCheck)
          _data.update('checks', id, updatedCheck, err => {
            if (err) return callback(500, { 'Error': 'Internal error. Failed to update check' })
            callback(200, updatedCheck)
          })
        })
      })
    } else {
      return callback(400, { 'Error': 'Missing fields to update' })
    }
  } else {
    return callback(400, { 'Error': 'Missing required field' })
  }
}

// Checks - DELETE
// Required fields: id
// Optional fields: none
handlers._checks.delete = (data, callback) => {
  const id = typeof data.queryStringObject.id == 'string' && data.queryStringObject.id.trim().length === config.lengthOfToken ? data.queryStringObject.id.trim() : false;
  if (id) {
    // lookup the check
    _data.read('checks', id, (err, checkData) => {
      if (err) return callback(403)
      //get token from header and verify
      const token = typeof data.headers.token == 'string' ? data.headers.token.trim() : false

      handlers._tokens.verifyToken(token, checkData.phone, res => {
        // Invalid token - unathorized
        if (!res) return callback(403)
        // valid token, return check data
        _data.delete('checks', id, err => {
          if (err) return callback(500, { 'Error': 'Internal error. Unable to delete check' })
          _data.read('users', checkData.phone, (err, userData) => {
            if (err) return callback(404)
            const checks = userData.checks.filter(checkId => checkId !== id)
            //update user checks 
            const user = Object.assign({}, userData, { checks })
            _data.update('users', userData.phone, user, err => {
              if (err) return callback(500, { 'Error': 'Failed to update user object' })
              callback(200)
            })
          })
        })
      })
    })
  } else {
    return callback(400, { 'Error': 'Misssing required data' })
  }
}

// General function to match a token to a phone
handlers._tokens.verifyToken = (id, phone, callback) => {
  // lookup token by id
  _data.read('tokens', id, (err, user) => {
    if (err) return callback(false)
    if (user.phone === phone && user.expires > Date.now()) {
      return callback(true)
    } else {
      return callback(false)
    }
  })
}

//sample handler
handlers.ping = (data, callback) => {
  //callback a http status code and a payload object
  callback(200)
}

//Not found handler
handlers.notFound = (data, callback) => {
  callback(404)
}

module.exports = handlers