(function () {
  MarchHare.ui.createReportsView = function() { 
    var tableView = null;
    var data = [];
    var incidents = 
      Ti.App.Properties.getString('incidents',
        MarchHare.settings.incidents.default_value);
  
    for (i in incidents) {
      data.push({
        title: incidents.i.title,
        message: incidents.i.body,
        categories: incidents.i.category,
        messages: incidents.i.messages,
        backgroundColor: (inicidents.i.read?'black':'grey')
      });
    }

    if (!data.length) {
      data.push({title: 'No reports have been added'});

      tableView = Titanium.UI.createTableView({
        data:data,
        backgroundColor: 'black'
      });
    } else {
      tableView = Titanium.UI.createTableView({
        data:data,
        backgroundColor: 'black'
      });

      // set up a click handler for the rows
      tableView.addEventListener('click', function(e) {
        if (e.rowData.test) {
          var win = Titanium.UI.createWindow({
            modal:true,
            title:e.rowData.title
          });
          var view = Ti.UI.createView({layout:'vertical'});

          // From: http://bit.ly/GMVY7v
          view.add(
            Ti.UI.createTextArea({ 
              value: e.rowdata.body, 
            }));

          view.add(
            Ti.UI.createlabel({
              'text': 'Categories'
            }));

          var catMsg = '';
          for (i in e.rowData.categories) {
            catMsg += e.rowData.categories.i.category_title +': '+ 
              e.rowData.categories.i.category_description +"\n";
          }
          view.add(
            Ti.UI.createTextArea({
              value: catMsg
            }));

          win.add(view).open();
        }
      });
    }

    return view;
  }

  MarchHare.ui.createReportsWindow = function() { 
    var win = Titanium.UI.createWindow({
      title: 'Reports'
    });
    return win.add(MarchHare.ui.createReportsView);
  }

})();

