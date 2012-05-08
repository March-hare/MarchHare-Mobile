/*
	- Applying filters to the reports listing is not working

*/

(function () {
  MarchHare.ui.createReportsView = function() { 
    var data = [];
    var incidents = MarchHare.database.getIncidentsJSON({});
    var tableView;
    incidents = JSON.parse(incidents);

    for (i in incidents) {
      data[i] = Ti.UI.createTableViewRow({
        hasChild: true,
				height: 50,
				top: 0,
        desc: incidents[i].incident.incidentdescription,
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
				MarchHare.database.setIncidentRead(e.rowData.id, true);
				var infowin = Titanium.UI.createWindow({
					title: e.rowData.title,
				});
				var view = Ti.UI.createView({
					layout:'vertical',
				});

				e.row.backgroundColor = '#000000';

				// TODO: add the location name 
				//view.add(
				infowin.add(
					Ti.UI.createLabel({ 
						text: 'Reported at: '+e.rowData.date, 
						color: '#FFF', top: 20, height: 'auto',
						left: 0,
					}));

				// From: http://bit.ly/GMVY7v
				infowin.add(
					Ti.UI.createLabel({ 
						text: e.rowData.desc, 
						color: '#FFF', top: 50, height: 'auto',
						left: 0,
					}));

				var closeButton = Ti.UI.createButton({ 
					title: 'close', height: 30, bottom: 10
				});

				closeButton.addEventListener('click', function() {
					infowin.close();
				});

				infowin.add(view);
				infowin.add( closeButton );
				infowin.open({ modal: true });
      });

			data[i].addEventListener('longpress', function(e) {
				// close this window and center the map on the clicked incident
				Ti.API.log('reports longclick handler');
				Ti.App.fireEvent('gotoLocation', {
					lat: e.rowData.lat,
					lon: e.rowData.lon
				});

				// On Android we close the window
				// On iOS we change the tabGroup
				if (Ti.Platform.osname == 'android') {
					win.close();
				} else {
					tabGroup.setActiveTab(mapTab);
				}
			});

      data[i].add(Ti.UI.createLabel({
        text: incidents[i].incident.incidenttitle,
        top: -30, left:0, color: '#FFF'
      }));

      // TODO: It's possible that there are empty strings in incidents[i].icon
      // this is probably a bug in MarchHare.database.getIncidentsJSON or else
      // where that needs to get fixed.
      var filere = /^file:\/\/\/|^\//;
      for (j in incidents[i].icon) {
				var file;
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
          image: file,
          top: 30, width: 16, height: 16, left: 20*j
        }));
      }
    }

    if (!incidents.length) {
      data.push(
        Ti.UI.createTableViewRow({title: 'No reports have been added'}));
    } 

    tableView = Titanium.UI.createTableView({data: data});

    return tableView;
  }

  MarchHare.ui.createReportsWindow = function() { 
		// We do not use modal windows on iOS
		var useModal = (Ti.Platform.osname == 'android') ? true : false;
    var win = Ti.UI.createWindow({
      backgroundColor: '#000',
      title: 'Reports',
      modal: useModal
    });
    var view = MarchHare.ui.createReportsView();

		win.add(view);
		return win;
  }

  Ti.API.log('Reports.js loaded');
})();

