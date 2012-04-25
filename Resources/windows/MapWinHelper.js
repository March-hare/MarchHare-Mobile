Ti.include( 
    '../march-hare/march-hare.js',
    '../windows/Settings.js',
    );

// Add application settings menu to the main mapping window 
// http://bit.ly/GEN238
if (Ti.Platform.osname == 'android') {
  var win = Ti.UI.currentWindow;
  var activity = Ti.Android.currentActivity;

  activity.onCreateOptionsMenu = function(e){
    var menu = e.menu;
    var menuItem = menu.add({ title: 'Settings' });
    menuItem.addEventListener("click", function(){
      var settingsWin = MarchHare.ui.createSettingsWindow();
      settingsWin.open({});
    });
  };
} 
/*
else {
  // TODO: create iOS options menu
  // iOS code might look something like this:  where iconWin is an actuall
  // icon?  I am not sure how menus are done in iOS
  var rightButton = Ti.UI.createButton({
      systemButton: Ti.UI.iPhone.SystemButton.REFRESH
  });
  iconWin.rightNavButton = rightButton;
  rightButton.addEventListener('click', function () {
      Ti.fireEvent('codestrong:update_data');
  });
}
*/
