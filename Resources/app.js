var DEV = true;

// this sets the background color of the master UIView (when there are no windows/tab groups on it)
Titanium.UI.setBackgroundColor('#000');
Ti.API.debug('including the app helpers and windows');

Ti.include(
    'march-hare/march-hare.js',
    'windows/Settings.js',
    'windows/Map.js',
    'windows/Reports.js'
    );

var reportsInitialized = false;
var win = MarchHare.ui.createMapWindow();
win.open();

// We dont have any control over how frequently the actual device polls.
setInterval(updateGeoLocation, 1*60*1000 /* minutes * seconds * milliseconds */);

// The benefit of polling for reports in the main code is so that we can trigger
// phone based events like alerts if the incident list changes
if (DEV) {
  Ti.App.Properties.setString('incidents', '{}');
}
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
  var url = 'http://'+ 
      Ti.App.Properties.getString('action_domain',
      MarchHare.settings.action_domain.default_value)+
      '/decayimage/json';

  var incidents = 
    Ti.App.Properties.getString('incidents',
      MarchHare.settings.incidents.default_value);
  var jIncidents = JSON.parse(incidents);

  // Pulled from example here: http://bit.ly/n5YWdz
  var xhr = Ti.Network.createHTTPClient({
    onload: function(){
      var jNewIncidents = JSON.parse(this.responseText);
      var result = compareIncidents(incidents, jNewIncidents);
      if (result.result) {
         Ti.App.Properties.setString('incidents', JSON.stringify(result.merged));
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

// Compare two category objects to see if new categories have been added
function compareCategories(oldCat, newCat) {
  var result = {
    result: false,
    message: []
  };

  // Loop through the new categories and index them by id
  var newCatById = {};
  for (var i = 0; i < newCat.length; i++) {
    newCatById[newCat[i].id] = newCat[i];
  }
  delete newCat;

  // Now its easier to compare them
  for (i in oldCat) {
    if (!i in newCatById) {
      result.result = true;
      result.message.push('Category '+oldCat.category_title+' removed');
      // Objects are passed by reference
      delete oldCat.i;
    }
    delete newCatById.i;
  }

  // Any newCat categories that are left over here should be added to oldCat
  var added = newCatById.length;
  for (i in newCatbyId) {
    result.result=true;
    result.message.push('Added category '+newCatById+' category');
    // Objects are passed by reference
    oldCat[i] = newCatbyId.i;
  }

  return result;
}

// Compare two locations to see if it changed
function compareLocations(oldLocation, newLocation) {
  var result = {
    result: false,
    message: ''
  };

  if (
    (oldLocation[0] != newLocation[0]) ||
    (oldLocation[1] != newLocation[0]) 
   ){
    oldLocation = newLocation;
    result.result = true;
    result.message = 'Location was updated';
  }

  return result;
}


// TODO: Incidents really should be in a database
function compareIncidents(oldIncidents, newIncidents) {
  var result = {
    result: false,
    message: '',
    removed: [],
    added: [],
    merged: {}
  };

  Ti.API.debug("compareIncidents oldIncidents: "+
    'old: '+ JSON.stringify(oldIncidents)+
    'new: '+ JSON.stringify(newIncidents));

  // Sanity check
  if ((newIncidents.type != "FeatureCollection")) {
    Ti.API.error("compareIncidents recieved an invalid incident "+
      'new: '+ JSON.stringify(newIncidents));
  }

  // Loop through the new incidents and index them by id
  var newIncidentsById = {};
  for (i = 0; i < newIncidents.features.length; i++) {
    newIncidentsById[newIncidents.features[i].properties.id] = 
      newIncidents.features[i];
  }
  delete newIncidents;
  Ti.API.debug("compareIncidents newIncidentsById: "+ 
    JSON.stringify(newIncidentsById));

  // Now its easier to compare them
  for (i in oldIncidents) {
    // If the index does not exist in newIncidentsById then it was deleted
    if (!(i in newIncidentsById)) {
      result.result = true;
      result.removed.push(oldIncidents.i);
      delete oldIncidents.i;
      continue;
    }

    // If it does exist check if the categories have changed
    // cannot read property category
    var r = compareCategories(oldIncidents.i.category, newIncidentsById.i.category);
    if (r.result) {
      result.result = true;
      oldIncidents.i.read = false;
      result.message.push(r.message);
    }

    // Check if the location has changed
    r = compareLocations(
        oldIncidents.i.geometry.coordinates, newIncidentsById.i.geometry.coordinates);
    if (r.result) {
      result.result = true;
      oldIncidents.i.read = false;
      result.message.push(r.message);
    }

    //  We remove this id from newIncidentsById so we can track newly added incidents
    delete newIncidentsById.i;
  }

  for (i in newIncidentsById) {
    result.result = true;
    result.message.push('Added report: '+ newIncidentsById.i.properties.title);
    oldIncidents[i] = newIncidentsById.i;
    oldIncidents.i.read = false;
    delete newIncidentsById.i;
  }

  return result;
}
