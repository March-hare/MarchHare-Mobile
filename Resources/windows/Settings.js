(function () {
  MarchHare.ui.createSettingsWindow = function() {
    var win = Ti.UI.createWindow({ 
      backgroundColor: '#000',
      title: 'Settings',
      modal: true 
    });

    // Create a scrollable view for all the settings views to be placed in
    var scrollView = Ti.UI.createScrollView({
      contentWidth:'auto',
      contentHeight:'auto',
      top:0,
      showVerticalScrollIndicator:true,
      showHorizontalScrollIndicator:false
    });

		var domainView = Ti.UI.createView({
      layout:'vertical',
      top: 10,
      left: 10,
      width: 300,
      height: 50
    });

    // TODO: this should actually all be wrapped in a table with each setting 
    // that is not a checkbox diverted to its own modal window
    var domainLabel = Ti.UI.createLabel({ 
      text: 'Action Domain: ', 
      top: 0, left: 0,
      color: '#fff' });
    domainView.add(domainLabel);

    // TODO: as we add more settings we will have different UI fields we will
    // want to use.  We will have to change this dependent on a new property
    // in the MarchHare.settings list
    var domainField = Ti.UI.createTextField( { 
      //top:20, left:0, width: 200,
      left:0, width: 200,
      hintText: Ti.App.Properties.getString('action_domain', 
        MarchHare.settings.action_domain.default_value),
      autoCorrect: false,
      autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE
    });

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

    domainView.add(domainField);
    scrollView.add(domainView);

		var pollView = Ti.UI.createView({
      layout:'vertical',
      top: 70,
      left: 10,
      width: 300,
      height: 50
    });

    var pollLabel = Ti.UI.createLabel({ 
      text: 'Poll Frequency in Seconds:', 
        top: 0, left: 0,
        color: '#fff' });
    pollView.add(pollLabel);

    var pollField = Ti.UI.createTextField( { 
      top: 0, left: 0, width: 40,
      hintText: Ti.App.Properties.getString('poll', 
        MarchHare.settings.poll.default_value),
      autoCorrect: false,
      autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE
    });
    pollView.add(pollField);
    scrollView.add(pollView);

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
		var GPSView = Ti.UI.createView({
      layout:'vertical',
      top: 130,
      left: 10,
      width: 300,
      height: 50
    });

    var GPSField = Ti.UI.createSwitch( { 
      top: 0, left: 0,
      style:Ti.UI.Android.SWITCH_STYLE_CHECKBOX,
      title: "Follow via GPS",
      titleOn: "Follow via GPS",
      titleOff: "Do NOT Follow via GPS",
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

    GPSView.add(GPSField);
    scrollView.add(GPSView);
    win.add(scrollView);
    return win;
  }
  
  Ti.API.debug('Settings.js loaded');
})();
