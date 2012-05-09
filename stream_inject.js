(function(){

/**
 * Injection code inspired by https://github.com/mohamedmansour/extended-share-extension
 */

var CONTENT_PANE_ID = '#contentPane';
var STREAM_UPDATE_SELECTOR = 'div[id^="update"]:not([tz_doshare])';

var BUTTON_CLASSNAME = 'Tj';
var BUTTONS_SELECTOR = 'div.eswd, div.' + BUTTON_CLASSNAME;
var SPAN_CLASSNAME = 'iq';

function onNodeInserted(e) {
  // This happens when a new stream is selected
  if (e.target && e.target.id && e.target.id.indexOf('update') == 0) {
    processPost(e.target);
  } else if (e.relatedNode && e.relatedNode.parentNode && e.relatedNode.parentNode.id == 'contentPane') {
    processAllItems();
  }
};

/**
 * Process
 */
function processAllItems(subtreeDOM) {
  var posts = document.querySelectorAll(STREAM_UPDATE_SELECTOR);
  for (var i = 0; i < posts.length; i++) {
    processPost(posts[i]);
  }
}

function processPost(itemDOM) {
  if (itemDOM) {
    addButtonToPost(itemDOM);
  }
}

function addButtonToPost(itemDOM) {
  itemDOM.setAttribute('tz_doshare', true);
  var plusOne = itemDOM.querySelector('[g\\:entity]');
  if (!plusOne) {
    console.error('!plusone');
    return;
  }
  var shareNode = document.createElement('div');
  var innerSpan = document.createElement('span');

  innerSpan.className = SPAN_CLASSNAME;

  var img = document.createElement('img');
  img.src = chrome.extension.getURL('img/stream_icon.png');
  innerSpan.appendChild(img);
  shareNode.appendChild(innerSpan);

  shareNode.className = BUTTON_CLASSNAME;
  shareNode.onclick = function(){
    var url = itemDOM.querySelector('[target=_blank]').href;
    if (url) {
      console.log(url);
      sendReshare(url);
    }
  };

  shareNode.setAttribute('data-tooltip', 'Send to Do Share');

  var allButtons = itemDOM.querySelectorAll(BUTTONS_SELECTOR);
  if (allButtons.length == 0) {
    console.error(allButtons);
    return;
  }
  var lastButton = allButtons[allButtons.length - 1];
  plusOne.parentNode.insertBefore(shareNode, lastButton.nextSibling);
}

function sendReshare(url) {
  chrome.extension.sendRequest({'type': 'resharePost', 'url': url}, function(){});
}

document.addEventListener("DOMContentLoaded", function() {
  // Listen when the subtree is modified for new posts.
  var googlePlusContentPane = document.querySelector(CONTENT_PANE_ID);
  if (googlePlusContentPane) {
    googlePlusContentPane.parentElement.addEventListener('DOMNodeInserted', onNodeInserted);
    processAllItems();
  }
});
})();
