(function () {
  var db  = Ti.Database.install('march-hare/incidents.sqllite', 'incidents');

  MarchHare.database.setSetting = function(key, value) {
    var query = 'DELETE FROM settings WHERE key="'+key+'"';
    db.execute(query);

    query = 'INSERT INTO settings (key, value) VALUES("'+
      key +'", "'+ value +'")';
    return db.execute(query);
  }

  MarchHare.database.getSetting = function(key) {
    var query = 'SELECT value FROM settings WHERE key="'+key+'"';
    var rows = db.execute(query);
    var value = '';
    if (rows.isValidRow()) {
      value = rows.fieldByName('value');
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

    // TODO: return the category id on success, false on error
    return db.execute(query);
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

  MarchHare.database.initializeCategories = function() {
    var url = 'http://'+ 
        Ti.App.Properties.getString('action_domain',
        MarchHare.settings.action_domain.default_value)+
        '/api/?task=decayimagecategories';

    var xhr = Ti.Network.createHTTPClient({
      onload: function(){
        Ti.API.debug("GET "+url+' response: '+ this.responseText);
        var categories = JSON.parse(this.responseText);
        var i;

        // Get the categories from the server and insert any new ones 
        if (
          typeof categories != 'undefined' &&
          typeof categories.payload != 'undefined' &&
          typeof categories.payload.categories != 'undefined' &&
          categories.payload.categories instanceof Array &&
          typeof categories.payload.decayimage_default_icon != 'undefined'
        ) {
          for (i in categories.payload.categories) {
            MarchHare.database.setCategory(categories.payload.categories[i].category);
          };

          // Get the default decayimage
          MarchHare.database.setSetting('decayimage_default_icon', 
            categories.payload.decayimage_default_icon);
        }
        else {
          Ti.API.error('InitializeCategories: We recieved an invalid response '+
            'from the server: '+ JSON.stringify(categories));
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
   
    // Get the categories from the server 
    xhr.open("GET", url);
    xhr.send();

    // TODO: pull down all the category icons and decayimages for local storage
  };

  MarchHare.database.setIncident = function(incident) {
    var i;
    var query;

    // We assume that all categories we recieve here will already exisit in the
    // database.  This will have to be accomplished with a call to 
    // initializeCategories 
    // TODO: call initializeCategories again here if we find a new category
    
    // Insert the incident
    query = 'INSERT INTO incidents(id, title, description, date, lat, lon) '+
      'VALUES('+ incident.incident.incidentid +', "'+ incident.incident.incidenttitle +'", "'+
          incident.incident.incidentdescription +'", "'+ incident.incident.incidentdate +'", '+
          incident.incident.incidentlatitude +', '+ incident.incident.incidentlongitude +')';
    db.execute(query);

    // Insert rows for the incident_category join table
    for (i in incident.categories) {
      query = 'INSERT INTO incident_categories(incident_id, category_id) '+
        'VALUES('+ incident.categories[i].category.id +', '+ incident.incident.incidentid +')';
      db.execute(query);
    }
  };

  MarchHare.database.updateIncident = function(incident) {
    var query = 'UPDATE incident '+
      'SET title='+ incident.incidenttitle +', '+
      'SET description='+ incident.incident.description+', '+
      'SET date='+ incident.incident.date+', '+
      'SET lat='+ incident.incident.latitude+', '+
      'SET lon='+ incident.incident.longitude+' '+
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

  MarchHare.database.getIncident = function(incident) {
    var query;

    query = 'SELECT incidents.*, categories.* FROM incidents '+
          'LEFT JOIN incident_categories ON (incidents.id = incident_categories.incident_id) '+
          'LEFT JOIN categories ON (incident_categories.category_id = categories.id) '+
          'WHERE incidents.id='+ incident.incidentid;

    return db.execute(query);
  };

  MarchHare.database.getIncidents = function() {
    var query = 'SELECT incidents.*, categories.* FROM incidents '+
      'LEFT JOIN incident_categories on (incident_categories.incident_id - incidents.id) '+
      'LEFT JOIN categories on (categories.id = incident_categories.category_id)';

    return db.execute(query);
  }

  MarchHare.database.getIncidentsJSON = function() {
    var query;
    var rows = MarchHare.database.getIncidents();
    var incidents = [];
      Ti.API.debug(JSON.stringify(rows));
    while (rows.isValidRow()) {
      var incident = {
        incident: {
          incidentid: rows.fieldByName('id'),
          incidenttitle: rows.fieldByName('title'),
          incidentdescription: rows.fieldByName('description'),
          incidentdate: rows.fieldByName('date'),
          locationlatitude: rows.fieldByName('lat'),
          locationlongitude: rows.fieldByName('lon')
        },
        icon: []
      };
      rows.next();

      // TODO: this does not take into consideration decayicon images
      // get the associated category icons in the object
      query = 'SELECT url FROM categories '+
        'LEFT JOIN incident_categories ON '+
        '(incident_categories.category_id = categories.id) '+
        'WHERE incident_categories.incident_id='+ incident.incident.incidentid;

      catRows = db.execute(query);
      while (catRows.isValidRow()) {
        incident.icon.push(rows.fieldByName('url'));
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
    var xhr = Ti.Network.createHTTPClient();
    xhr.timeout = 5000;
    xhr.open("GET", url);
    xhr.onload = function() { 
      handleServerResponse(this.responseText);
    };
    xhr.onerror = function(e) { logServerError(e); };
    xhr.send();
  }

  function handleServerResponse(response) {
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

  function logServerError(e) {
    // TODO: we want to notify the user somehow, but we dont want to 
    // send an alert for each failure.  Maybe we can store the error 
    // statistics somehow and display them to the user in a menu somewhere
    Ti.API.debug("STATUS: " + this.status);
    Ti.API.debug("TEXT: " + this.responseText);
    Ti.API.debug("ERROR: " + e.error);
    Ti.API.error('Unable to get json from: '+ url);
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
    MarchHare.database.initializeCategories();
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

    // g/s incidents
    MarchHare.database.initializeIncidents();
    result = JSON.parse(MarchHare.database.getIncidentsJSON());
    Ti.API.debug('database.js::testDatabase: intialized incidents:');
    for (i in result) {
      var output = 'incidents.id='+result[i].incident.incidentid+', '+
        'incidents.title='+result[i].incident.incidenttitle +', icons= '+
        JSON.stringify(result[i].icon);
      Ti.API.debug(output);
    }
  }

})();
