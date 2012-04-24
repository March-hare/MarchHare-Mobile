var DEV = true;
var POLLING = false;
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

//MarchHare.database.testDatabase();

var reportsInitialized = false;

var win = MarchHare.ui.createMapWindow();
win.open();

// The benefit of polling for reports in the main code is so that we can trigger
// phone based events like alerts if the incident list changes
// TODO: test with these settings off
if (DEV) { 
  Ti.App.Properties.setString('lastpoll', '1970-01-01');
  MarchHare.database.flushIncidents(); 
  MarchHare.database.flushIncidentCategories(); 
  MarchHare.database.flushCategories();
  Ti.App.Properties.setInt('poll', MarchHare.settings.poll.default_value);
}
MarchHare.database.initializeCategories();

// TODO: in testing I have noticed that this completes before the MapWindow is 
// open with the defaut poll interval (30 s) this does not matter much if we do 
// not call pollReports() till after the interval, but if the user sets a longer
// poll interval it will wait that long before maps show up. The readyForReports
// event is only fired in js/reports.js after the map settings are recieved. 
// This is a good time to call pollForReports for the intial report list.  There
// is the possibility that the poll value could be set so fast (=~10s) that it 
// would be called before or during the initial pollForReports
Ti.App.addEventListener('readyForReports', function() {
  pollForReports();
});

// TODO: There is a possibility that we will already be in pollReports when we
// recieve this event.  Which means we have a race condition.  The effects
// of this should be investigated.
Ti.App.addEventListener('actionDomainChanged', function() {
  Ti.API.debug('actionDomainChanged event recieved, updating system');
  Ti.App.Properties.setString('lastpoll', '1970-01-01');
  MarchHare.database.flushIncidents(); 
  MarchHare.database.flushIncidentCategories(); 
  MarchHare.database.flushCategories(); 
  MarchHare.database.initializeCategories();
  pollForReports();
});

var pollInterval;
Ti.App.addEventListener('mapInitialized', function() {
  Ti.API.debug('mapInitialized event recieved');
  Ti.App.Properties.setBool('map_initialized', true);
  Ti.API.debug('polling for new reports every '+
    Ti.App.Properties.getInt('poll', MarchHare.settings.poll.default_value)*1000 +
    ' seconds');
  pollInterval = setInterval(pollForReports, 
    Ti.App.Properties.getInt('poll', MarchHare.settings.poll.default_value) 
    *1000 /* seconds * milliseconds */);
});

Ti.App.addEventListener('pollIntervalChanged', function() {
  Ti.API.debug('pollIntervalChanged event recieved, updating poll interval');
  clearInterval(pollInterval);
  pollInterval = setInterval(pollForReports, 
    Ti.App.Properties.getString('poll', MarchHare.settings.poll.default_value) 
    *1000 /* seconds * milliseconds */);
});

function pollForReports() {
  if (POLLING) { return; }

  POLLING = true;
  var lastpoll = Ti.App.Properties.getString('lastpoll', '1970-01-01');
  var url = 'http://'+ 
      Ti.App.Properties.getString('action_domain',
      MarchHare.settings.action_domain.default_value)+
      '/api/?task=decayimage&by=sincedate&date='+lastpoll;

  // TODO: start an indicator
  var t = setInterval(function() {

    // If we cant set the semaphore then we do not have access to the HTTP 
    // Client yet.
    if (!MarchHare.xhrGetSemaphore()) {
      Ti.API.info('Delaying reports request because the HTTP Client is in use.');
      return;
    }

    MarchHare.xhrProcess({
      url: url,
      onload: handleServerResponse
    });

    clearInterval(t);
    POLLING = false;
  }, 100);
}

function handleServerResponse(response) {
  var jNewIncidents = JSON.parse(response);
  var newIncidents = false;
  var initialized = Ti.App.Properties.getBool('map_initialized', false);
  var error = false;

  if (
    typeof jNewIncidents == 'undefined' ||
    typeof jNewIncidents.payload == 'undefined' ||
    typeof jNewIncidents.payload.incidents == 'undefined' ||
    !(jNewIncidents.payload.incidents instanceof Array)
    ) {

    // It may just be the case that we have not recieved any data back 
    // from our request
    if (
      typeof jNewIncidents.error.code != 'undefined' && 
      (jNewIncidents.error.code == "007") && 
      typeof jNewIncidents.error.message != 'undefined'
    ) {
      Ti.API.info('pollReports: '+ jNewIncidents.error.message);
      Ti.App.Properties.setString('lastpoll', new Date().toISOString());
    }
    else {
      Ti.API.error('pollReports: recieved invalid json from the server: '+
        JSON.stringify(jNewIncidents));
      error = true;
    }
  } else {

    // TODO: this finishes before the settings are sent to the map, so it does
    // not actually load until after the next poll
    for ( var i  in jNewIncidents.payload.incidents) {
      newIncidents = true;
      var incident = {
        incident: {
          incidentid: jNewIncidents.payload.incidents[i].incident.incidentid,
          incidenttitle: jNewIncidents.payload.incidents[i].incident.incidenttitle,
          incidentdescription: jNewIncidents.payload.incidents[i].incident.incidentdescription,
          incidentdate: jNewIncidents.payload.incidents[i].incident.incidentdate,
          incidentlatitude: jNewIncidents.payload.incidents[i].incident.locationlatitude,
          incidentlongitude: jNewIncidents.payload.incidents[i].incident.locationlongitude,
          incidenthasended: jNewIncidents.payload.incidents[i].incident.incidenthasended,
        },
        categories: jNewIncidents.payload.incidents[i].categories
      };

      if (MarchHare.database.getIncidentJSON(incident)) {
        MarchHare.database.updateIncident(incident);
      } else {
        MarchHare.database.setIncident(incident);
      }
    }
  }

  if (newIncidents || !initialized) {
    Ti.API.debug('pollReports: firing updateReports event, map_initialized: '+
      initialized +', newIncidents: '+ newIncidents);
    result = MarchHare.database.getIncidentsJSON();

    // Get the default decay image from the local database
    decayimageIcon = MarchHare.database.getSetting('decayimage_default_icon');

    // If the default decay image icon is not set then change it to the default
    decayimageIcon = (decayimageIcon) ? decayimageIcon :
      'http://'+ 
      Ti.App.Properties.getString('action_domain',
        MarchHare.settings.action_domain.default_value)+
      '/plugins/decayimage/images/Question_icon_thumb.png';

    Ti.App.fireEvent('updateReports', {incidents: result, icon: decayimageIcon});
  } else {
    Ti.API.debug('pollReports: not updating because we did not recieve any new reports');
  }

  if (!error) {
    Ti.App.Properties.setString('lastpoll', new Date().toISOString());
  }
}
