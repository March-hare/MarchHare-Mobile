(function () {
  var mapview = null;

  MarchHare.ui.createMapWebView = function() {
    var webview = Ti.UI.createWebView({ url: '../pages/map.html' });

    // TODO: The gestures below need to be supported
    // https://wiki.appcelerator.org/display/guides/Supporting+Gestures
    // Swipes should move the map
    //webview.addListener('swipe', scrollMap(e));
    
    // Pinches should zoom the map 
    // only supported in iOS in 1.8 of the API
   
    // Long press should submit a report
    
    // Touch, if on an incident, should show more info

    // Send the application settings to the js when we are loaded
    webview.addEventListener('load', function(e) {
      Ti.API.debug('load event for mapview caught, sending settings');
      Ti.App.fireEvent('app:mapWindowLoaded', MarchHare.settings);
    });

    return webview;
  }

  MarchHare.ui.createWebMapWindow = function() { 
    var win = Ti.UI.createWindow({
      title: 'In the streets',
        url: 'windows/MapWinHelper.js',
        exitOnClose: true
    });

    Ti.API.debug('About to add map view: ');

    win.add( MarchHare.ui.createMapView() );

    return win;
 }

  MarchHare.ui.createMapView = function() {
    mapview = Titanium.Map.createView({
      mapType: Titanium.Map.STANDARD_TYPE,
      region: {
        latitude:
          Ti.App.Properties.getDouble('latitude', MarchHare.settings.latitude.default_value),
        longitude:
          Ti.App.Properties.getDouble('longitude', MarchHare.settings.longitude.default_value),
        latitudeDelta:0.01, 
        longitudeDelta:0.01
      },
      animate:true,
      regionFit:true,
      userLocation:true,
    });

    Ti.App.addEventListener('updateGeolocation', function(location) {
      Ti.API.debug("updateMapPosition: " + JSON.stringify(location));
      // Set map center
      mapview.setCenter({x: location.latitude, y: location.longitude});
    });
    Ti.App.addEventListener('updateReports', updateMapReports);
    Ti.App.addEventListener('updateAppSettings', function() {
      // TODO: re-position the map to the region covered by the new ushahidi instance
      updateMapReports();
    });

    return mapview;
  }

  MarchHare.ui.createMapWindow = function() { 
    var win = Ti.UI.createWindow({
      title: 'In the streets',
        url: 'windows/MapWinHelper.js',
        exitOnClose: true
    });

    Ti.API.debug('About to add map view: ');

    win.add( MarchHare.ui.createMapView() );

    return win;
  }

  // TODO: only add annotations relevant to the current view BBOX
  // Titanium.Map.View.getRegion will help with this
  function updateMapReports() {
    var incidents = 
      Ti.App.Properties.getString('incidents',
        MarchHare.settings.incidents.default_value);

    Ti.API.debug("updateMapReports: " + incidents);
    
    // remove all annotations that do not exist in jason.features
    mapview.removeAllAnnotations();

    var json = JSON.parse(incidents);
    var annotations = new Array();
    for (i = 0; i < json.features.length; i++) {
      if (json.features[i].geometry.type == "Point") {
        annotations.push(Titanium.Map.createAnnotation({
          longitude:json.features[i].geometry.coordinates[0],
          latitude: json.features[i].geometry.coordinates[1],
          // TODO: the json in the decayimage module has to be modified to 
          // include this info
          //title: json.features[i],
        }));
      }
    }
    mapview.addAnnotations(annotations);
  }

 Ti.API.debug('windows/Map.js loaded');
})();
