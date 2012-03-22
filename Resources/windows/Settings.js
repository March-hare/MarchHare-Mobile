(function () {
  MarchHare.ui.createSettingsWindow = function() {
		var addSettingsView = Ti.UI.createView();
		var container = Ti.UI.createView({layout:'vertical'});

    var label = Ti.UI.createLabel({ 
      text: 'Action Domain',
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
		addButton = Ti.UI.createButton({
			title: 'submit',
			top:20
		});
    container.add(addButton);

    addButton.
      addEventListener("click", function(e) {
        // verify the new input
        result = verifyActionDomain(field.value);
        if (!result.result) {
          alert(result.message);
        } else {
          Ti.App.Properties.setString('action_domain', field.value);
        }
        
        // close this window
        var win = Ti.UI.currentWindow;
        win.close();
      });

    addSettingsView.add(container);
    var win = Ti.UI.createWindow({
      backgroundColor: 'black'
    });
    win.add(addSettingsView);
    return win;
  }
  
  Ti.API.debug('Settings.js loaded');
})();
