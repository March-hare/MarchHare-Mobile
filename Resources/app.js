var DEV = false;
var POLLING = false;
Ti.App.Properties.setBool('map_initialized', false);

// this sets the background color of the master UIView (when there are no windows/tab groups on it)
Titanium.UI.setBackgroundColor('#000');

Ti.include(
    'march-hare/march-hare.js',
    'windows/Settings.js',
    'windows/Map.js',
    'windows/Reports.js',
    'march-hare/database.js'
    );

//MarchHare.database.testDatabase();

var reportsInitialized = false;

var tabGroup;
var mapTab;

if (Ti.Platform.osname == 'android') {
	var win = MarchHare.ui.createMapWindow();
  var activity = Ti.Android.currentActivity;

  activity.onCreateOptionsMenu = function(e){
    var menu = e.menu;
    var menuItem = menu.add({ title: 'Settings' });
    menuItem.addEventListener("click", function(){
      var settingsWin = MarchHare.ui.createSettingsWindow();
      settingsWin.open({});
    });
    var rMenuItem = menu.add({ title: 'Reports' });
    rMenuItem.addEventListener("click", function(){
      var settingsWin = MarchHare.ui.createReportsWindow();
      settingsWin.open({});
    });
  };
	win.open();
} 
else {
	// Create a tab group
	tabGroup = Titanium.UI.createTabGroup();

	// Create Main tab
	var mapWin = MarchHare.ui.createMapWindow();
	mapTab = Titanium.UI.createTab({
		title: 'Map',
		icon: '/img/KS_nav_map.png',
		window: mapWin
	});

	// Create reports win/tab
	var reportsWin = MarchHare.ui.createReportsWindow();
	var reportsTab = Titanium.UI.createTab({
		title: 'Reports',
		icon: '/img/KS_nav_ui.png',
		window: reportsWin
	});

	// Add tabs
	tabGroup.addTab(mapTab);
	tabGroup.addTab(reportsTab);

	tabGroup.setActiveTab(mapTab);
	tabGroup.open();

	// There is a situation where the windows here can be created before the
	// incident database is populated.  When there are updates to the db then
	// we need to recreate these windows because they are not created dynamically
	// like they are in the modal windows for android
	Ti.App.addEventListener('categoriesDownloaded', function() {
		// Create settings win/tab
		var settingsWin = MarchHare.ui.createSettingsWindow();
		var settingsTab = Titanium.UI.createTab({
			title: 'Settings',
			icon: '/img/KS_nav_views.png',
			window: settingsWin
		});
		tabGroup.addTab(settingsTab);
	});

	Ti.App.addEventListener('filterReports', function() {
		tabGroup.removeTab(reportsTab);
		reportsWin = MarchHare.ui.createReportsWindow();
		reportsTab = Titanium.UI.createTab({
			title: 'Reports',
			icon: '/img/KS_nav_ui.png',
			window: reportsWin
		});
		tabGroup.addTab(reportsTab);
	});

	Ti.App.addEventListener('newIncidents', function() {
		tabGroup.removeTab(reportsTab);
		reportsWin = MarchHare.ui.createReportsWindow();
		reportsTab = Titanium.UI.createTab({
			title: 'Reports',
			icon: '/img/KS_nav_ui.png',
			window: reportsWin
		});
		tabGroup.addTab(reportsTab);
	});
}

// Set the handler for whe the action midpoint is recieved
// In testing this event does not get recieved until after the settings are 
// sent to the map view
// TODO: Does this create a memory leak?
Ti.App.addEventListener('geolocationDownloaded', function() {
  updatedActionMidPoint();
});

// The benefit of polling for reports in the main code is so that we can trigger
// phone based events like alerts if the incident list changes
// TODO: test with these settings off
if (DEV) { 
  Ti.App.Properties.setString('lastpoll', '1970-01-01');
	MarchHare.database.flushCategories(); 
	MarchHare.database.flushIncidentCategories(); 
  MarchHare.database.flushIncidents(); 
  Ti.App.Properties.setInt('poll', MarchHare.settings.poll.default_value);
}

