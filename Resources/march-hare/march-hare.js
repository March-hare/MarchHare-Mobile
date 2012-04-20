// TODO: i18n inegration
var MarchHare = {
  ui: {},
  database: {},
  xhr: Ti.Network.createHTTPClient(),
  xhrGetSemaphore: function() {
    if (MarchHare.xhrSemaphore) {
      return false;
    } else {
      return MarchHare.xhrSemaphore = true;
    }
  },
  xhrReleaseSemaphore: function() {
    MarchHare.xhrSemaphore = false;
  },
  xhrLogServerError: function(e, url) {
    // TODO: we want to notify the user somehow, but we dont want to 
    // send an alert for each failure.  Maybe we can store the error 
    // statistics somehow and display them to the user in a menu somewhere
    Ti.API.debug("STATUS: " + this.status);
    Ti.API.debug("TEXT: " + this.responseText);
    Ti.API.debug("ERROR: " + e.error);
    Ti.API.error('Failied URL: '+ url);
  },
  xhrSemaphore: false,
  xhrProcess: function (parameters) {
    // There is no garentee that your web request will happen when you request 
    // it.  Creating multiple http clients consumes a lot of memory.  We use a 
    // semaphore here to make sure we only have one process ata a time.  It is 
    // expected that this function is called after the semaphore is obtained,
    // failure to do so will cause breakage!
    MarchHare.xhr.setOnerror(function(e) {
      MarchHare.xhrLogServerError(e, parameters.url);
      MarchHare.xhrReleaseSemaphore();
    });

    MarchHare.xhr.setOnload(function() {
      parameters.onload(this.responseText);
      MarchHare.xhrReleaseSemaphore();
    });

    MarchHare.xhr.open("GET", parameters.url);
    Ti.API.debug('MarchHare.xhrProcess url: '+ parameters.url);
    MarchHare.xhr.send();
  },
  settings: {
    action_domain: {
      title: 'Action Domain',
      default_value: 'ushahidi.march-hare.org',
      func: Ti.App.Properties.setString, 
      verify: verifyActionDomain
    },
    latitude: {
      title: 'Lattitude',
      default_value: '41.889818923027',
      // TODO: figure out if this can actually handle a geo position
      func: Ti.App.Properties.setDouble, 
      verify: function(){}
    },
    longitude: {
      title: 'Longitude',
      default_value: '-87.637596505706',
      // TODO: figure out if this can actually handle a geo position
      func: Ti.App.Properties.setDouble, 
      verify: function(){}
    },
    // TODO: should this be remembered persistently, updated when the user
    // changes it through the OpenLayers Controls?
    zoom: {
      title: 'Zoom Level',
      default_value: '15',
      // TODO: figure out if this can actually handle a geo position
      func: Ti.App.Properties.setInt, 
      verify: function(){}
    },
    poll: {
      title: 'Poll Interval in Seconds',
      default_value: '30',
      func: Ti.App.Properties.setInt, 
      verify: function(){}
    },
    gpsFollow: {
      title: 'Position map based on GPS',
      default_value: 'false',
    }
  }
};

MarchHare.xhr.setTimeout(5000);


function verifyActionDomain(domain) {
  Ti.API.debug('verifyActionDomain domain: '+ domain);
  // verify that the domain is of valid format
  var v = new RegExp();
  v.compile("^[A-Za-z0-9-_]+\\.[A-Za-z0-9-_\\.]+$");
  if (!v.test(domain)) {
    return { result: false, message: 'invalid action domain  syntax' };
  }  

  // verify that we get an HTTP 200 from the ushahidi jsonp URL

  return { result: true, message: 'action_domain verified' };
}

Ti.API.debug('march-hare.js loaded');
