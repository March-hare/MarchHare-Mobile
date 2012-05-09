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
        // title is a keyword that we dont want to use here
        tit: incidents[i].incident.incidenttitle,
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
          backgroundColor: '#000'
				});
        var scrollview = Ti.UI.createScrollView({ 
					layout: 'vertical',
					contentHeight: 'auto',
					contentWidth: 'auto',
				 });
        //var scrollview = Ti.UI.createScrollView({ });
				//var view = Ti.UI.createView({ layout:'vertical' });

				e.row.backgroundColor = '#000000';

				// TODO: add the location name 
				//view.add(
				//infowin.add(
        scrollview.add(
					Ti.UI.createLabel({ 
						text: 'Title: '+e.rowData.tit, 
						color: '#FFF', 
						top: 20, height: 'auto', 
						left: 0,
					}));

        scrollview.add(
        //view.add(
					Ti.UI.createLabel({ 
						text: 'Reported at: '+e.rowData.date, 
						color: '#FFF', 
						top: 30, height: 'auto',
						left: 0,
					}));

				// From: http://bit.ly/GMVY7v
				//infowin.add(
				scrollview.add(
				//view.add(
					Ti.UI.createLabel({ 
						text: e.rowData.desc, 
						color: '#FFF', 
						top: 70, height: 'auto',
						left: 0,
					}));

				var closeButton = Ti.UI.createButton({ 
					title: 'close', 
					height: 30, bottom: 10
				});

				closeButton.addEventListener('click', function() {
					infowin.close();
				});
        scrollview.add(closeButton);
        //view.add(closeButton);

				//scrollview.add(view);
				//infowin.add(view);
				infowin.add(scrollview);
				//infowin.add( closeButton );
				infowin.open({ modal: true });
				//infowin.open();
      });

      // It does not seem like android will fire longpresses, but I am not
      // sure that iOS doesn't fire both
      if (MarchHare.ui.Android) {
        data[i].addEventListener('longclick', fireGotoLocation);
      } else {
        data[i].addEventListener('longpress', fireGotoLocation);
      }

      function fireGotoLocation(e) {
        Ti.API.log('longpress or longclick detected gotoLocation being fired');
				Ti.App.fireEvent('gotoLocation', {
					lat: e.rowData.lat,
					lon: e.rowData.lon
				});
      }

      // TODO: we should move all formatting stuff like this to jss files
      var top = -2;
      if (!MarchHare.ui.Android) {
        top = -30;
      }
      data[i].add(Ti.UI.createLabel({
        text: incidents[i].incident.incidenttitle,
        top: top, left:0, color: '#FFF'
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

    // On Android we close the window, iOS we switch tabs
    Ti.App.addEventListener('gotoLocation', function(e){
      if (MarchHare.ui.Android) {
        win.close();
      } else {
        tabGroup.setActiveTab(mapTab);
      }
    });

		win.add(view);
		return win;
  }

  Ti.API.log('Reports.js loaded');
})();

