const AWS = require('aws-sdk');
const https = require('https');
const url = require('url');

const cisp = new AWS.CognitoIdentityServiceProvider({ 'apiVersion': '2016-04-18' });

function checkProps (props, obj) {
  let ok = true;
  if (Object.getOwnPropertyNames(obj).length === 0) ok = false;
  props.forEach(p => {
    if (!obj.hasOwnProperty(p)) ok = false;
  });
  return ok;
}

function handleRequest (event, context, method, props) {
  let err = null;
  if (checkProps(props, event.ResourceProperties)) {
    // Fill parameters
    const params = {};
    props.forEach(p => {
      if (p !== 'Scopes') params[p] = event.ResourceProperties[p];
    });

    // Check for scopes
    if (props.includes('Scopes')) {
      params['Scopes'] = [];
      event.ResourceProperties.Scopes.forEach(scope => {
        if (scope.hasOwnProperty('Name') && scope.hasOwnProperty('Description')) {
          params.Scopes.push({ 'ScopeName': scope.Name, 'ScopeDescription': scope.Description });
        } else {
          err = 'Invalid scope:\n'+JSON.stringify(scope);
        }
      });
    }

    // Trigger request
    cisp[method](params).promise()
      .then(result => {
        console.log(result);
        sendResponse(event, context, 'SUCCESS');
      })
      .catch(err => {
        console.log(err);
        sendResponse(event, context, 'FAILED', { error: err });
      });
  } else {
    console.log('Not all necessary ResourceProperties specified!');
    sendResponse(event, context, 'FAILED', { error: err });
  }
}

exports.handler = function (event, context, callback) {
  try {
    // Install watchdog timer as the first thing
    setupWatchdogTimer(event, context, callback);

    console.log(JSON.stringify(event));

    if (event.RequestType === 'Create') {
      handleRequest(event, context, 'createResourceServer', ['Identifier', 'Name', 'UserPoolId', 'Scopes']);
    } else if (event.RequestType === 'Update') {
      handleRequest(event, context, 'updateResourceServer', ['Identifier', 'Name', 'UserPoolId', 'Scopes']);
    } else if (event.RequestType === 'Delete') {
      handleRequest(event, context, 'deleteResourceServer', ['Identifier', 'UserPoolId']);
    }
  } catch (err) {
    console.log(err);
    sendResponse(event, context, 'FAILED');
  }
}

function setupWatchdogTimer (event, context, callback) {
  const timeoutHandler = () => {
    console.log('Timeout FAILURE!');
    // Emit event to 'response', then callback with an error from this
    // function
    new Promise(() => sendResponse(event, context, 'FAILED'))
      .then(() => callback(new Error('Function timed out')))
  }
  // Set timer so it triggers one second before this function would timeout
  setTimeout(timeoutHandler, context.getRemainingTimeInMillis() - 1000);
}

// Send response to the pre-signed S3 URL
function sendResponse (event, context, responseStatus, responseData) {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: (responseData && JSON.stringify(responseData.error) ? responseData.error : '-'), //'See: ' + context.logStreamName,
    PhysicalResourceId: event.LogicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  });

  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length
    }
  };

  const request = https.request(options, function (response) {
    // Tell AWS Lambda that the function execution is done
    context.done();
  });

  request.on('error', function (error) {
    // Tell AWS Lambda that the function execution is done
    context.done();
  });

  // write data to request body
  request.write(responseBody);
  request.end();
}