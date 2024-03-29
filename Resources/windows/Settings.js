(function () {
  // It was decided not to use the native preferences because there dies not
  // seem to be a way to create dynamic preference lists
  //
  // The example used to create this was pulled from: http://bit.ly/KbLUA7
  
  MarchHare.ui.createSettingsWindow = function() {
    var win = Ti.UI.createWindow({ 
      backgroundColor: '#000',
      title: 'Settings',
      modal: true 
    });

    var sections = new Array;

    var appSettingsSection = Ti.UI.createTableViewSection({
        headerTitle: "Application Settings"
    });

    var domainRow = Ti.UI.createTableViewRow();

    // TODO: this should actually all be wrapped in a table with each setting 
    // that is not a checkbox diverted to its own modal window
    var domainLabel = Ti.UI.createLabel({ 
      text: 'Action Domain: ', 
      top: 0, left: 0,
      color: '#fff' });

    domainRow.add(domainLabel);

    // TODO: as we add more settings we will have different UI fields we will
    // want to use.  We will have to change this dependent on a new property
    // in the MarchHare.settings list
    var domainField = Ti.UI.createTextField( { 
      //top:20, left:0, width: 200,
      left:0, width: 200, top: 20,
      hintText: Ti.App.Properties.getString('action_domain', 
        MarchHare.settings.action_domain.default_value),
      autoCorrect: false,
      autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE
    });

    // TODO: change this to Ti.UI.notification
    var alert = Titanium.UI.createAlertDialog({
      title: 'Settings message'
    });

    // Save changes, and let the application know on success
    domainField.
      addEventListener("blur", function(e) {
        // verify the new input
        if (domainField.value.length) {
          result = verifyActionDomain(domainField.value);
          if (!result.result) {
            alert.message = result.message;
          } else {
            Ti.App.Properties.setString('action_domain', domainField.value);
            alert.message = 'Your changes have been saved';
            Ti.App.fireEvent('actionDomainChanged');
          }

          alert.show();
          setTimeout(function() {
            alert.hide()
          }, 2000); 
        }
      });

    domainRow.add(domainField);
    appSettingsSection.add(domainRow);

		var pollRow = Ti.UI.createTableViewRow();

    var pollLabel = Ti.UI.createLabel({ 
      text: 'Poll Frequency in Seconds:', 
      top: 10, left: 0,
      color: '#fff' });
    pollRow.add(pollLabel);

    var pollField = Ti.UI.createTextField( { 
      top: 5, width: 40, right: 10,
      hintText: Ti.App.Properties.getString('poll', 
        MarchHare.settings.poll.default_value),
      autoCorrect: false,
      autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE
    });
    pollRow.add(pollField);
    appSettingsSection.add(pollRow);

    // Save changes, and let the application know on success
    pollField.
      addEventListener("blur", function(e) {
        if (pollField.value.length) {
          if (parseInt(pollField.value) == pollField.value) {
            Ti.App.Properties.setInt('poll', pollField.value);
            alert.message = 'Your changes have been saved';
            Ti.App.fireEvent('pollIntervalChanged');
          } else {
            alert.message = 'Invalid poll interval';
          }

          alert.show();
          setTimeout(function() {
            alert.hide()
          }, 2000); 
        }
      });

    // Follow via GPS settings
		var GPSRow = Ti.UI.createTableViewRow();

    var GPSLabel = Ti.UI.createLabel({ 
      text: 'Update map w/ GPS: ', 
      top: 0, left: 0,
      color: '#fff' });
    GPSRow.add(GPSLabel);

    var GPSField = Ti.UI.createSwitch( { 
      top: 5, right: 10,
      style:Ti.UI.Android.SWITCH_STYLE_CHECKBOX,
      value: Ti.App.Properties.getBool('gpsFollow', 
        MarchHare.settings.gpsFollow.default_value)
    });

    // Save changes, and let the application know on success
    GPSField.
      addEventListener("change", function(e) {
        Ti.App.Properties.setBool('gpsFollow', e.value);
        alert.message = 'Your changes have been saved';
        Ti.App.fireEvent('gpsFollowChanged');

        alert.show();
        setTimeout(function() {
          alert.hide()
        }, 2000); 
      });

    GPSRow.add(GPSField);
    appSettingsSection.add(GPSRow);

    // Vibrate on new incident
		var VibRow = Ti.UI.createTableViewRow();

    var VibLabel = Ti.UI.createLabel({ 
      text: 'Vibrate on new report: ', 
      top: 0, left: 0,
      color: '#fff' });
    VibRow.add(VibLabel);

    var VibField = Ti.UI.createSwitch( { 
      top: 5, right: 10,
      style:Ti.UI.Android.SWITCH_STYLE_CHECKBOX,
      value: Ti.App.Properties.getBool('vibrate', false)
    });

    // Save changes, and let the application know on success
    VibField.
      addEventListener("change", function(e) {
        Ti.App.Properties.setBool('vibrate', e.value);
        alert.message = 'Your changes have been saved';

        alert.show();
        setTimeout(function() {
          alert.hide()
        }, 2000); 
      });

    VibRow.add(VibField);
    appSettingsSection.add(VibRow);
    sections.push(appSettingsSection);

    var categoryFilterSection = Ti.UI.createTableViewSection({
        headerTitle: "Category Filters"
    });

    // Get all of the categories
    var categories = MarchHare.database.getCategoriesJSON();
    categories = JSON.parse(categories);
    for (i in categories) {
      // There are two Ushahidi default categories that we do not want to 
      // display here titled 'NONE' and 'Trusted Reports'
      if (categories[i].title == 'NONE' || categories[i].title == 'Trusted Reports') {
        continue;
      }

      // create a table row with a label and a switch
      var categoryRow = Ti.UI.createTableViewRow();

      var categoryLabel = Ti.UI.createLabel({
        text: categories[i].title+': ', 
        top: 0, left: 0,
        color: '#fff' });
      categoryRow.add(categoryLabel);

      var categorySwitch = Ti.UI.createSwitch({
        top: 5, right: 10,
        style:Ti.UI.Android.SWITCH_STYLE_CHECKBOX,
        category_id: categories[i].id,
        value: categories[i].filter ? true : false
      });

      // attach a eventhandler to the switch
      // firing updateReports for every category press is a little "heavy 
      // handed", instead fire an event on window close that would
      // cause updateReports event to be fired in app.js
      categorySwitch.
        addEventListener("change", function(e) {
          MarchHare.database.setCategoryFilter(e.source.category_id, e.value);
        });
      categoryRow.add(categorySwitch);

      // add that row to the section
      categoryFilterSection.add(categoryRow);
    }
    sections.push(categoryFilterSection);

    /* tableview */
    var tableView = Ti.UI.createTableView({ data: sections });

    win.add(tableView);

    win.addEventListener('close', function() {
      Ti.App.fireEvent('filterReports');
    });

    return win;
  }
  
  Ti.API.debug('Settings.js loaded');
})();
