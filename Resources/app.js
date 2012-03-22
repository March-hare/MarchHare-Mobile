// this sets the background color of the master UIView (when there are no windows/tab groups on it)
Titanium.UI.setBackgroundColor('#000');
Ti.API.debug('including the app helpers and windows');

Ti.include(
    'march-hare/march-hare.js',
    'windows/Settings.js',
    'windows/Map.js'
    );

// We dont have any control over how frequently the actual device polls.
setInterval(updateGeoLocation, 1*60*1000 /* minutes * seconds * milliseconds */);

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
    Ti.App.fireEvent('app:updateGeolocation', {
      lat: location.latitude,
      lon: location.longitude
    });

  });
}
