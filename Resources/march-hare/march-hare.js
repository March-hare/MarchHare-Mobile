// TODO: i18n inegration
var MarchHare = {
  ui: {},
  database: {},
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
    }
  }
};

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
