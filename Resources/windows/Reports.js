(function () {
  MarchHare.ui.createReportsView = function() { 
    var data = [];
    var incidents = MarchHare.database.getIncidentsJSON({});
    var tableView;
    incidents = JSON.parse(incidents);

    // TODO: for each incident there should be a table row that
    // displays the title along with the incident icons.  I am not
    // sure how to add the icons without the local img store feature
    for (i in incidents) {
      data[i] = Ti.UI.createTableViewRow({
        hasChild: true,
        title: 'test',
        height: 'auto',
        message: incidents[i].incident.incidentdescription,
        lat: incidents[i].incident.locationlatitude,
        lon: incidents[i].incident.locationlongitude,
        date: incidents[i].incident.incidentdate,
        categories: incidents[i].icon
        // TODO: We will save implementing this for the alerts issue
        //backgroundColor: (incidents[i].read?'black':'grey')
      });

      data[i].add(Ti.UI.createLabel({
        text: incidents[i].incident.incidenttitle,
        left:0
      }));

      // TODO: It's possible that there are empty strings in incidents[i].icon
      // this is probably a bug in MarchHare.database.getIncidentsJSON or else
      // where that needs to get fixed.
      for (j in incidents[i].icon) {
        if (!incidents[i].icon[j].length) { continue; }
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
      Ti.API.debug('MarchHare.ui.createReportsView clickHandler e:'+ JSON.stringify(e));
      var infowin = Titanium.UI.createWindow({
        modal:true,
        title:e.rowData.title
      });
      var view = Ti.UI.createView({
        layout:'vertical',
        backgroundColor: 'black',
        color: 'white'
      });

      // TODO: add the location name 
      view.add(
        Ti.UI.createLabel({ 
          text: 'Reported at: '+e.rowData.date, 
          left: 0
        }));

      // From: http://bit.ly/GMVY7v
      view.add(
        Ti.UI.createLabel({ 
          text: e.rowData.message, 
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

