(function () {
  MarchHare.ui.createSettingsWindow = function() {
    var win = Ti.UI.createWindow({
      modal: true
    });
		var addSettingsView = Ti.UI.createView();
		var container = Ti.UI.createView({layout:'vertical'});

    var label = Ti.UI.createLabel({ 
      text: 'Action Domain', top: 0, left: 0
    });
    container.add(label);

    // TODO: as we add more settings we will have different UI fields we will
    // want to use.  We will have to change this dependent on a new property
    // in the MarchHare.settings list
    var field = Ti.UI.createTextField( { 
      top:10, left:0, right:0,
      hintText: 'ushahidi.march-hare.org',
      autoCorrect: false,
      autocapitalization: Titanium.UI.TEXT_AUTOCAPITALIZATION_NONE
    });
    container.add(field);

    // Add a button for submitting the changes
		saveButton = Ti.UI.createButton({
			title: 'Save',
			top:20, left: 0
		});
		cancelButton = Ti.UI.createButton({
			title: 'Cancel',
			top:30, left: 0
		});

    var alert = Titanium.UI.createAlertDialog({
      title: 'Settings message'
    });

    saveButton.
      addEventListener("click", function(e) {
        // verify the new input
        result = verifyActionDomain(field.value);
        if (!result.result) {
          alert.message = result.message;
          alert.show();
          setTimeout(function() {
            alert.hide()
          }, 2000);
        } else {
          Ti.App.Properties.setString('action_domain', field.value);
          Ti.API.debug('Action Domain (action_domain) set to '+ field.value);
        }
        
        // We were previously trying to force close the window here, but we
        // should just leave this to the native controls (ie back button on
        // android)
      });

    cancelButton.
      addEventListener("click", function(e) {
        win.close();
      });

    container.add(saveButton);
    container.add(cancelButton);

    addSettingsView.add(container);
    win.add(addSettingsView);
    return win;
  }
  
  Ti.API.debug('Settings.js loaded');
})();
