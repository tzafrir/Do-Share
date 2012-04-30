(function() {
var INTERVAL = 500;
var ATTRIBUTE = 'doshare';

var SHAREBOX_ID = ':0.f';

function scanSharebox() {
  var button = document.querySelector('[guidedhelpid=sharebutton]');
  button && addButton(button);
}

function addButton(button) {
  var clone = button.cloneNode(true);
  clone.onclick = sendToDoShare;
  clone.innerHTML = 'Send to Do Share';
  button.parentElement.insertBefore(clone, button);
}

function getPlusOneUrl() {
  var fragments = document.location.toString().split('?')[1].split('&');
  for (var i = 0; i < fragments.length; ++i) {
    if (fragments[i].match(/^url=/)) {
      return decodeURIComponent(fragments[i].split('=')[1]);
    }
  }
}

function sendToDoShare() {
  var url = getPlusOneUrl();
  var sharebox = document.getElementById(SHAREBOX_ID);
  var text = (sharebox && sharebox.innerText) || '';
  chrome.extension.sendRequest({type: 'newPost', content: text, link: url}, function(){});
}

document.addEventListener("DOMContentLoaded", scanSharebox);
})();
