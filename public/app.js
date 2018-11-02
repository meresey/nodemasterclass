/*
* Front-end logic for the application
*
*/

// container for frontend application
var app = {}


// config
app.config = {
  sessionToken: false
}

// AJAX client for the REST api
app.client = {}

// Interface for making API calls
app.client.request = function (headers, path, method, queryStringObject, payload, callback) {
  // set defaults
  headers = typeof headers == 'object' && headers !== null ? headers : {}
  path = typeof path == 'string' ? path : '/'
  method = typeof method == 'string' && ['POST', 'GET', 'DELETE', 'PUT'].indexOf(method.toUpperCase()) > -1 ? method.toUpperCase() : 'GET'
  queryStringObject = typeof queryStringObject == 'object' && queryStringObject !== null ? queryStringObject : {}
  payload = typeof payload == 'object' && payload !== null ? payload : {}
  callback = typeof callback == 'function' ? callback : false

  // For each query string parameter add it to the path
  var requestUrl = path + '?'
  var counter = 0
  for (var queryKey in queryStringObject) {
    if (queryStringObject.hasOwnProperty(queryKey)) {
      counter++
      // check if the query string already has at least one parameter, in which case append ampersand to the query string
      if (counter > 1) {
        requestUrl += '&'
      }
      // add the key value
      requestUrl += queryKey + '=' + queryStringObject[queryKey]
    }
  }

  // form the http request as a JSON object
  var xhr = new XMLHttpRequest()
  xhr.open(method, requestUrl, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  // for each other header sent,add it to the request
  for (var headerKey in headers) {
    if (headers.hasOwnProperty(headerKey)) {
      xhr.setRequestHeader(headerKey, headers[headerKey])
    }
  }

  // if there is a session token add it to the headers
  if (app.config.sessionToken) {
    xhr.setRequestHeader('id', app.config.sessionToken)
  }

  // handle response
  xhr.onreadystatechange = function () {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      var statusCode = xhr.status
      var resposeReturned = xhr.responseText

      // callback if provided
      if (callback) {
        try {
          var parsedResponse = JSON.parse(resposeReturned)
          callback(statusCode, parsedResponse)
        } catch (e) {

          callback(statusCode, null)
        }
      }
    }
  }
  // finally send the request with the payload
  var payloadString = JSON.stringify(payload)
  xhr.send(payloadString)
}


// Alternative method using fetch API
app.client.fetch = function(headers, path, method, queryStringObject, payload) {
  // validate and set defaults for all arguments
  headers = typeof headers == 'object' && headers !== null ? headers : {}
  path = typeof path == 'string' ? path : '/'
  method = typeof method == 'string' && ['POST', 'GET', 'DELETE', 'PUT'].indexOf(method.toUpperCase()) > -1 ? method.toUpperCase() : 'GET'
  queryStringObject = typeof queryStringObject == 'object' && queryStringObject !== null ? queryStringObject : {}
  payload = typeof payload == 'object' && payload !== null ? payload : {}
  // Declare and initialize requestUrl
  var requestUrl = path + '?'
  // Declare and initialize variable that will hold all headers supplied as part of the request
  var urlHeaders = {}
  // for each other header sent,add it to the headers variable
  for (var headerKey in headers) {
    if (headers.hasOwnProperty(headerKey)) {
      urlHeaders(headerKey, headers[headerKey])
    }
  }

  // Declare flag to determine if url querystring already contains a parameter
  var counter = 0
  for (var queryKey in queryStringObject) {
    if (queryStringObject.hasOwnProperty(queryKey)) {
      counter++
      // check if the query string already has at least one parameter, in which case append ampersand to the query string
      if (counter > 1) {
        requestUrl += '&'
      }
      // add the key value
      requestUrl += queryKey + '=' + queryStringObject[queryKey]
    }
  }
  // Initialize options object for the fetch function
  var options = {
    method,
    mode: 'cors',
    cache: 'no-cache',
    headers: Object.assign({"Content-Type": "application/json; charset=utf-8"},urlHeaders),
    credentials: "same-origin",
    body: ['GET','HEAD'].indexOf(method) > -1 ? null : payload
  }
  
  // 
    fetch(requestUrl, options)
    .then(response => response.json())
    .then(data => console.log(JSON.stringify(data)))
    .catch(error => console.error(error));
}