// Force a lookup of all categories everytime the application starts
MarchHare.database.initializeCategories();
MarchHare.database.initializeIncidents();
MarchHare.database.initializeMidPoint();

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
  Ti.API.log('actionDomainChanged event recieved, updating system');
  Ti.App.Properties.setString('lastpoll', '1970-01-01');
  MarchHare.database.flushIncidents(); 
  MarchHare.database.flushIncidentCategories(); 
  MarchHare.database.flushCategories(); 
  MarchHare.database.initializeCategories();
  MarchHare.database.initializeMidPoint();
  pollForReports();
});

var pollInterval;
Ti.App.addEventListener('mapInitialized', function() {
  Ti.API.log('mapInitialized event recieved');
  Ti.App.Properties.setBool('map_initialized', true);
  Ti.API.log('polling for new reports every '+
    Ti.App.Properties.getInt('poll', MarchHare.settings.poll.default_value)*1000 +
    ' seconds');
  pollInterval = setInterval(pollForReports, 
    Ti.App.Properties.getInt('poll', MarchHare.settings.poll.default_value) 
    *1000 /* seconds * milliseconds */);
});

Ti.App.addEventListener('pollIntervalChanged', function() {
  Ti.API.log('pollIntervalChanged event recieved, updating poll interval');
  clearInterval(pollInterval);
  pollInterval = setInterval(pollForReports, 
    Ti.App.Properties.getString('poll', MarchHare.settings.poll.default_value) 
    *1000 /* seconds * milliseconds */);
});

// We dont have any control over how frequently the actual device polls.
Ti.Geolocation.purpose = "Positioning map based on your location (default:disabled)";
Titanium.Geolocation.preferredProvider = Titanium.Geolocation.PROVIDER_GPS;

// There are 80 meeters in one citry block, this means a person will have to move 
// 3 city blocks before the map recenters.  On the default zoom level there are 
// about 4 city blocks within view
Titanium.Geolocation.distanceFilter = 240;

if (Ti.App.Properties.getBool('gpsFollow', 
    MarchHare.settings.gpsFollow.default_value)) {

  Titanium.Geolocation.addEventListener('location', updateGeoLocationHandler);
}

Ti.App.addEventListener('gpsFollowChanged', function() {
  Ti.API.log('gpsFollowChanged ('+
    Ti.App.Properties.getBool('gpsFollow', 'NOT SET')+
    ') event recieved, updating location polling');
  if (Ti.App.Properties.getBool('gpsFollow', 
    MarchHare.settings.gpsFollow.default_value)) {
    Titanium.Geolocation.addEventListener('location', updateGeoLocationHandler);
  } else {
    Ti.API.log('gpsFollowChanged event recieved, clearing gps interval');

    // This handles the privacy concern of a user turning off gpsFollow on 
    // their device then getting their phone confiscated and the saved location
    // being able to be used as evidence
    Ti.App.Properties.setDouble('latitude', 
      Ti.App.Properties.getDouble('action_latitude'));
    Ti.App.Properties.setDouble('longitude', 
      Ti.App.Properties.getDouble('action_longitude'));

    Titanium.Geolocation.removeEventListener('location', updateGeoLocationHandler);
  }
});

function updateGeoLocationHandler(location) {
  Ti.API.log('app.js::updateGeoLocationHandler() location: '+ 
    JSON.stringify(location));

  // Titanium.Geolocation.location: http://bit.ly/GG6qri
  // If this is an error, handle it the best we can
  if (!location.success || location.error) {
    Ti.API.error('There was a problem getting geolocation code:'+
      location.error.code +' message: '+ location.error.message);
    return;
  }

  // TODO: saving geo location on the device could be
  // a privacy concern.  Can we get around this?  For
  // now the way around this is to not turn on GPS follow
  Ti.App.Properties.setDouble('latitude', location.coords.latitude);
  Ti.App.Properties.setDouble('longitude', location.coords.longitude);
  // Fire an application event with the new geolocation data if we have it
  Ti.App.fireEvent('updateGeolocation', {
    lat: location.coords.latitude,
    lon: location.coords.longitude
  });
}

