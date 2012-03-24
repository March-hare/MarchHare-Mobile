// this sets the background color of the master UIView (when there are no windows/tab groups on it)
Titanium.UI.setBackgroundColor('#000');
Ti.API.debug('including the app helpers and windows');

Ti.include(
    'march-hare/march-hare.js',
    'windows/Settings.js',
    'windows/Map.js'
    );

var reportsInitialized = false;
var win = MarchHare.ui.createMapWindow();
win.open();

// We dont have any control over how frequently the actual device polls.
setInterval(updateGeoLocation, 1*60*1000 /* minutes * seconds * milliseconds */);

// The benefit of polling for reports in the main code is so that we can trigger
// phone based events like alerts if the incident list changes
setInterval(pollForReports, 
    Ti.App.Properties.getString('poll', MarchHare.settings.poll.default_value) 
    *1000 /* seconds * milliseconds */);

function updateGeoLocation() {
  // Titanium.Geolocation.getCurrentPosition: http://bit.ly/GEe76Q
  Titanium.Geolocation.getCurrentPosition(function(location) {
    // Titanium.Geolocation.location: http://bit.ly/GG6qri
    // If this is an error, handle it the best we can
    if (location.success) {
      Ti.API.error('There was a problem getting geolocation code:'+
        location.code +' message: '+ location.error);
      alert('Geolocation Error: '+ location.error);
    }
    
    // Fire an application event with the new geolocation data if we have it
    Ti.App.fireEvent('updateGeolocation', {
      lat: location.latitude,
      lon: location.longitude
    });

  });
}

function pollForReports() {
  var url = 'http://'+ 
      Ti.App.Properties.getString('action_domain',
      MarchHare.settings.action_domain.default_value)+
      '/decayimage/json';

  var incidents = 
    Ti.App.Properties.getString('incidents',
      MarchHare.settings.incidents.default_value);

  // Pulled from example here: http://bit.ly/n5YWdz
  var xhr = Ti.Network.createHTTPClient({
    onload: function(){
      var json = JSON.parse(this.responseText);
      if ((JSON.stringify(json) != incidents) || !reportsInitialized){
         Ti.App.Properties.setString('incidents', JSON.stringify(json));
         Ti.API.debug('pollReports: firing updateReports event');
         Ti.App.fireEvent('updateReports', Ti.App.Properties.getString('incidents'));
         if (!reportsInitialized) {
           reportsInitialized = true;
         }
      } else {
        Ti.API.debug('pollReports: not updating because we did not recieve any new reports');
      }
    },
    onerror: function(e) {
      // TODO: we want to notify the user somehow, but we dont want to 
      // send an alert for each failure.  Maybe we can store the error 
      // statistics somehow and display them to the user in a menu somewhere
      Ti.API.debug("STATUS: " + this.status);
      Ti.API.debug("TEXT: " + this.responseText);
      Ti.API.debug("ERROR: " + e.error);
      Ti.API.error('Unable to get json from: '+ url);
    },
    timeout: 5000
  });
  
  xhr.open("GET", url);
  xhr.send();
}
