(function() {
  var latitude = null;
  var longitude = null;
  var defaultZoom = null;
  var map = null;
  var proj_4326 = new OpenLayers.Projection('EPSG:4326');
  var proj_900913 = new OpenLayers.Projection('EPSG:900913');
  var proj = new OpenLayers.Projection("EPSG:4326");

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

  // Default style for the associated report category and location icons
  var iconStyle =  OpenLayers.Util.extend({}, reportStyle);
  iconStyle.graphicOpacity = 1;
  iconStyle.graphicZIndex = 1;
  iconStyle.graphic = true;
  iconStyle.graphicHeight = 25;

  // When the mobile app window is loaded, not to be confused with jQuery's
  // $(document).ready, This will likely be called before $(document).ready
  Ti.App.addEventListener('mapWindowLoaded', init);

  function init(settings) {
    Ti.API.debug('reports.js init called with settings: '+JSON.stringify(settings));
    updateSettings(settings);
    $(document).ready(function() {
      map = createMap('map', latitude, longitude, defaultZoom);
      map.addControl( new OpenLayers.Control.LoadingPanel(
        {minSize: new OpenLayers.Size(573, 366)}) );

      Ti.App.addEventListener('newSettingsAvailable', newSettingsAvailable);
      Ti.App.addEventListener('updateReports', function(dictionary) {
        showIncidentMap(dictionary.incidents, dictionary.icon);
      });
      initGeolocation();
      Ti.App.fireEvent('readyForReports');
    });
  }
  
  function newSettingsAvailable(settings) {
  	updateSettings(settings);
  }
    
  function updateSettings(settings) {  
    latitude = settings.latitude;
    longitude = settings.longitude;
    defaultZoom = settings.zoom;

    // We don't know if the followGPS setting has changed but we can just renew
    // it regardless.  disableGeolocation(), if followGPS then
    // initGeolocation()
    disableGeolocation();
    if (settings.followGPS) {
      initGeolocation();
    }
  }

  function initGeolocation() {
    var locationIconStyle =  OpenLayers.Util.extend({}, iconStyle);
    locationIconStyle.graphicHeight = 50;
    locationIconStyle.graphicZIndex = 2;
    locationIconStyle.externalGraphic = '../img/flag.png';

    Ti.App.addEventListener('updateGeolocation', function(location) {
      if (
          (typeof(location.lat) === 'undefined') ||
          (typeof(location.lon) === 'undefined') 
         ) {
        Ti.API.debug('handleUpdateGeolocation did not recieve location info');
        return;
      } 

      // check to see if it is different then the values we already have
      if ( (latitude != location.lat) || (longitude != location.lon) ) {
        Ti.API.debug('handleUpdateGeolocation updating the "Current Location" layer');
        var oldLayer = map.getLayersByName('Current Location');
        for (var i = 0; i < oldLayer.length; i++)
        {
          map.removeLayer(oldLayer[i]);
        }

        var lVector = new OpenLayers.Layer.Vector(
          'Current Location', {
            projection: new OpenLayers.Projection("EPSG:4326"),
            style: locationIconStyle,
            rendererOptions: {zIndexing: true}
          }
        );

        latitude = location.lat;
        longitude = location.lon;

        // create a point from the latlon
        var locationPoint = new OpenLayers.Geometry.Point( 
          location.lon, location.lat);

        locationPoint.transform(proj, map.getProjectionObject());

        var newLocationIconStyle =  OpenLayers.Util.extend({}, locationIconStyle);

        var feature = new OpenLayers.Feature.Vector(
          locationPoint, null, newLocationIconStyle);

        lVector.addFeatures([feature]);

        map.addLayer(lVector);

        // Update the map position
        mapSetCenter();
      }
    });

  }

  function disableGeolocation() {
    // remove the updateGeolocation listener
    Ti.App.removeEventListener('updateGeolocation');

    // remove the lVector layer if the map has been initialized
    if (map !== null) {
      map.removeLayer(lVector);
    }
  }

  function mapSetCenter() {
    // Create a lat/lon object and center the map
    var myPoint = new OpenLayers.LonLat(longitude, latitude);
    myPoint.transform(proj_4326, proj_900913);
    
    // Display the map centered on a latitude and longitude
    map.setCenter(myPoint, defaultZoom);
  }

  /**
   * Handles display of the incidents current incidents on the map
   * This method is only called when the map view is selected
   */
  function showIncidentMap (incidents, decayimageIcon) {

    incidents = JSON.parse(incidents);

    // Set the layer name
    var layerName = "Reports";
        
    // Get all current layers with the same name and remove them from the map
    currentLayers = map.getLayersByName(layerName);
    // TODO: I am not really sure if this is needed
    currentLayersIcons = map.getLayersByName(layerName + ' Category Icons');
    for (var i = 0; i < currentLayers.length; i++)
    {
      map.removeLayer(currentLayers[i]);
      map.removeLayer(currentLayersIcons[i]);
    }

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
        
    var aFeatures = new Array();

    for (i in incidents) {

      // create a point from the latlon
      var incidentPoint = new OpenLayers.Geometry.Point(
        incidents[i].incident.locationlongitude,
        incidents[i].incident.locationlatitude
      );

      incidentPoint.transform(proj, map.getProjectionObject());

      // If the incident has ended but it is configured to "decay" we should
      // set the incident icon to the decayimage default icon
      var newIncidentStyle =  OpenLayers.Util.extend({}, reportStyle);

      if (incidents[i].incident.incidenthasended == 1) {
        newIncidentStyle.externalGraphic = decayimageIcon;
      }

      // create a feature vector from the point and style
      var feature = new OpenLayers.Feature.Vector(incidentPoint, null, newIncidentStyle);
      // The attributes used for the info window popup.  See js/map_common.js
      feature.attributes = {
        name: incidents[i].incident.incidenttitle,
        description: incidents[i].incident.incidentdescription.substr(0, 130),
        icon: incidents[i].icon
      };
      vLayer.addFeatures([feature]);

      var offsetRadius = reportStyle.pointRadius+iconStyle.graphicHeight/2;
      var numIcons = incidents[i].icon.length;
      var iconCt = 1;

      // Loop over each icon setting externalGraphic and x,y offsets
      $.each(incidents[i].icon, function(index, icon) {
        
        var newIconStyle =  OpenLayers.Util.extend({}, iconStyle);
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

    // Add the vector layer to the map
    map.addLayer(vLayer);
    map.addLayer(vLayerIcons);

    // Add feature selection events
    addFeatureSelectionEvents(map, vLayer);

    Ti.App.fireEvent('mapInitialized');
  };

  /**
   * Zoom to Selected Feature from within Popup
   */
  function zoomToSelectedFeature(lon, lat, zoomfactor)
  {
    var lonlat = new OpenLayers.LonLat(lon,lat);

    // Get Current Zoom
    currZoom = map.getZoom();
    // New Zoom
    newZoom = currZoom + zoomfactor;
    // Center and Zoom
    map.setCenter(lonlat, newZoom);
    // Remove Popups
    for (var i=0; i < map.popups.length; ++i)
    {
      map.removePopup(map.popups[i]);
    }
    onPopupClose(true);
  }

  /**
   * Creates an returns a map object
   * @param targetElement ID of the element to be used for creating the map
   * @param options Options to be used for creating the map
   */
  function createMap(targetElement, lat, lon, zoomLevel, options)
  {
    if (typeof targetElement == 'undefined' || $("#"+targetElement) == null)
    {
      return;
    }
        
    // To hold the map options
    var mapOptions;
    
    if (typeof(options) == 'undefined')
    {
      // Create the default options
      mapOptions = {
        units: "mi",
        numZoomLevels: 18,
        theme: false,
        controls:[],
        projection: proj_900913,
        'displayProjection': proj_4326
      };
    }
    else
    {
      mapOptions = options;
    }
    
    // Create the map object
    var map = new OpenLayers.Map(targetElement, mapOptions);
    
    var osm_mapnik = new OpenLayers.Layer.OSM.Mapnik("OSM Mapnik", {
      sphericalMercator: true,
      maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34)});

    var osm_tah = new OpenLayers.Layer.OSM.Mapnik("OSM Tiles@Home", {
      sphericalMercator: true,
      maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34)});

    var osm_cycle = new OpenLayers.Layer.OSM.Mapnik("OSM Cycling Map", {
      sphericalMercator: true,
      maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34)});
    
    // Add the default layers
    map.addLayers([osm_mapnik, osm_tah, osm_cycle]);
    
    // Add controls
    map.addControl(new OpenLayers.Control.Navigation());
    map.addControl(new OpenLayers.Control.PanZoom());
    map.addControl(new OpenLayers.Control.Attribution());
    map.addControl(new OpenLayers.Control.MousePosition());
    map.addControl(new OpenLayers.Control.LayerSwitcher());
    
    // Check for the zoom level
    var zoom = (typeof zoomLevel == 'undefined' || zoomLevel < 1)? 9 : zoomLevel;
    
    // Create a lat/lon object and center the map
    var myPoint = new OpenLayers.LonLat(lon, lat);
    myPoint.transform(proj_4326, proj_900913);
    
    // Display the map centered on a latitude and longitude
    map.setCenter(myPoint, zoom);
    
    // Return
    return map;
  }
   
function addFeatureSelectionEvents(map, layer) {
  var selectedFeature = null;
  selectControl = new OpenLayers.Control.SelectFeature(layer);
  map.addControl(selectControl);
  selectControl.activate();
  layer.events.on({
    "featureselected": function(event) {
      selectedFeature = event.feature;
      zoom_point = event.feature.geometry.getBounds().getCenterLonLat();
      lon = zoom_point.lon;
      lat = zoom_point.lat;
      
      var thumb = "<div class=\"infowindow_image\">";
      if ( typeof(event.feature.attributes.icon) != 'undefined' && 
        (event.feature.attributes.icon instanceof Array))
      {
        for (i in event.feature.attributes.icon) {
          thumb += "<img src=\""+
            event.feature.attributes.icon[i]
            +"\" />";
        }
      }
      thumb += "</div>";

      // TODO: a link here could fire an event that switches windows to a 
      // report window.  
      var content = "<div class=\"infowindow\">";

      content += "<div class=\"infowindow_list\">"+
        event.feature.attributes.name+
        "</div>"+thumb;

      content += "<div class=\"infowindow_content\">";
      content += "\n<div class=\"infowindow_meta\">";
      content += event.feature.attributes.description;
      // Zoom is currently not working, commenting this out until we have
      // time to add this feature
      /*
      content += "<a href='javascript:zoomToSelectedFeature("+ lon + ","+ lat +",1)'>";
      content += "Zoom in</a>";
      content += "&nbsp;&nbsp;|&nbsp;&nbsp;";
      content += "<a href='javascript:zoomToSelectedFeature("+ lon + ","+ lat +",-1)'>";
      content += "Zoom out</a></div>";
      */
      content += "</div><div style=\"clear:both;\"></div></div>";		

      if (content.search("<script") != -1)
      {
        content = "Content contained Javascript! Escaped content below.<br />" + content.replace(/</g, "&lt;");
      }
            
      // Destroy existing popups before opening a new one
      if (event.feature.popup != null)
      {
        map.removePopup(event.feature.popup);
      }
      
      popup = new OpenLayers.Popup.FramedCloud("chicken", 
        event.feature.geometry.getBounds().getCenterLonLat(),
        new OpenLayers.Size(100,100),
        content,
        null, true, onPopupClose);

      event.feature.popup = popup;
      map.addPopup(popup);
    },
    "featureunselected": function(event) {
      // Safety check
      if (event.feature.popup != null)
      {
        map.removePopup(event.feature.popup);
        event.feature.popup.destroy();
        event.feature.popup = null;
      }
    }
  });
}

  /**
   * Close Popup
   */
  function onPopupClose(event)
  {
    selectControl.unselect(selectedFeature);
    selectedFeature = null;
  };
})();
