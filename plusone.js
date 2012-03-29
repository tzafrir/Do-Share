var INTERVAL = 500;
var ATTRIBUTE = 'doshare';

var _sharebox;

function scanSharebox() {
  var sharebox = document.getElementById(':0.f');
  if (sharebox && !sharebox.attributes[ATTRIBUTE]) {
    _sharebox = sharebox;
    sharebox.setAttribute(ATTRIBUTE, 1);
    var p = sharebox.parentElement.parentElement.parentElement
                    .parentElement.parentElement;
    addButton(p);
  }
  window.setTimeout(scanSharebox, INTERVAL);
}

function addButton(parent) {
  var div = document.createElement('div');
  var style = div.style;

  style.border = '1px solid #ddd';
  style.borderBottom = '0';
  style.padding = '4px';
  style.paddingTop = '24px';
  style.cursor = 'pointer';

  div.innerHTML = 'Send to ds <img src="https://nukecomments.appspot.com/ico/nuke.png">';

  div.addEventListener('click', sendToDoShare);

  parent.insertBefore(div, parent.children[1]);
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
  var text = _sharebox.innerText;
  chrome.extension.sendRequest({type: 'newPost', content: text, link: url}, function(){});
}

document.addEventListener("DOMContentLoaded", scanSharebox);
