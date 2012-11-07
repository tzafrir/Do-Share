(function() {
var INTERVAL = 500;
var ATTRIBUTE = 'doshare';

var SHAREBOX_ID = ':0.f';

function scanSharebox() {
  if (window.location.toString().match(/claimedOrigin=http(|s)%3A%2F%2Fwww.google.com/)) {
    return;
  }
  window.setTimeout(function() {
    var button = document.querySelector('[guidedhelpid=sharebutton]');
    button && addButton(button);
  }, 350);
}

function addButton(button) {
  var clone = button.cloneNode(true);
  clone.onclick = sendToDoShare;
  clone.innerHTML = 'Send to Do Share';
  clone.removeAttribute('guidedhelpid');
  button.parentElement.insertBefore(clone, button);
}

function getPlusOneUrl() {
  var l = document.location.toString();
  var index = l.indexOf('url=');
  if (index != -1) {
    return decodeURIComponent(l.substring(index + 4).split('&')[0]);
  }
}

function sendToDoShare() {
  var url = getPlusOneUrl();
  var sharebox = document.getElementById(SHAREBOX_ID);
  var text = (sharebox && sharebox.innerText) || '';
  chrome.extension.sendRequest({type: 'newPost', content: text, link: url, source: document.location.toString().split('?')[0]}, function(){});
}

document.addEventListener("DOMContentLoaded", scanSharebox);
})();
