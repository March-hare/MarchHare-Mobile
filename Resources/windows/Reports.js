(function () {
  MarchHare.ui.createReportsView = function() { 
    var data = [];
    var incidents = MarchHare.database.getIncidentsJSON({});
    var tableView;
    incidents = JSON.parse(incidents);

    for (i in incidents) {
      data[i] = Ti.UI.createTableViewRow({
        hasChild: true,
        height: 'auto',
        description: incidents[i].incident.incidentdescription,
        lat: incidents[i].incident.locationlatitude,
        lon: incidents[i].incident.locationlongitude,
        date: incidents[i].incident.incidentdate,
        id: incidents[i].incident.incidentid,
        categories: incidents[i].icon,
        ended: incidents[i].incident,
        backgroundColor: ((incidents[i].incident.incidentread) ? '#000000' : '#404040')
      });
      data[i].addEventListener('click', function(e) {
        e.rowData.backgroundColor = '#000000';
      });

      data[i].add(Ti.UI.createLabel({
        text: incidents[i].incident.incidenttitle,
        left:0
      }));

      // TODO: It's possible that there are empty strings in incidents[i].icon
      // this is probably a bug in MarchHare.database.getIncidentsJSON or else
      // where that needs to get fixed.
      var filere = /^file:\/\/\//;
      var file;
      for (j in incidents[i].icon) {
        if (!incidents[i].icon[j].length) { continue; }

        // If it is a file make sure it exists
        if (incidents[i].icon[j].match(filere)) {
          file = Titanium.Filesystem.getFile(incidents[i].icon[j]);
          if (!file.exists()) {
            continue;
          }
        } else {
          // TODO: the Titanium.UI.createImageView actually does not accept
          // web urls as arguments for backgroundImage :(
          continue;
        }

        data[i].add(Titanium.UI.createImageView({
          backgroundImage: incidents[i].icon[j],
          top: 40, width: 16, height: 16, left: 20*j
        }));
      }
      //break;
    }

    if (!incidents.length) {
      data.push(
        Ti.UI.createTableViewRow({title: 'No reports have been added'}));
    } 
    tableView = Titanium.UI.createTableView({data: data});

    return tableView;
  }

  MarchHare.ui.createReportsWindow = function() { 
    var win = Ti.UI.createWindow({
      backgroundColor: '#000',
      title: 'Reports',
      modal: true 
    });
    var view = MarchHare.ui.createReportsView();
    view.addEventListener('click', function(e) {
      var infowin = Titanium.UI.createWindow({
        modal:true,
        title:e.rowData.title
      });
      var view = Ti.UI.createView({
        layout:'vertical',
        backgroundColor: 'black',
        color: 'white'
      });

      MarchHare.database.setIncidentRead(e.rowData.id, true);
      e.row.backgroundColor = '#000000';

      // TODO: add the location name 
      view.add(
        Ti.UI.createLabel({ 
          text: 'Reported at: '+e.rowData.date, 
          left: 0
        }));

      // From: http://bit.ly/GMVY7v
      view.add(
        Ti.UI.createLabel({ 
          text: e.rowData.description, 
          left: 0
        }));

      infowin.add(view);
      infowin.open();
    });

    view.addEventListener('longclick', function(e) {
      // close this window and center the map on the clicked incident
      Ti.App.fireEvent('gotoLocation', {
        lat: e.rowData.lat,
        lon: e.rowData.lon
      });
      win.close();
    });
    win.add(view);
    return win;
  }

  Ti.API.debug('Reports.js loaded');
})();

