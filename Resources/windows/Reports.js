(function () {
  MarchHare.ui.createReportsView = function() { 
    var tableView = null;
    var data = [];
    var incidents = MarchHare.database.getIncidentsJSON({});
    incidents = JSON.parse(incidents);

    // TODO: for each incident there should be a table row that
    // displays the title along with the incident icons.  I am not
    // sure how to add the icons without the local img store feature
    for (i in incidents) {
      data.push({
        title: incidents[i].incident.incidenttitle,
        message: incidents[i].incident.incidentdescription,
        lat: incidents[i].incident.locationlatitude,
        lon: incidents[i].incident.locationlongitude,
        date: incidents[i].incident.incidentdate,
        categories: incidents[i].icon,
        // TODO: We will save implementing this for the alerts issue
        //backgroundColor: (incidents[i].read?'black':'grey')
      });
    }
    //Ti.API.debug('MarchHare.ui.createReportsView data: '+ JSON.stringify(data));

    if (!data.length) {
      data.push({title: 'No reports have been added'});
      tableView = Titanium.UI.createTableView({
        data:data,
      });
    } else {
      tableView = Titanium.UI.createTableView({
        data:data,
      });

      // TODO: add a longclick handler to jump to the location on the map
      // set up a click handler for the rows
      tableView.addEventListener('click', function(e) {
        Ti.API.debug('MarchHare.ui.createReportsView clickHandler e:'+ JSON.stringify(e));
        var win = Titanium.UI.createWindow({
          modal:true,
          title:e.rowData.title
        });
        var view = Ti.UI.createView({layout:'vertical'});

        // TODO: add the location name and a click handler to jump to the 
        // incident in the webview
        // TODO: add the date 
        // From: http://bit.ly/GMVY7v
        view.add(
          Ti.UI.createTextArea({ 
            value: e.rowData.message, 
          }));

        /*
        view.add(
          Ti.UI.createlabel({
            'text': 'Categories'
          }));

        var catMsg = '';
        for (i in e.rowData.categories) {
          catMsg += e.rowData.categories[i].category_title +': '+ 
            e.rowData.categories[i].category_description +"\n";
        }
        view.add(
          Ti.UI.createTextArea({
            value: catMsg
          }));
          */

        win.add(view);
        win.open();
      });
    }

    return tableView;
  }

  MarchHare.ui.createReportsWindow = function() { 
    var win = Ti.UI.createWindow({
      backgroundColor: '#000',
      title: 'Reports',
      modal: true 
    });
    win.add(MarchHare.ui.createReportsView());
    return win;
  }

  Ti.API.debug('Reports.js loaded');
})();

