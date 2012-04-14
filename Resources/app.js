var DEV = true;
Ti.App.Properties.setBool('map_initialized', false);

// this sets the background color of the master UIView (when there are no windows/tab groups on it)
Titanium.UI.setBackgroundColor('#000');
Ti.API.debug('including the app helpers and windows');

Ti.include(
    'march-hare/march-hare.js',
    'windows/Settings.js',
    'windows/Map.js',
    'windows/Reports.js',
    'march-hare/database.js'
    );

MarchHare.database.testDatabase();

var reportsInitialized = false;
var win = MarchHare.ui.createMapWindow();
win.open();

// We dont have any control over how frequently the actual device polls.
setInterval(updateGeoLocation, 1*60*1000 /* minutes * seconds * milliseconds */);

// The benefit of polling for reports in the main code is so that we can trigger
// phone based events like alerts if the incident list changes
if (DEV) { flushIncidents(); }
initializeCategories();

// TODO: in testing I have noticed that this completes before the MapWindow is 
// open with the defaut poll interval (30 s) this does not matter much if we do 
// not call pollReports() till after the interval, but if the user sets a longer
// poll interval it will wait that long before maps show up.
pollForReports();
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
  var initialized = Ti.App.Properties.setBool('map_initialized', false);

  var lastpoll = Ti.App.Properties.getBool('lastpoll', '1970-01-01');
  var url = 'http://'+ 
      Ti.App.Properties.getString('action_domain',
      MarchHare.settings.action_domain.default_value)+
      '/api/?task=decayimage&by=sincedate&date='+lastpoll;

  // Pulled from example here: http://bit.ly/n5YWdz
  var xhr = Ti.Network.createHTTPClient({
    onload: function(){

      // Suggested for handling memory issues: http://bit.ly/HyT9qa
      xhr = null;

      var jNewIncidents = JSON.parse(this.responseText);
      var newIncidents = false;

      if (
        typeof jNewIncidents == 'undefined' ||
        typeof jNewIncidents.payload == 'undefined' ||
        typeof jNewIncidents.payload.incidents == 'undefined' ||
        !(jNewIncidents.payload.features instanceof Array)
        ) {
        Ti.API.error('pollReports: recieved invalid json from the server: '+
          JSON.stringify(jNewIncidents));
        return false;
      }
    
      for ( var i  in jNewIncidents.payload.incidents) {
        newIncidents = true;
        var incident = {
          incident: {
            incidentid: i.incident.incidentid,
            incidenttitle: i.incident.incidenttitle,
            incidentdescription: i.incident.incidentdescription,
            incidentdate: i.incident.incidentdate,
            incidentlatitude: i.incident.locationlatitude,
            incidentlongitude: i.incident.locationlongitude,
          },
          categories: i.categories
        };

        if (getIncident(incident)) {
          updateIncident(incident);
        } else {
          setIncident(incident);
        }
      }

      if (newIncidents || !initialized) {
        Ti.API.debug('pollReports: firing updateReports event, map_initialized: '+
          initialized +', newIncidents: '+ newIncidents);
        Ti.App.fireEvent('updateReports', getIncidents());
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

  // Does this help?
  xhr = null;
  incidents = null;
  jIncidents = null;
}
