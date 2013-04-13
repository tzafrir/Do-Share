(function() {

var PHOTO_BUTTON_CONTAINER_RIGHT_SIDE_SELECTOR = '.PbXuJ.a-f-e';
var PHOTO_CONTAINER_SELECTOR = '.gQ';

var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

var plusId;
(function() {
  chrome.extension.sendRequest({type: 'getId'}, function(response) {
    plusId = response.id;
  });
})();

function getActiveIdentity() {
  var url = document.location.toString();
  var match = url.match(/(u\/[0-9]\/|)b\/([0-9]+)/);
  return match && match[2];
}

function getPhotoId() {
  var url = window.location.toString().split('?')[0];
  if (!url.match(/photos\/.*\/.+/)) {
    return;
  }
  var property = url.split('photos/')[1].split('/')[0];
  if (property == 'instantupload' || property == (getActiveIdentity() || plusId)) {
    return url.split('/').reverse()[0];
  }
}

function addButton() {
  var container = document.querySelector(PHOTO_CONTAINER_SELECTOR);
  if (!container) {
    // Retry religiously
    window.setTimeout(addButton, 100);
    return
  }

  if (!getPhotoId()) {
    return;
  }

  var buttonArea = document.querySelector(PHOTO_BUTTON_CONTAINER_RIGHT_SIDE_SELECTOR);
  if (!buttonArea) {
    console.error('no button area found');
    return;
  }

  var button1 = buttonArea.childNodes[0];
  var newButton = button1.cloneNode(true);
  newButton.id = "ds-send-photo";
  newButton.querySelector('[role=button]').style.display = null;
  newButton.querySelector("span").innerText = "Send to Do Share";
  newButton.onclick = function() {
    var photoId = getPhotoId();
    if (!photoId) {
      return;
    }
    chrome.extension.sendRequest({type: 'newPost', image_id: photoId, source: 'photoSend', activeIdentity: getActiveIdentity()});
  };
  buttonArea.insertBefore(newButton, button1);
}

var observer = new MutationObserver(function(mutations) {
  if (mutations.length == 1) {
    var added = mutations[0].addedNodes;
    if (added.length == 1) {
      var menuitems = added[0].querySelectorAll('div[role="menuitem"]');
      for (var key in menuitems) {
        var node = menuitems[key];
        // TODO: fix not to use the string.
        if (node.nodeType == Node.ELEMENT_NODE && node.innerText === "Report photo") {
          window.setTimeout(addButton, 100);
        }
      }
    }
  }
});

observer.observe(document.body, {
    childList: true
});

})();
