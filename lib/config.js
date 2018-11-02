/*
*create and export configuation variables
*
*/

//container for all environments
const environments = {}

//staging (default) environemnt
environments.staging = {
  envname: 'staging',
  httpPort: 3000,
  httpsPort: 3001,
  hashingSecret: 'karibu123',
  lengthOfToken: 20,
  maxCheck: 5,
  twilio: {
    accountSid: 'ACb32d411ad7fe886aac54c665d25e5c5d',
    authToken: '9455e3eb3109edc12e3d8c92768f7a67',
    fromPhone: '+15005550006'
  },
  templateGlobals: {
    appName: 'Uptime Checker',
    yearCreated: '2018',
    companyName: 'Watcher, Inc.',
    baseUrl: 'http://localhost:3000/'
  }

}

//production environment
environments.production = {
  'envname': 'production',
  'httpPort': 8080,
  'httpsPort': 8081,
  'hashingSecret': 'karibu123',
  'lengthOfToken': 20,
  'maxChecks': 5,
  'twilio': {
    'accountSid': 'ACb32d411ad7fe886aac54c665d25e5c5d',
    'authToken': '9455e3eb3109edc12e3d8c92768f7a67',
    'fromPhone': '+15005550006'
  },
  templateGlobals: {
    appName: 'Uptime Checker',
    yearCreated: '2018',
    companyName: 'Watcher, Inc.',
    baseUrl: 'http://localhost:8080/'
  }
}

//determine which environment to export
const currentENV = typeof(process.NODE_ENV) == 'string' ? process.NODE_ENV.toLowerCase() : '';
const envToExport = typeof(environments[currentENV]) == 'object' ? environments[currentENV] : environments.staging;

module.exports = envToExport;