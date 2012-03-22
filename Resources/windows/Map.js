(function () {
  MarchHare.ui.createMapView = function() {
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
 
  var win = Ti.UI.createWindow({
    title: 'In the streets',
      url: 'windows/MapWinHelper.js',
      exitOnClose: true
  });

  Ti.API.debug('About to add map view: ');

  win.add( MarchHare.ui.createMapView() );

  win.open();
})();
