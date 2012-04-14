(function() {
  var latitude = null;
  var longitude = null;
  var defaultZoom = null;
  var incidentUrl = null;
  var pollSeconds = null;
  var map = null;
  var proj_4326 = new OpenLayers.Projection('EPSG:4326');
  var proj_900913 = new OpenLayers.Projection('EPSG:900913');

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
      Ti.App.addEventListener('updateReports', showIncidentMap);
      Titanium.App.addEventListener('updateGeolocation', 
        handleUpdateGeolocation);
    });
  }
  
  function newSettingsAvailable(settings) {
  	updateSettings(settings);
  }
    
  function updateSettings(settings) {  
    latitude = settings.latitude;
    longitude = settings.longitude;
    defaultZoom = settings.zoom;
    incidentUrl = 'http://' + settings.action_domain + '/decayimage/json?callback=?';
    pollSeconds = settings.poll;
  }

  function handleUpdateGeolocation(location) {
    if (
        (typeof(location.latitude) === 'undefined') ||
        (typeof(location.longitude) === 'undefined') 
       ) {
      Ti.API.debug('handleUpdateGeolocation did not recieve location info');
      return;
    } 

    Ti.API.debug('reports.js handleUpdateGeolocation called with location: '
        +JSON.stringify(location));

    // check to see if it is different then the values we already have
    if ( (latitude != location.latitude) || (longitude != location.longitude) ) {
      latitude = location.latitude;
      //Ti.App.Properties.setDouble("latitude", location.latitude);
      longitude = location.longitude;
      //Ti.App.Properties.setDouble("longitude", location.longitude);

      // Update the map position
      mapSetCenter();
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
  function showIncidentMap (incidents) {

    Ti.API.debug('showIncidentMap called with incidents: '+incidents);

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
        
    var aFeatures = new Array();

    //$.each(incidents, function(key, val) {
    for (i in incidents) {

      // create a point from the latlon
      var incidentPoint = new OpenLayers.Geometry.Point(
        i.incident.incident.latitude,
        i.incident.incident.longitude
      );
      var proj = new OpenLayers.Projection("EPSG:4326");
      incidentPoint.transform(proj, map.getProjectionObject());

      // If the incident has ended but it is configured to "decay" we should
      // set the incident icon to the decayimage default icon
      var newIncidentStyle =  OpenLayers.Util.extend({}, reportStyle);
      if (val.incidentHasEnded == 1) {
        newIncidentStyle.externalGraphic = incidents.decayimage_default_icon;
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

    // Add the vector layer to the map
    map.addLayer(vLayer);
    map.addLayer(vLayerIcons);

    // Add feature selection events
    addFeatureSelectionEvents(map, vLayer);

    Ti.App.Properties.setBool('map_initialized', true);
  };

  /**
   * Handles display of the incidents current incidents on the map
   * This method is only called when the map view is selected
   */
  function showIncidentMapOld (incidents) {

    /*
    var incidents = 
      Ti.App.Properties.getString('incidents',
        MarchHare.settings.incidents.default_value);
        */
    incidents = JSON.parse(incidents);

    Ti.API.debug('showIncidentMap called with incidents: '+JSON.stringify(incidents));

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
        
    var aFeatures = new Array();

    $.each(incidents, function(key, val) {
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
        newIncidentStyle.externalGraphic = incidents.decayimage_default_icon;
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

    // Add the vector layer to the map
    map.addLayer(vLayer);
    map.addLayer(vLayerIcons);

    // Add feature selection events
    addFeatureSelectionEvents(map, vLayer);

    Ti.App.Properties.setBool('map_initialized', true);
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
        Ti.API.debug('js/reports.js addFeatureSelectionEvents selectedFeature: '+ JSON.stringify(selectedFeature.attributes));
        zoom_point = event.feature.geometry.getBounds().getCenterLonLat();
        lon = zoom_point.lon;
        lat = zoom_point.lat;
        
        var content = "<div class=\"infowindow\">" + event.feature.attributes.title;
        var body = event.feature.attributes.body.slice(0,130);
        if (body.length == 130) {
          body += '...';
        }

        content += "<div class=\"infowindow_content\"><div class=\"infowindow_list\">"+body+"</div>";
        content += "\n<div class=\"infowindow_meta\">";
        content += "<a href='javascript:zoomToSelectedFeature("+ lon + ","+ lat +",1)'>";
        content += "Zoom in</a>";
        content += "&nbsp;&nbsp;|&nbsp;&nbsp;";
        content += "<a href='javascript:zoomToSelectedFeature("+ lon + ","+ lat +",-1)'>";
        content += "Zoom out</a></div>";
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
