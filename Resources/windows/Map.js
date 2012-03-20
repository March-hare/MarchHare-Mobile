(function () {
  var win = Ti.UI.createWindow();
  var webview = Ti.UI.createWebView({ url: '../pages/map.html' });
  //var webview =Ti.UI.createWebView({url:'http://openlayers.org/dev/examples/bing-tiles.html'});
  win.add(webview);
  win.open();
})();
