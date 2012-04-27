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
  db  = Ti.Database.install('incidents.sqlite', 'incidents');

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
      'VALUES('+ category.id +', "'+ category.title +'", "'+ category.icon 
      +'", "'+ category.decayimage +'")';

    // TODO: return false on error
    db.execute(query);
    return db.lastInsertRowId;
  };

  // TODO: protect against sql injection
  MarchHare.database.getCategory = function(category) {
    if (typeof category == 'undefined') {
      return false;
    }

    var query = '';
    if (typeof category.id != 'undefined') {
      query = 'SELECT * from categories where id=' + category.id;
    }
    else if (typeof category.title != 'undefined') {
      query = 'SELECT * from categories where title=' + category.title;
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
        title: rows.fieldByName('title'),
        icon: rows.fieldByName('icon'),
        decayimage: rows.fieldByName('decayimage'),
        filter: rows.fieldByName('filter'),
      };
      categories.push(category);
      rows.next();
    }
    return JSON.stringify(categories);
  };

  MarchHare.database.initializeCategories = function() {
    var url = 'http://'+ 
        Ti.App.Properties.getString('action_domain',
        MarchHare.settings.action_domain.default_value)+
        '/api/?task=decayimagecategories';


    // TODO: start an indicator
    var t = setInterval(function() {

      // If we cant set the semaphore then we do not have access to the HTTP 
      // Client yet.
      if (!MarchHare.xhrGetSemaphore()) {
        Ti.API.info('Delaying categories request because the HTTP Client is in use.');
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
          Ti.API.debug('preserving category filter category: '+filter);
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

  MarchHare.database.flushCategories = function() {
    var query = "DELETE FROM categories";
    db.execute(query);
  };

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
      'VALUES('+ incident.incident.incidentid +', "'+ incident.incident.incidenttitle +'", "'+
          incident.incident.incidentdescription +'", "'+ incident.incident.incidentdate +'", '+
          incident.incident.incidentlatitude +', '+ incident.incident.incidentlongitude +', '+
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
    var query = 'UPDATE incident '+
      'SET title='+ incident.incidenttitle +', '+
      'SET description='+ incident.incident.description+', '+
      'SET date='+ incident.incident.incidentdate+', '+
      'SET lat='+ incident.incident.incidentlatitude+', '+
      'SET lon='+ incident.incident.incidentlongitude+' '+
      'SET ended='+ incident.incident.incidenthasended+' '+
      'WHERE id='+incident.incident.incidentid;

    db.execute(query);

    // Update all categories associated with the incident
    query = 'SELECT * FROM incident_categories WHERE incident_id='+
      incident.incident.incidentid;

    // Get a list of new categories
    var newCats = [];
    for (i in incident.categories) {
      newCats.push(incident.categories[i].category.id);
    }

    // Get a list of currently assigned categories
    var cats = []
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
      if (!i in newcats) {
        query = 'DELETE FROM incident_categories where category_id='+ i 
          +' AND incident_id='+ incident.incident.incidentid;
        db.execute(query);
      }
    }

  }

  // TODO: this needs to be rewritten so it does not create multiple rows for 
  // each category.
  MarchHare.database.getIncident = function(incident) {
    var query;

    query = 'SELECT * FROM incidents '+
          'WHERE id='+ incident.incidentid;

    return db.execute(query);
  };

  MarchHare.database.getIncidentJSON = function(incident) {
    var rows = MarchHare.database.getIncident(incident.incident);
    if (rows.rowCount == 0) {
      return false;
    }

    var incident = {
      incident: {
        incidentid: rows.fieldByName('id'),
        incidenttitle: rows.fieldByName('title'),
        incidentdescription: rows.fieldByName('description'),
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
    var query = 'SELECT * FROM incidents';
    return db.execute(query);
  }

  MarchHare.database.getFilteredIncidents = function() {
    // Get a list of all category ids that we are filtering by
    var query = 'select incidents.id, incidents.title, incidents.description, '+
      'incidents.date, incidents.lat, incidents.lon, incidents.ended from incidents '+
      'join incident_categories on '+
        '(incidents.id = incident_categories.incident_id) '+
      'join categories on '+
        '(incident_categories.category_id = categories.id) '+
      'WHERE categories.filter=1 '+
      'GROUP BY incidents.id';
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
          incidenttitle: rows.fieldByName('title'),
          incidentdescription: rows.fieldByName('description'),
          incidentdate: rows.fieldByName('date'),
          locationlatitude: rows.fieldByName('lat'),
          locationlongitude: rows.fieldByName('lon'),
          incidenthasended: rows.fieldByName('ended')
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

      Ti.API.debug('MarchHare.database.getIncidentsJSON cat query: '+query);
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
        '/api/?task=decayimage';

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
    result = JSON.parse(MarchHare.database.getIncidentsJSON());
    Ti.API.debug('database.js::testDatabase: intialized incidents:');
    for (i in result) {
      var output = 'incidents.id='+result[i].incident.incidentid+', '+
        'incidents.title='+result[i].incident.incidenttitle +', icons= '+        JSON.stringify(result[i].icon);
      Ti.API.debug(output);
    }

  }

})();

