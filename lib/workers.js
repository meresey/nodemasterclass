/*
*Worker related tasks
*
*
*/

// Dependencies
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const url = require('url')
const helpers = require('./helpers')
const _data = require('./data')
const config = require('./config')
const _logs = require('./logs')
const util = require('util')

const debug = util.debuglog('workers')

// Instantiate the worker object
const workers = {}

// Execure all checks
workers.gatherAllChecks = () => {
  _data.list('checks', (err, checks) => {
    if (err) return console.log(err)
    if (checks.length == 0) {
      debug('No checks to process')
    } else {
      checks.forEach(check => {
        // Read in check data
        _data.read('checks', check, (err, checkData) => {
          if (err) return debug(`Error reading check data from file: ${err}`)
          workers.validateCheckData(checkData)
        })
      })
    }
  })
}

// Sanity check data
workers.validateCheckData = checkData => {
   checkData = typeof checkData == 'object' && checkData !== null ? checkData : {}
  checkData.id = typeof checkData.id == 'string' && checkData.id.length === config.lengthOfToken ? checkData.id : false
  checkData.phone = typeof checkData.phone == 'string' && checkData.phone.length === 12 ? checkData.phone : false
  checkData.protocol = typeof checkData.protocol == 'string' && ['http', 'https'].indexOf(checkData.protocol.trim()) > -1 ? checkData.protocol.trim() : false
  checkData.url = typeof checkData.url == 'string' && checkData.url.trim().length > 0 ? checkData.url.trim() : false
  checkData.method = typeof checkData.method == 'string' && ['post', 'get', 'put', 'delete', 'head'].indexOf(checkData.method.trim()) > -1 ? checkData.method.trim() : false
  checkData.successCodes = typeof checkData.successCodes == 'object' && checkData.successCodes instanceof Array && checkData.successCodes.length > 0 ? checkData.successCodes : false
  checkData.timeoutSeconds = typeof checkData.timeoutSeconds == 'number' && checkData.timeoutSeconds % 1 === 0 && checkData.timeoutSeconds >= 1 ? checkData.timeoutSeconds : false

  // New properties for the check object 
  checkData.state = typeof checkData.state == 'string' && ['up', 'down'].indexOf(checkData.state) > -1 ? checkData.state : 'down'
  checkData.lastChecked = typeof checkData.lastChecked == 'number' && checkData.lastChecked > 0 ? checkData.lastChecked : 0
  // if all the checks pass, call the next function
  if (Object.values(checkData).indexOf(false) === -1) {
    //console.log(checkData)
    workers.performCheck(checkData)
  } else {
    const invalidData = Object.keys(checkData).filter(key => {
      checkData[key] = false
    })
    debug(`Check with key: ${checkData.id} has invalid data in: ${invalidData.toString()}. Check will be skipped`)
  }
}

// Pefrom the check
workers.performCheck = checkData => {
  // prepare check outcome object
  let checkOutcome = {
    'error': false,
    'responseCode': false
  }

  // mark that the outome has not been sent yet
  let outcomeSent = false
  // Parse url
  const parsedUrl = url.parse(`${checkData.protocol}://${checkData.url}`, true)
  const hostname = parsedUrl.hostname
  const path = parsedUrl.path

  // construct the request
  const requestDetails = {
    'protocol': checkData.protocol + ':',
    hostname,
    'method': checkData.method.toUpperCase(),
    path,
    'timeout': checkData.timeoutSeconds * 1000
  }

  // Instantiate request object using either http or https
  const _moduleTouse = checkData.protocol === 'http' ? http : https

  const req = _moduleTouse.request(requestDetails, res => {
    //const status = res.statusCode
    // Update check outome
    checkOutcome.responseCode = res.statusCode
    if (!outcomeSent) {
      workers.processCheckOutcome(checkData, checkOutcome)
      outcomeSent = true
    }
  })

  // bind to error 
  req.on('error', e => {
    // update checkOutcome
    checkOutcome.error = {
      'error': true,
      'value': e
    };
    if (!outcomeSent) {
      workers.processCheckOutcome(checkData, checkOutcome)
      outcomeSent = true
    }
  })

  // bind to timeout
  req.on('timeout', e => {
    // update checkOutcome
    checkOutcome.error = {
      'error': true,
      'value': 'timeout'
    };
    if (!outcomeSent) {
      workers.processCheckOutcome(checkData, checkOutcome)
      outcomeSent = true
    }
  })

  // End the request
  req.end()
}

// process checkOutcome , update check data and trigger alert to user
workers.processCheckOutcome = (checkData, checkOutcome) => {
  // Decide if check is up or down
  const state = !checkOutcome.error && checkOutcome.responseCode && checkData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down'
  // Decide if alert is warranted
  const alertFlag = checkData.lastChecked && checkData.state !== state ? true : false
  // Set last checked timestamp
  const lastChecked = Date.now()
  // Update check data
  const newCheckData = Object.assign({}, checkData, {
    state,
    lastChecked
  })

  // Log the outcome
  workers.log(checkData,checkOutcome,state,alertFlag,lastChecked)

  //save the updates
  _data.update('checks', newCheckData.id, newCheckData, err => {
    if (err) return debug('Internal error. Unable to save check data')
    if (alertFlag) {
      workers.alertUserToStatusChange(newCheckData)
    } else {
      debug('Check outcome has not changed, no alert needed')
    }
  })

}

// Alert user to status change
workers.alertUserToStatusChange = (newCheckData) => {
  const msg = `Alert: Your check for ${newCheckData.method} ${newCheckData.protocol}://${newCheckData.url} is currently ${newCheckData.state}`
  helpers.sendTwilioSMS(newCheckData.phone, msg, err => {
    if (err) return debug('Sending alert failed')
    debug('Alert sent to user: ', msg)
  })
}

// Log function
workers.log = (check,outcome,state,alert,time) => {
  // Form the log data
  var logData = {
    check,
    outcome,
    state,
    alert,
    time
  }

  // Convert data to a string
  var logString = JSON.stringify(logData)

  // Determine the name of the logfile
  const logfileName = check.id 

  // Append the logstring to file
  _logs.append(logfileName,logString, err => {
    if (err) return debug('Logging to file failed')
    debug('Logging to file succeeded')
  })
}

// Timer to execute checks every minute
workers.schedule = () => {
  setInterval(() => {
    workers.gatherAllChecks()
  }, 1000 * 5)
}

// Rotate logs
workers.rotateLogs = () => {
  // list all the non-compressed log files
  _logs.list(false, (err, logs) => {
    if (err) return debug('Error encountered listing log files')
    logs.forEach(log => {
      // compress data to a different file
      const logId = log.replace('.logs','')
      const newId = `${logId}-${Date.now()}`
      _logs.compress(logId, newId, err => {
        if (err) return debug(`Error compressing the log file: ${err}`)
        //Truncating log
        _logs.truncate(logId, err => {
          if (err) return debug(`Error truncating the log: ${err}`)
          debug('Successfully truncated file.')

        })
      })
    })
  })
}

// Schedule log rotation
workers.scheduleLogRotation = () => {
  setInterval(() => {
    workers.rotateLogs()
  }, 1000*60*60*24)
}

// Init function
workers.init = () => {
  // Execute all the checks immediately
  console.log('\x1b[33m%s\x1b[0m', `Background workers are starting`);
  workers.gatherAllChecks()
  // Call the loop so the check will execute later
  workers.schedule()

  // Rotate logs immediately
  workers.rotateLogs()

  // Schedule log rotation
  workers.scheduleLogRotation()
}

// Export module
module.exports = workers