function updateGeoLocation() {
  var alert = Titanium.UI.createAlertDialog({
    title: 'Geolocation message'
  });

  if( Titanium.Geolocation.locationServicesEnabled === false ) {
    Ti.API.log('app.js::updateGeoLocation() device has GPS turned off.');
    alert.message = 'Your device has GPS turned off. Please turn it on.';
    alert.show();
    setTimeout(function() {
      alert.hide();
    }, 2000); 
    return;
  }

  // Titanium.Geolocation.getCurrentPosition: http://bit.ly/GEe76Q
  Titanium.Geolocation.getCurrentPosition(function(location) {
    // Titanium.Geolocation.location: http://bit.ly/GG6qri
    // If this is an error, handle it the best we can
    if (!location.success || location.error) {
      Ti.API.error('There was a problem getting geolocation code:'+
        location.error.code +' message: '+ location.error.message);
      return;
    }
 
    Ti.API.log('app.js::updateGeoLocation location: '+ 
      JSON.stringify(location.coords));
    // TODO: saving geo location on the device could be
    // a privacy concern.  Can we get around this?  For
    // now the way around this is to not turn on GPS follow
    Ti.App.Properties.setDouble('latitude', location.coords.latitude);
    Ti.App.Properties.setDouble('longitude', location.coords.longitude);
    // Fire an application event with the new geolocation data if we have it
    Ti.App.fireEvent('updateGeolocation', {
      lat: location.coords.latitude,
      lon: location.coords.longitude
    });

  });
}

function pollForReports() {
  if (POLLING) { return; }

  POLLING = true;
  var lastpoll = Ti.App.Properties.getString('lastpoll', '1970-01-01');
  var url = 'http://'+ 
      Ti.App.Properties.getString('action_domain',
      MarchHare.settings.action_domain.default_value)+
      '/api/?task=decayimage&by=sincedate&limit=100&date='+lastpoll;

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
      //Ti.App.Properties.setString('lastpoll', new Date().toISOString());
    }
    else {
      Ti.API.error('pollReports: recieved invalid json from the server: '+
        JSON.stringify(jNewIncidents));
      error = true;
    }
  } else {

    var categories = MarchHare.database.getFilteredCategoryArray();
    // TODO: this finishes before the settings are sent to the map, so it does
    // not actually load until after the next poll
    for ( var i  in jNewIncidents.payload.incidents) {
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

      // if we already found a newIncident we dont have to keep checking
      if (!newIncidents) {
        // Loop across the assigned categories to see if it is one we are
        // interested in
        for (j in jNewIncidents.payload.incidents[i].categories) {
          if ( categories.indexOf(parseInt(jNewIncidents.payload.incidents[i].categories[j].category.id)) != -1) {
            newIncidents = true;
            break;
          } 
        }
      }
    }
  }

  if (newIncidents || !initialized) {
    Ti.App.Properties.setString('lastpoll', new Date().toISOString());
    Ti.API.log('pollReports: firing updateReports event, map_initialized: '+
      initialized +', newIncidents: '+ newIncidents);
    updatedReportsAction();

  } else {
    Ti.API.log('pollReports: not updating because we did not recieve any new reports');
  }

  // Let other interested parties do what they want with newIncidents
  if (newIncidents) {
		Ti.App.fireEvent('newIncidents');
  }

  if (!error) {
    //Ti.App.Properties.setString('lastpoll', new Date().toISOString());
  }
}

Ti.App.addEventListener('filterReports', function() {
	Ti.API.log('filterReports event recieved');
  updatedReportsAction();
});

Ti.App.addEventListener('newIncidents', function() {
  notifyUser();
});

function notifyUser() {
 if (Ti.App.Properties.getBool('vibrate', false)) {
    Ti.API.log('Vibrating the phone');
    Titanium.Media.vibrate();
	}
}

function updatedReportsAction() {
  result = MarchHare.database.getIncidentsJSON({});

  // Get the default decay image from the local database
  decayimageIcon = MarchHare.database.getSetting('decayimage_default_icon');

  // If the default decay image icon is not set then change it to the default
  decayimageIcon = (decayimageIcon) ? decayimageIcon :
    'http://'+ 
    Ti.App.Properties.getString('action_domain',
      MarchHare.settings.action_domain.default_value)+
    '/plugins/decayimage/images/Question_icon_thumb.png';

  Ti.App.fireEvent('updateReports', {incidents: result, icon: decayimageIcon});
}

function updatedActionMidPoint() {
  // If followGPS is on we will not change the default latitude and longitude
  if (!Ti.App.Properties.getBool('gpsFollow', 
    MarchHare.settings.gpsFollow.default_value)) {
    Ti.App.Properties.setDouble('latitude', 
      Ti.App.Properties.getDouble('action_latitude'));
    Ti.App.Properties.setDouble('longitude', 
      Ti.App.Properties.getDouble('action_longitude'));
  }
}
