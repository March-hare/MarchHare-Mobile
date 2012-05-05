(function () {

  // install acts as a short cut to open if the database is already installed
  // if it is not installed it will place the db in the correct location and 
  // return a db hanler like open
  var db;
  // TODO: figure out how to install on the sdcard for android
  /*
  if (Ti.Platform.name === 'android' && Ti.Filesystem.isExternalStoragePresent()) {
    db2 = Ti.Database.install('incidents.sqllite', 
      Ti.Filesystem.externalStorageDirectory + 
      'NATOG82012CHI' + Ti.Filesystem.separator + 
      'incidents');
  } else {
    db  = Ti.Database.install('incidents.sqllite', 'incidents');
  }
  */
  if (Ti.Platform.name === 'android') {
		db  = Ti.Database.install('incidents.sqlite', 'incidents');
	} else {
		db  = Ti.Database.install('march-hare/incidents.sqlite', 'incidents');
	}

  var databaseIndicator = Titanium.UI.createActivityIndicator({ height:50, width:10 });

  MarchHare.database.setSetting = function(key, value) {
    var query = 'DELETE FROM settings WHERE key="'+key+'"';
    db.execute(query);

    query = 'INSERT INTO settings (key, value) VALUES("'+
      key +'", "'+ value +'")';
    db.execute(query);
    return db.lastInsertRowId;
  }

  MarchHare.database.getSetting = function(key) {
    var query = 'SELECT value FROM settings WHERE key="'+key+'"';
    var rows = db.execute(query);
    var value = '';
    if (rows.isValidRow()) {
      value = rows.fieldByName('value');
    }
    else {
      value = false;
    }

    rows.close();
    return value;
  }

  MarchHare.database.flushSettings = function() {
    var query = 'DELETE FROM settings';
    db.execute(query);
  }

  // TODO: this means that the mobile application will malfunction for 
  // categories that do not have icons associated with them.
  MarchHare.database.setCategory = function(category) {
    if (
      typeof category == 'undefined' ||
      typeof category.title == 'undefined' ||
      typeof category.icon == 'undefined' ||
      typeof category.id == 'undefined'
      ) {
      return false;
    }

    // Make sure the data passed in is unique
    // Some kind of error message would be appropriate, but even better would 
    // be just deleting the offending data so that we can insert new data as we
    // are synching with the server
    var query = 'DELETE FROM categories WHERE id='+category.id;
    db.execute(query);

    // TODO: check the number of rows affected and print a message if we deleted
    // anything
    query = 'INSERT INTO categories(id,title,icon,decayimage) '+
      'VALUES('+ category.id +', "'+ DoAsciiHex(category.title, 'A2H') +'", "'
      + category.icon +'", "'+ category.decayimage +'")';

    // TODO: return false on error
    db.execute(query);
    return db.lastInsertRowId;
  };

  MarchHare.database.getCategory = function(category) {
    if (typeof category == 'undefined') {
      return false;
    }

    var query = '';
    if (typeof category.id != 'undefined') {
      query = 'SELECT * from categories where id=' + category.id;
    }
    else if (typeof category.title != 'undefined') {
      query = 'SELECT * from categories where title=\'' + 
      DoAsciiHex(category.title, 'A2H') +'\'';
    }
    else {
      return false;
    }

    return db.execute(query);
  };

  MarchHare.database.getCategories = function() {
    var query = 'SELECT * from categories';
    return db.execute(query);
  };

  MarchHare.database.getCategoriesJSON = function() {
    var rows = MarchHare.database.getCategories();
    var categories = [];
    while (rows.isValidRow()) {
      var category = {
        id: rows.fieldByName('id'),
        title: DoAsciiHex(rows.fieldByName('title'), 'H2A'),
        icon: rows.fieldByName('icon'),
        decayimage: rows.fieldByName('decayimage'),
        filter: rows.fieldByName('filter'),
      };
      categories.push(category);
      rows.next();
    }
    return JSON.stringify(categories);
  };

  // If you want to force an initilization of the categories just flush them
  // first with MarchHare.database.flushCategories()
  MarchHare.database.initializeCategories = function() {
    // Unless we are forcing a category refresh check to see if we have any
    // categories already.  If so then return;
    var query = 'SELECT count(*) as count from categories';
    var rows = db.execute(query);
    if (rows.isValidRow() && rows.fieldByName('count') > 0) {
      return;
    }

    var url = 'http://'+ 
        Ti.App.Properties.getString('action_domain',
        MarchHare.settings.action_domain.default_value)+
        '/api?task=decayimagecategories';

    // Configure an event handler to try and download the category icons to
    // local storage after the categories have been intialized
    Ti.App.addEventListener('categoriesDownloaded', function() {
      downloadCategoryIcons();
    });

    var t = setInterval(function() {

      // If we cant set the semaphore then we do not have access to the HTTP 
      // Client yet.
      if (!MarchHare.xhrGetSemaphore('Initializing categories')) {
        return;
      }

      MarchHare.xhrProcess({
        url: url,
        onload: MarchHare.database.handleServerResponseCategories
      });

      clearInterval(t);
    }, 100);
  }

  MarchHare.database.handleServerResponseCategories = function(response) {
    var categories = JSON.parse(response);
    var i;

    // Get the categories from the server and insert any new ones 
    if (
      typeof categories != 'undefined' &&
      typeof categories.payload != 'undefined' &&
      typeof categories.payload.categories != 'undefined' &&
      categories.payload.categories instanceof Array &&
      typeof categories.payload.decayimage_default_icon != 'undefined'
    ) {

      // Setting the category deletes the category first in case there were
      // any updates from the server, but we preserve the user defined
      // category filter.
      for (i in categories.payload.categories) {
        var filter = null;
        var category = MarchHare.database.getCategory(
          categories.payload.categories[i].category);

        if (category.isValidRow()) { 
          filter = category.fieldByName('filter'); 
        }

        var id = MarchHare.database.setCategory(
            categories.payload.categories[i].category);
        if ((filter !== null) && id) {
          MarchHare.database.setCategoryFilter(id, filter);
        }

      };

      // Get the default decayimage
      MarchHare.database.setSetting('decayimage_default_icon', 
        categories.payload.decayimage_default_icon);
    }
    else {
      Ti.API.error('InitializeCategories: We recieved an invalid response '+
        'from the server: '+ JSON.stringify(categories));
    }
    Ti.App.fireEvent('categoriesDownloaded');
  };

  MarchHare.database.handleServerResponseCategoryIcon = function(response) {
    Ti.API.debug('MarchHare.database.handleServerResponseCategoryIcon '+
       'category icon downloaded.  Changing reference '+ response.url +
      ' to '+  response.file);
    var query = 'UPDATE categories SET icon=\''+response.file+'\' '+
      'WHERE icon=\''+response.url+'\'';
    return db.execute(query);
  };

  MarchHare.database.handleServerResponseDecayIcon = function(response) {
    Ti.API.debug('MarchHare.database.handleServerResponseDecayIcon '+
       'decayimage icon downloaded.  Changing reference '+ response.url +
      ' to '+  response.file);
    var query = 'UPDATE categories SET decayimage=\''+response.file+'\' '+
      'WHERE decayimage=\''+response.url+'\'';
    return db.execute(query);
  };

  MarchHare.database.flushCategories = function() {
    var query = "DELETE FROM categories";
    db.execute(query);
  }

  MarchHare.database.flushIncidentCategories = function() {
    var query = "DELETE FROM incident_categories";
    db.execute(query);
  }

  MarchHare.database.setCategoryFilter = function(id, filter) {
    // verify the category exists
    if (!MarchHare.database.getCategory({id: id})) {
      Ti.API.error('setCategoryFilter tried to update the filter for a '+
        'category with id ('+id+') that does not exist');
      return false;
    }

    // verify the filter
    if ((filter != 1) && (filter != 0)) {
      Ti.API.error('setCategoryFilter tried to update the filter with a '+
        'invalid filter value ('+filter+')');
      return false;
    }

    var query = 'UPDATE categories set filter='+(filter?1:0)+' where id='+id;
    return db.execute(query);
  }

  var intervals = {};
  var fnamere = /[^\/]+$/;
  function downloadCategoryIcons() {
    var downdir = Titanium.Filesystem.getApplicationDataDirectory();
    var rows = MarchHare.database.getCategories();
    var httpre = /^http:\/\//;

    var ct = 0;
    while (rows.isValidRow()) {
      ct++;
      // loop through the categories, grab a xhr semaphore for each,
      // and dispatch to an apropriate handler.  This could effectively
      // thread/fork bomb the application if not done correctly
      var icon = rows.fieldByName('icon');
      var title = rows.fieldByName('title');
      var decayimageicon = rows.fieldByName('decayimage');

      //TODO: checkout Appcelerator-KitchenSink/Resources/examples/xhr_filedownload.js
      if (httpre.test(icon)) {
        intervals[icon] = setInterval(
          bind({icon: icon, title: title}, downloadCategoryIconsInterval), 1000);
      }
      
      var decayIcon = rows.fieldByName('decayimage');
      if (httpre.test(decayIcon)) {
        intervals[decayIcon] = setInterval(
          bind(
            {decayIcon: decayimageicon, title: title}, 
            downloadDecayimageIconsInterval), 
          1000);
      }
      rows.next();
    }
  }

  var downloadCategoryIconsInterval = function() {
    // If we cant set the semaphore then we do not have access to the HTTP 
    // Client yet.
    if (!MarchHare.xhrGetSemaphore(
        'Downloading '+this.icon)) {
      return;
    }

    MarchHare.xhrProcess({
      url: this.icon,
      file: this.icon.match(fnamere)[0],
      onload: MarchHare.database.handleServerResponseCategoryIcon
    });

    Ti.API.debug('database.js downloadCategoryIcons category icon finished');
    clearInterval(intervals[this.icon]);
  }

  var downloadDecayimageIconsInterval = function() {
    // If we cant set the semaphore then we do not have access to the HTTP 
    // Client yet.
    if (!MarchHare.xhrGetSemaphore(
        'Downloading '+this.decayIcon)) {
      return;
    }

    MarchHare.xhrProcess({
      url: this.decayIcon,
      file: this.decayIcon.match(fnamere)[0],
      onload: MarchHare.database.handleServerResponseDecayIcon
    });

    Ti.API.debug('database.js downloadCategoryIcons decayimage icon finished');
    clearInterval(intervals[this.decayIcon]);
  }

  MarchHare.database.getFilteredCategoryArray = function() {
    var query = 'SELECT id FROM categories WHERE filter=1';
    var result = db.execute(query);
    var categories = [];
    while (result.isValidRow()) {
      categories.push(result.fieldByName('id'));
      result.next();
    }
    return categories;
  }

  MarchHare.database.setIncident = function(incident) {
    var i;
    var query;
    var result;

    // We assume that all categories we recieve here will already exisit in the
    // database.  This will have to be accomplished with a call to 
    // initializeCategories 
    // TODO: call initializeCategories again here if we find a new category
    
    // Insert the incident
    query = 'INSERT INTO incidents(id, title, description, date, lat, lon, ended) '+
      'VALUES('+ incident.incident.incidentid +', "'+ 
          DoAsciiHex(incident.incident.incidenttitle, 'A2H') +'", "'+
          DoAsciiHex(incident.incident.incidentdescription, 'A2H') +'", "'+ 
          incident.incident.incidentdate +'", '+
          incident.incident.incidentlatitude +', '+ 
          incident.incident.incidentlongitude +', '+
          incident.incident.incidenthasended +')';
    i = db.execute(query);
    result = db.lastInsertRowId;

    // Insert rows for the incident_category join table
    for (i in incident.categories) {
      query = 'INSERT INTO incident_categories(category_id, incident_id) '+
        'VALUES('+ incident.categories[i].category.id +', '+ incident.incident.incidentid +')';
      db.execute(query);
    }

    return result;
  };

  MarchHare.database.updateIncident = function(incident) {
    var query = 'UPDATE incidents SET '+
      'title=\''+ DoAsciiHex(incident.incident.incidenttitle, 'A2H') +'\', '+
      'description=\''+ DoAsciiHex(incident.incident.incidentdescription, 'A2H') +'\', '+
      'date=\''+ incident.incident.incidentdate+'\', '+
      'lat='+ incident.incident.incidentlatitude+', '+
      'lon='+ incident.incident.incidentlongitude+', '+
      'ended='+ incident.incident.incidenthasended+' '+
      'WHERE id='+incident.incident.incidentid;

    db.execute(query);

    // Update all categories associated with the incident
    query = 'SELECT * FROM incident_categories WHERE incident_id='+
      incident.incident.incidentid;
    rows = db.execute(query);

    // Get a list of new categories
    var newCats = [];
    for (i in incident.categories) {
      newCats.push(incident.categories[i].category.id);
    }

    // Get a list of currently assigned categories
    var cats = [];
    while (rows.isValidRow()) {
      cats.push(rows.fieldByName('category_id'));
      rows.next();
    }
    rows.close();

    // Look for any new cats and add them
    for (i in newCats) {
      if (!i in cats) {
        query = 'INSERT INTO incident_categories(category_id, incident_id)'+
          'VALUES('+ i +', '+ incident.incident.incidentid +')';
        db.execute(query);
      }
    }
    
    // Look for any deleted cats and remove them
    for (i in cats) {
      if (!i in newCats) {
        query = 'DELETE FROM incident_categories where category_id='+ i 
          +' AND incident_id='+ incident.incident.incidentid;
        db.execute(query);
      }
    }

  }

  MarchHare.database.setIncidentRead = function(id, read) {
    // sanity check our arguments
    if (
      typeof id !== 'number' ||
      typeof read !== 'boolean'
      ){
      return false;
    }

    // make sure the incident exists
    var rows = MarchHare.database.getIncident({incidentid: id});
    if (rows.rowCount == 0) {
      return false;
    }

    var query = 'UPDATE incidents SET read='+((read)?1:0)+' WHERE id='+id;
    return db.execute(query);
  }

  MarchHare.database.getIncident = function(incident) {
    var query = 'SELECT * FROM incidents '+
          'WHERE id='+ incident.incidentid;

    return result = db.execute(query);
  };

  MarchHare.database.getIncidentJSON = function(incident) {
    var rows = MarchHare.database.getIncident(incident.incident);
    if (rows.rowCount == 0) {
      return false;
    }

    var incident = {
      incident: {
        incidentid: rows.fieldByName('id'),
        incidenttitle: DoAsciiHex(rows.fieldByName('title'), 'H2A'),
        incidentdescription: DoAsciiHex(rows.fieldByName('description'), 'H2A'),
        incidentdate: rows.fieldByName('date'),
        locationlatitude: rows.fieldByName('lat'),
        locationlongitude: rows.fieldByName('lon'),
        incidenthasended: rows.fieldByName('ended')
      },
      icon: []
    };

    // TODO: this does not take into consideration decayicon images
    // get the associated category icons in the object
    query = 'SELECT icon FROM categories '+
      'LEFT JOIN incident_categories ON '+
      '(incident_categories.category_id = categories.id) '+
      'WHERE incident_categories.incident_id='+ incident.incident.incidentid;

    rows = db.execute(query);
    while (rows.isValidRow()) {
      incident.icon.push(rows.fieldByName('icon'));
      rows.next();
    }
    rows.close();

    return incident;
  }

  MarchHare.database.getIncidents = function() {
    var query = 'SELECT * FROM incidents '+
      'ORDER BY incidents.date DESC';
    return db.execute(query);
  }

  MarchHare.database.getFilteredIncidents = function() {
    // Get a list of all category ids that we are filtering by
    var query = 'select incidents.id, incidents.title, incidents.description, '+
      'incidents.date, incidents.lat, incidents.lon, incidents.ended, '+
      'incidents.read FROM incidents '+
      'join incident_categories on '+
        '(incidents.id = incident_categories.incident_id) '+
      'join categories on '+
        '(incident_categories.category_id = categories.id) '+
      'WHERE categories.filter=1 '+
      'GROUP BY incidents.id '+
      'ORDER BY incidents.date DESC';
    return db.execute(query);
  }

  MarchHare.database.getIncidentsJSON = function(filter) {
    var query;
    var rows;
    if (typeof filter === 'undefined') {
     rows = MarchHare.database.getIncidents();
    } else {
      rows = MarchHare.database.getFilteredIncidents();
    }
    var incidents = [];
    while (rows.isValidRow()) {
      var incident = {
        incident: {
          incidentid: rows.fieldByName('id'),
          incidenttitle: DoAsciiHex(rows.fieldByName('title'), 'H2A'),
          incidentdescription: DoAsciiHex(rows.fieldByName('description'), 'H2A'),
          incidentdate: rows.fieldByName('date'),
          locationlatitude: rows.fieldByName('lat'),
          locationlongitude: rows.fieldByName('lon'),
          incidenthasended: rows.fieldByName('ended'),
          incidentread: rows.fieldByName('read')
        },
        icon: []
      };
      rows.next();

      // TODO: this does not take into consideration decayicon images
      // get the associated category icons in the object
      query = 'SELECT icon,decayimage FROM categories '+
        'LEFT JOIN incident_categories ON '+
        '(incident_categories.category_id = categories.id) '+
        'WHERE incident_categories.incident_id='+ incident.incident.incidentid;

      catRows = db.execute(query);
      while (catRows.isValidRow()) {
        if (incident.incident.incidenthasended == 1) {
          incident.icon.push(catRows.fieldByName('decayimage'));
        } else {
          incident.icon.push(catRows.fieldByName('icon'));
        }
        catRows.next();
      }
      catRows.close();

      incidents.push(incident);
    }
    rows.close();

    result = JSON.stringify(incidents);
    return result;
 }

  MarchHare.database.flushIncidents = function() {
    var query = 'DELETE from incidents';
    return db.execute(query);
  }

  MarchHare.database.initializeIncidents = function() { 
    MarchHare.database.flushIncidents();
    var url = 'http://'+ 
        Ti.App.Properties.getString('action_domain',
          MarchHare.settings.action_domain.default_value)+
        '/api?task=decayimage';

    // TODO: start an indicator
    var t = setInterval(function() {

      // If we cant set the semaphore then we do not have access to the HTTP 
      // Client yet.
      if (!MarchHare.xhrGetSemaphore()) {
        return;
      }

      MarchHare.xhrProcess({
        url: url,
        onload: function(response) { 
          handleServerResponse(response);
          Ti.App.fireEvent('incidentsDownloaded');
        }
      });

      clearInterval(t);
    }, 100);
  }

  MarchHare.database.handleServerResponseIncidents = function(response) {
    var jNewIncidents = JSON.parse(response);
    var newIncidents = false;

    if (
      typeof jNewIncidents == 'undefined' ||
      typeof jNewIncidents.payload == 'undefined' ||
      typeof jNewIncidents.payload.incidents == 'undefined' ||
      !(jNewIncidents.payload.incidents instanceof Array) ){
      Ti.API.error('initializeIncidents: recieved invalid json from the server: '+
        JSON.stringify(jNewIncidents));
      return false;
    }

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
        },
        categories: jNewIncidents.payload.incidents[i].categories
      };

      MarchHare.database.setIncident(incident);
    }

    if (!newIncidents) {
      Ti.API.debug('nitializeIncidents: did not recieve any reports');
    }
  }

  MarchHare.database.initializeMidPoint = function() {
    var url = 'http://'+ 
        Ti.App.Properties.getString('action_domain',
        MarchHare.settings.action_domain.default_value)+
        '/api?task=geographicmidpoint';


    // TODO: start an indicator
    var t = setInterval(function() {

      // If we cant set the semaphore then we do not have access to the HTTP 
      // Client yet.
      if (!MarchHare.xhrGetSemaphore('Initializing action location')) {
        return;
      }

      MarchHare.xhrProcess({
        url: url,
        onload: MarchHare.database.handleServerResponseGeoLocation
      });

      clearInterval(t);
    }, 100);
  }

  MarchHare.database.handleServerResponseGeoLocation = function(response) {
    var payload = JSON.parse(response);
    var i;

    // Get the categories from the server and insert any new ones 
    if (
      typeof payload != 'undefined' &&
      typeof payload.payload != 'undefined' &&
      typeof payload.payload.geographic_midpoint != 'undefined' &&
      payload.payload.geographic_midpoint instanceof Array &&
      typeof payload.payload.geographic_midpoint[0].latitude != 'undefined' &&
      typeof payload.payload.geographic_midpoint[0].longitude != 'undefined'
    ) {
      Ti.App.Properties.setDouble('action_latitude', 
        payload.payload.geographic_midpoint[0].latitude);
      Ti.App.Properties.setDouble('action_longitude', 
        payload.payload.geographic_midpoint[0].longitude);
    }
    else {
      Ti.API.error('InitializeGeoLocation: We recieved an invalid response '+
        'from the server: '+ JSON.stringify(payload));
    }
    Ti.App.fireEvent('geolocationDownloaded');
  }

  // This will perform some tests on the database and log the results.  The 
  // database will not retain data already stored in it after this operation
  MarchHare.database.testDatabase = function () {
    var result;
    var arg;
    var query;

    // g/s settings
    MarchHare.database.setSetting('test', 'test');
    result = MarchHare.database.getSetting('test');
    Ti.API.debug('database.js::testDatabase: set test=test, recieved test='+result);
    MarchHare.database.flushSettings();
    result = MarchHare.database.getSetting('test');
    Ti.API.debug('database.js::testDatabase: flushed settings, recieved test='+result);

    // g/s category
    MarchHare.database.flushCategories();
    MarchHare.database.flushIncidentCategories();
    MarchHare.database.initializeCategories();

    Titanium.App.addEventListener('categoriesDownloaded',
                testDatabaseCategoriesInit);

    // g/s incidents
    MarchHare.database.flushIncidents();
    MarchHare.database.initializeIncidents();
    Titanium.App.addEventListener('incidentsDownloaded',
                testDatabaseIncidentsInit);

    // Test Crazy inserts
    var incident = {
      incident: {
        incidentid: 666,
        incidenttitle: 'This\'s some crazy; Ass &*^%$#@)(\'\'\'\' shiz!',
        incidentdescription: 'This\'s some crazy; Ass &*^%$#@)(\'\'\'\' shiz!',
        incidentdate: '2012-05-09',
        incidentlatitude:41.885537633863635,
        incidentlongitude:-87.63296127319336,
        incidenthasended: 0
      }
    };
    var id = MarchHare.database.setIncident(incident);
    Ti.API.debug('Testing wonky characters in incidents.  Added '+ 
      JSON.stringify(incident));
    Ti.API.debug('Testing wonky characters in incidents.  Recieved '+ 
      JSON.stringify(MarchHare.database.getIncidentJSON({incident: { incidentid: 666 }})));

  }

  function testDatabaseCategoriesInit() {
    Ti.API.debug('database.js::testDatabase: initialized categories');
    query = 'SELECT * from categories';
    result = db.execute(query);
    while (result.isValidRow()) {
      Ti.API.debug('database.js::testDatabase: '+
        'categories.id='+result.fieldByName('id')+', '+
        'categories.title='+result.fieldByName('title'));
      result.next();
    }
    result.close();
  }

  function testDatabaseIncidentsInit() {
    var result = JSON.parse(MarchHare.database.getIncidentsJSON());
    Ti.API.debug('database.js::testDatabase: intialized incidents:');
    for (i in result) {
      var output = 'incidents.id='+result[i].incident.incidentid+', '+
        'incidents.title='+result[i].incident.incidenttitle +', icons= '+        JSON.stringify(result[i].icon);
      Ti.API.debug(output);
    }

    // Get a non existing incident
    result = MarchHare.database.getIncident({incidentid: 3117});
    Ti.API.debug('database.js::testDatabase: non existing incident returned '+ 
      result.rowCount +' rows');

    // Set read for some incident
    var query = 'SELECT * FROM incidents LIMIT 1';
    var rows = db.execute(query);
    var id = rows.fieldByName('id');
    Ti.API.debug('database.js::testDatabase: setIncidentRead('+id+', true) before '+ 
      rows.fieldByName('read'));
    MarchHare.database.setIncidentRead(id, true);
    query = 'SELECT * FROM incidents where id='+id;
    rows = db.execute(query);
    Ti.API.debug('database.js::testDatabase: setIncidentRead('+id+', true) after '+ 
      rows.fieldByName('read'));

  }

  // Useful for making the "arguments" object a true array and also for creating a
  // copy of an existing array.
  function toArray(obj) {
      return Array.prototype.slice.call(obj);
  }

  // Bind in its simplest form

  function bind(scope, fn) {
      return function () {
          return fn.apply(scope, toArray(arguments));
      };
  }

  /*
      DoAsciiHex comes from CryptoMX Tools: http://bit.ly/KN8UG4

      CryptoMX Tools
      Copyright (C) 2004 - 2006 Derek Buitenhuis

      This program is free software; you can redistribute it and/or
      modify it under the terms of the GNU General Public License
      as published by the Free Software Foundation; either version 2
      of the License, or (at your option) any later version.

      This program is distributed in the hope that it will be useful,
      but WITHOUT ANY WARRANTY; without even the implied warranty of
      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
      GNU General Public License for more details.

      You should have received a copy of the GNU General Public License
      along with this program; if not, write to the Free Software
      Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
  */
  function DoAsciiHex(x,dir) {
    hex="0123456789ABCDEF";
    almostAscii=' !"#$%&'+"'"+'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ['+'\\'+']^_`abcdefghijklmnopqrstuvwxyz{|}';
    r="";
    if(dir=="A2H") {
      for (i=0; i<x.length; i++) {
        let=x.charAt(i);
        pos=almostAscii.indexOf(let)+32;
        h16=Math.floor(pos/16);
        h1=pos%16;
        r+=hex.charAt(h16)+hex.charAt(h1);
      };
    };

    if(dir=="H2A") {
      for (i=0; i<x.length; i++) {
        let1=x.charAt(2*i);
        let2=x.charAt(2*i+1);
        val=hex.indexOf(let1)*16+hex.indexOf(let2);
        r+=almostAscii.charAt(val-32);
      };
    };
    return r;
 };

})();

