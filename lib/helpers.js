/*
* Helpers for various tasks
*
*/

// Dependecies
const crypto = require('crypto')
const https = require('https')
const querystring = require('querystring')
const path = require('path')
const fs = require('fs')

const config = require('./config')

// Container for all helper functions
const helpers = {}

helpers.hash = password => {
  if (typeof(password) == 'string' && password.length > 0 ) {
    const hash = crypto.createHmac('sha256', config.hashingSecret).update(password).digest('hex')
    return hash;
  }
}

helpers.parseToJSON = str => {
  try {
    return JSON.parse(str)
  } catch(e) {
    return {}
  }
}

helpers.filterUserFields = user => ({
  'firstName': user.firstName,
  'lastName':user.lastName,
  'phone':user.phone,
})

helpers.createRandomString = len => {
  const alphaNumeric = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let str = ''
  for (let i=1; i<=len; i++) {
    let randomChar = alphaNumeric.charAt(Math.floor(Math.random()*alphaNumeric.length))
    str += randomChar
  } 
  return str
}

// Twilio SMS sender
helpers.sendTwilioSMS = (phone,message,callback) => {
  const toPhone = typeof phone == 'string' && phone.trim().length === 12 ? phone.trim() : false;
  const msg = typeof message == 'string' && message.trim().length > 0 && message.trim().length <= 1600 ? message : false;
  if (toPhone && msg) {
    // configure the request payload
    const payload = {
      'From' : config.twilio.fromPhone,
      'To': `+${toPhone}`,
      'Body': msg
    }
    //stringify payload
    const stringPayload = querystring.stringify(payload)
    //configure request details
    const requestDetails = {
      'protocol': 'https:',
      'hostname': 'api.twilio.com',
      'method': 'POST',
      'path': `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
      'auth': `${config.twilio.accountSid}:${config.twilio.authToken}`,
      'headers' : {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload)
      }
    }
    // instantiate request
    const req = https.request(requestDetails, res => {
      if (res.statusCode == 200 || res.statusCode == 201) {
        callback(null)
      } else {
        callback(`Statuscode returned: ${res.statusCode}`)
      }  
    })
    // Bind to the error event so that it doesn't get thrown
    req.on('error', err => {
      callback(err)
    })

    // Add the payload
    req.write(stringPayload)

    //End the request
    req.end()

  } else {
    callback('Given parameters were invalid or missing')
  }
}

// Get the string content of a template
helpers.getTemplate = (templateName, data, callback) => {
  templateName = typeof templateName == 'string' && templateName.length > 0 ? templateName : ''
  data = typeof data == 'object' && data !== null ? data : {}
  // template name is invalid
  if (!templateName) return callback('Invalid template name')
  // Read in the teamplate file
  const templatesDir = path.join(__dirname, '../', 'templates')
  fs.readFile(path.join(templatesDir,templateName+'.html'), (err, templateData) => {
    if (err) return callback('Invalid template')
    // Interpolate returned string
    const finalString = helpers.interpolate(templateData.toString(),data)
    callback(null, finalString)
  })
}

// Take a given string and a data object andn find/replace all they keys within it
helpers.interpolate = (str,data) => {
  // sanity check provided arguments
  str = typeof str == 'string' && str.length > 0 ? str : ''
  data = typeof data == 'object' && data !== null ? data : {}

  // Add the template globals to the data object, prepending their key name with 'global'
  for (let keyName in config.templateGlobals) {
    if(config.templateGlobals.hasOwnProperty(keyName)) {
      data[`globals.${keyName}`] = config.templateGlobals[keyName]
    }
  }

  // For each key in the data object , insert its value into the stringat the corresponding data object
  for (let key in data) {
    if (data.hasOwnProperty(key) && typeof data[key] == 'string') {
      const replace = data[key]
      const find = `{${key}}`
      str = str = str.replace(find,replace)
    }
  }
  return str
}

// Add the universal header and footer to a string and pass provided hea
helpers.addUniversalTemplates = (str, data, callback) => {
  // sanity check provided arguments
  str = typeof str == 'string' && str.length > 0 ? str : ''
  data = typeof data == 'object' && data !== null ? data : {}
  //Get the header
  helpers.getTemplate('_header', data,(errHeader,headerString) => {
    if (errHeader) return callback('Could not find header template')
    helpers.getTemplate('_footer', data, (errFooter,footerString) => {
      if (errFooter) return callback('cloud not find footer template')
      // Add them all together
      const fullString = `${headerString}${str}${footerString}`
      callback(null, fullString)
    })
  })
}

// get the contents of a static asset
helpers.getStaticAsset = (fileName, callback) => {
  fileName = typeof fileName == 'string' && fileName.length > 0 ? fileName : false
  if (!fileName) return callback('A valid filename has not been provided')

  const publicDir = path.join(__dirname, '../public')
  fs.readFile(path.join(publicDir,fileName), (err, data) => {
    if (err) return callback('No file could be found')
    callback(null, data)
  })

}

module.exports = helpers;