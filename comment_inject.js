(function() {

var RESCAN_PERIOD = 500;
var RESCAN_PERIOD_IDLE = 1200;

var foundSomeButtons = true;

var cachedShortcutIcon;
var cachedCount = -1;
var settings;

var selfId;

// Forgive us, gods of programming
var POST_NAME_CLASSNAME = "gi ld md";
var COMMENT_NAME_CLASSNAME = "gi ld qm";

var DELETED_COMMENT_CLASSNAME = "re";

// Major DRY violation here...
var PROFILE_NAME_SELECTOR = "." + POST_NAME_CLASSNAME.replace(/ /g, ".") + ", ." + COMMENT_NAME_CLASSNAME.replace(/ /g, ".");
var POST_NAME_SELECTOR = "." + POST_NAME_CLASSNAME.replace(/ /g, ".");

// The flags container
var PLUSONE_SELECTOR = "button.esw";

function extractProfile(profile) {
    return { profileLink: profile, profileName: profile.getAttribute('oid'), realName: profile.textContent };
}

function addClickListener(button, userId) {
  button.addEventListener("click", function(e) {
    e.stopPropagation();
    console.log('TODO');
  }, false);
}

function findCommentDiv(element) {
  while (!(element.id && element.id.match(/.+#[0-9]+/))) {
    element = element.parentElement;
  }
  return element;
}

function getPostOwnerUrl(button) {
  var parent = button.parentElement;
  while (parent != null) {
    var postOwnerNode = parent.querySelector(POST_NAME_SELECTOR);
    if (postOwnerNode) {
      return postOwnerNode.href;
    }
    parent = parent.parentElement;
  }
}

function displayFirstWhenSecondIsHovered(first, second) {
  second.addEventListener('mouseover', function(event) {
    first.style.display = "";
  });
  second.addEventListener('mouseout', function(event) {
    first.style.display = "none";
  });
}

function processFooters(first) {
  var ATTRIBUTE = 'doshare_comment';

  if (!selfId) {
    chrome.extension.sendRequest({type: 'getId'}, function(result) {
      if (result.id) {
        selfId = result.id;
      }
    });
    window.setTimeout(processFooters, RESCAN_PERIOD);
    return;
  }

  var buttons = document.body ? document.body.querySelectorAll(PLUSONE_SELECTOR + ':not([' + ATTRIBUTE + '])') : [];

  var oid = selfId;

  if (!buttons || buttons.length == 0) {
    // Less aggressive if idle
    window.setTimeout(processFooters, foundSomeButtons ? RESCAN_PERIOD : RESCAN_PERIOD_IDLE);
    foundSomeButtons = false;
    return;
  }

  foundSomeButtons = true;

  for (var i = 0; i < buttons.length; i++) {
    var button = buttons[i];
    button.setAttribute(ATTRIBUTE, 1);

    // Try to figure out what the author's name is
    var parent = button.parentElement;
    var profile;
    while (parent != null) {
      var profileLink = parent.querySelector(PROFILE_NAME_SELECTOR);
      if (profileLink) {
        profile = extractProfile(profileLink);
        break;
      }
      parent = parent.parentElement;
    }

    if (!profile) {
      continue;
    }

    var newButton = document.createElement('a');
    newButton.setAttribute('role', 'button');
    newButton.textContent = 'Send to Do Share';
    button.parentElement.appendChild(document.createTextNode('\u00a0\u00a0-\u00a0\u00a0'));
    button.parentElement.appendChild(newButton, null);
    addClickListener(newButton, profile.profileName);
    //displayFirstWhenSecondIsHovered(newButton, findCommentDiv(button));
  }
  window.setTimeout(processFooters, RESCAN_PERIOD);
}

function onLoad() {
  processFooters();
}

document.addEventListener("DOMContentLoaded", onLoad);

})();
