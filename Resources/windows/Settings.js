(function () {
  MarchHare.ui.createSettingsWindow = function() {
    var win = Ti.UI.createWindow({ modal: true });
		var addSettingsView = Ti.UI.createView();
		var container = Ti.UI.createView({layout:'vertical'});

    // TODO: this should actually all be wrapped in a table with each setting 
    // that is not a checkbox diverted to its own modal window
    var domainLabel = Ti.UI.createLabel({ 
      text: 'Action Domain', 
      top: 0, left: 0,
      color: '#000' });
    container.add(domainLabel);

    // TODO: as we add more settings we will have different UI fields we will
    // want to use.  We will have to change this dependent on a new property
    // in the MarchHare.settings list
    var domainField = Ti.UI.createTextField( { 
      top:10, left:0, right:0,
      hintText: Ti.App.Properties.getString('action_domain', 
        MarchHare.settings.action_domain.default_value),
      autoCorrect: false,
      autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE
    });
    container.add(domainField);

    var pollLabel = Ti.UI.createLabel({ 
      text: 'Poll Frequency in Seconds', 
        top: 20, left: 0,
        color: '#000' });
    container.add(pollLabel);

    var pollField = Ti.UI.createTextField( { 
      top:30, left:0, right:0,
      hintText: Ti.App.Properties.getString('poll', 
        MarchHare.settings.poll.default_value),
      autoCorrect: false,
      autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE
    });
    container.add(pollField);

    var alert = Titanium.UI.createAlertDialog({
      title: 'Settings message'
    });

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
          }

          alert.show();
          setTimeout(function() {
            alert.hide()
          }, 2000); 
        }
      });

    pollField.
      addEventListener("blur", function(e) {
        if (pollField.value.length) {
          if (parseInt(pollField.value) == pollField.value) {
            Ti.App.Properties.setInt('poll', pollField.value);
            alert.message = 'Your changes have been saved';
          } else {
            alert.message = 'Invalid poll interval';
          }

          alert.show();
          setTimeout(function() {
            alert.hide()
          }, 2000); 
        }
      });

    addSettingsView.add(container);
    win.add(addSettingsView);
    return win;
  }
  
  Ti.API.debug('Settings.js loaded');
})();
