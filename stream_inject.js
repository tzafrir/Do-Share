(function(){
/**
 * Injection code inspired by https://github.com/mohamedmansour/extended-share-extension
 */

var ATTRIBUTE = 'ds-item-attr';

var CONTENT_PANE_ID = '#contentPane';
var STREAM_ARTICLE_ID = 'div:nth-of-type(2) > div:first-child';
var STREAM_UPDATE_SELECTOR = 'div[id^="update"]';
var STREAM_ACTION_BAR_SELECTOR = STREAM_UPDATE_SELECTOR + ' > div > div:nth-of-type(3)';
var STREAM_AUTHOR_SELECTOR = 'div > div > h3 > span';
var STREAM_IMAGE_SELECTOR = STREAM_UPDATE_SELECTOR + ' > div div[data-content-type] > img';

var originalTextNode = document.createTextNode(' \u00a0-\u00a0 ');

/**
 * Render the "Send to Do Share" Link on each post.
 */
function onContentModified(e) {
  // This happens when a new stream is selected
  if (e.relatedNode && e.relatedNode.parentNode && e.relatedNode.parentNode.id == 'contentPane') {
    // We're only interested in the insertion of entire content pane
    renderAllItems(e.target);
  } else if (e.target.nodeType == Node.ELEMENT_NODE && e.target.id.indexOf('update') == 0) {
    var actionBar = e.target.querySelector(STREAM_ACTION_BAR_SELECTOR);
    renderItem(actionBar);
  }
};

/**
 * Render on all the items of the documents, or within the specified subtree
 * if applicable
 */
function renderAllItems(subtreeDOM) {
  var actionBars = (typeof subtreeDOM == 'undefined') ?
      document.querySelectorAll(STREAM_ACTION_BAR_SELECTOR) :
      subtreeDOM.querySelectorAll(STREAM_ACTION_BAR_SELECTOR);
  console.log('bars: ' + actionBars.length);
  for (var i = 0; i < actionBars.length; i++) {
    renderItem(actionBars[i]);
  }
}

/**
 * Render the "Send to Do Share" Link on each post.
 *
 * @param {Object<ModifiedDOM>} event modified event.
 */
function renderItem(itemDOM) {
  if (itemDOM && !itemDOM.attributes[ATTRIBUTE]) {
    var shareNode = document.createElement('span');
    shareNode.innerHTML = "Send to Do Share";
    shareNode.className = itemDOM.children[1].className.split(' ')[0];
    shareNode.onclick = function() {
      sendToDoShare(itemDOM);
    };
    itemDOM.appendChild(originalTextNode.cloneNode(true));
    itemDOM.appendChild(shareNode);
    itemDOM.style.height = '25px';  // To prevent the actionBar overlapping the comments for users
                                    // with many extensions.
    itemDOM.setAttribute(ATTRIBUTE, '');
  }
};

function sendToDoShare(itemDOM) {
  var url = itemDOM.parentElement && itemDOM.parentElement.querySelector('a[target="_blank"]').href;
  chrome.extension.sendRequest({'type': 'resharePost', 'url': url}, function(){});
}

document.addEventListener("DOMContentLoaded", function() {
  // Listen when the subtree is modified for new posts.
  var googlePlusContentPane = document.querySelector(CONTENT_PANE_ID);
  if (googlePlusContentPane) {
    googlePlusContentPane.addEventListener('DOMNodeInserted', onContentModified);
    renderAllItems(googlePlusContentPane);
  }
});
})();
