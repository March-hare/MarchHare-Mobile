// Tracks the current URL parameters
var urlParameters = {};
var deSelectedFilters = [];

// Lat/lon and zoom for the map
var latitude = 41.889818923027;
var longitude = -87.637596505706; 
var defaultZoom = 15;

// Track the current latitude and longitude on the alert radius map
var currLat, currLon;

// Tracks whether the map has already been loaded
var mapLoaded = 0;

// Map object
var map = null;
var radiusMap = null;

$(document).ready(function() {
  map = createMap('map', latitude, longitude, defaultZoom);
  map.addControl( new OpenLayers.Control.LoadingPanel({minSize: new OpenLayers.Size(573, 366)}) );
  showIncidentMap();
});

function sleep(ms) {
  var dt = new Date();
  dt.setTime(dt.getTime() + ms);
  while (new Date().getTime() < dt.getTime());
}

/**
 * Handles display of the incidents current incidents on the map
 * This method is only called when the map view is selected
 */
showIncidentMap = (function() {
  //return showIncidentMapOrig();

  // Set the layer name
  var layerName = "Reports";
      
  // Get all current layers with the same name and remove them from the map
  currentLayers = map.getLayersByName(layerName);
  // TODO: I am not really sure if this is needed
  currentLayersIcons = map.getLayersByName(layerName + 'Category Icons');
  for (var i = 0; i < currentLayers.length; i++)
  {
    map.removeLayer(currentLayers[i]);
    map.removeLayer(currentLayersIcons[i]);
  }

  // Default styling for the reports
  var reportStyle = OpenLayers.Util.extend({}, 
    OpenLayers.Feature.Vector.style["default"]);

  reportStyle.pointRadius = 8;
  reportStyle.fillColor = "#30E900";
  reportStyle.fillOpacity = "0.8";
  reportStyle.strokeColor = "#197700";
  // Does this make the total point radius = 8+3/2?
  reportStyle.strokeWidth = 3;
  reportStyle.graphicZIndex = 2;

  // Default style for the associated report category icons 
  var iconStyle =  OpenLayers.Util.extend({}, reportStyle);
  iconStyle.graphicOpacity = 1;
  iconStyle.graphicZIndex = 1;
  iconStyle.graphic = true;
  iconStyle.graphicHeight = 25;

  // create simple vector layer where the report icons will be placed
  var vLayer = new OpenLayers.Layer.Vector(layerName, {
    projection: new OpenLayers.Projection("EPSG:4326"),
    style: reportStyle,
    rendererOptions: {zIndexing: true}
  });

  // create a seperate vector layer where the icons associated with the report
  // categories will be placed.
  var vLayerIcons = new OpenLayers.Layer.Vector(layerName + ' Category Icons', {
    projection: new OpenLayers.Projection("EPSG:4326"),
    style: iconStyle,
    rendererOptions: {zIndexing: true}
  });
      
  // URL to be used for fetching the incidents
  // TODO: this should be configureable
  fetchURL = "http://ushahidi.march-hare.org/decayimage/json";
  
  var aFeatures = new Array();

  // Fetch the incidents
  var json = jQuery.getJSON(fetchURL, function(data) {
    console.log(data);
    $.each(data.features, function(key, val) {

      // create a point from the latlon
      var incidentPoint = new OpenLayers.Geometry.Point(
        val.geometry.coordinates[0],
        val.geometry.coordinates[1]
      );
      var proj = new OpenLayers.Projection("EPSG:4326");
      incidentPoint.transform(proj, map.getProjectionObject());

      // If the incident has ended but it is configured to "decay" we should
      // set the incident icon to the decayimage default icon
      var newIncidentStyle =  OpenLayers.Util.extend({}, reportStyle);
      if (val.incidentHasEnded == 1) {
        newIncidentStyle.externalGraphic = data.decayimage_default_icon;
      }

      // create a feature vector from the point and style
      var feature = new OpenLayers.Feature.Vector(incidentPoint, null, newIncidentStyle);
      feature.attributes = val.properties;
      vLayer.addFeatures([feature]);

      var offsetRadius = reportStyle.pointRadius+iconStyle.graphicHeight/2;
      // if the icon is set then apply it (this requires controller mod)
      // else if icon is an array, then place the icons around the incident
      if (val.properties.icon instanceof Array) {
        var numIcons = val.properties.icon.length;
        var iconCt = 1;
        // Loop over each icon setting externalGraphic and x,y offsets
        $.each(val.properties.icon, function(index, icon) {
          
          var newIconStyle =  OpenLayers.Util.extend({}, iconStyle);
          // TODO: make sure we are using the decayimage category icons if they
          // are set.  I think this should be transparently set by the json 
          // controller anyhow.
          newIconStyle.externalGraphic = icon;
          // TODO: -13 is a magic number here that got this working.
          // I dont totally understant what its related to.
          // pointRadius + strokeWidth + 2FunPixels?
          newIconStyle.graphicXOffset = -13+
            offsetRadius*Math.cos(((2*3.14)/(numIcons))*index);
          newIconStyle.graphicYOffset = -13+
            offsetRadius*Math.sin(((2*3.14)/(numIcons))*index);

          iconPoint = incidentPoint.clone();
          var feature = new OpenLayers.Feature.Vector(
            iconPoint, null, newIconStyle);
          vLayerIcons.addFeatures([feature]);
        });
      }
      // If icon is a single value (this is the protocol default)
      else if (val.properties.icon) {
        iconStyle.externalGraphic = val.properties.icon;
        iconStyle.graphicYOffset = offsetRadius;

        // create a feature vector from the point and style
        var feature = new OpenLayers.Feature.Vector(incidentPoint, null, reportStyle);
        vLayerIcons.addFeatures([feature]);
      }

      // TODO: if decayed add a transparent decay icon over top
    });
  })
  .error(function() { console.log('json error')});

  console.log(json);
  // Add the vector layer to the map
  map.addLayer(vLayer);
  map.addLayer(vLayerIcons);

  // Add feature selection events
  addFeatureSelectionEvents(map, vLayer);
});
