var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-27041781-6']);

function trackPost(post) {
  var pub = false;
  if (isPublic(post)) {
    pub = true;
  }
  _gaq.push(['_trackEvent', 'Post', (pub ? 'public' : 'limited')]);
  _gaq.push(['_trackEvent', 'PagePost', (post.shareAs ? 'yes' : 'no')]);
  if (post.circlesNotifyArray && post.circlesNotifyArray.length) {
    _gaq.push(['_trackEvent', 'NotifyCircles', (pub ? 'public' : 'limited'), 'NotifyCircles', post.circlesNotifyArray.length]);
  }
}

function isPublic(post) {
  return !!(post.entities && post.entities.filter(function(entity) {
    return entity.circleId == 'PUBLIC';
  }).length);
}

var ACTION_UPDATE_INTERVAL = 666;
var INIT_RETRY_INTERVAL = 5 * 1000;
var INIT_REPEAT_INTERVAL = 20 * 60 * 1000;

var dbInit = false;

// Set up the API
var plus;
var apis = {};
var postTrackers = {};
var identities = [];
var sentPosts = {};

var initTimeoutId;
function initialize(opts) {
  var newPlus = new GooglePlusAPI({googleid: Settings.get('alternateAccount')});
  if (!plus) {
    plus = newPlus;
  }
  opts = opts || {};
  window.clearTimeout(initTimeoutId);
  try {
    if (opts.clearPrevious) {
      newPlus._db.clearAll(c);
      apis = {};
    }
    newPlus.init(function(response) {
      if (response.status) {
        var uid = newPlus.getInfo().id;
        if (uid != localStorage['prev_uid']) {
          oauth.clearTokens();
        }
        localStorage['prev_uid'] = uid;
        newPlus.getAllIdentitiesApis(function(result) {
          console._error = console.error;
          console.error = console.warn;
          var count = result.length;
          var newIdentities = [];
          result.forEach(function(api) {
            function addApi() {
              apis[api.getInfo().id] = api;
              newIdentities.push(api.getInfo());
              api.refreshCircles(function() {
                if (--count == 0) {
                  console.error = console._error;
                  identities = newIdentities;
                }
              });
              if (!postTrackers[api.getInfo().id]) {
                postTrackers[api.getInfo().id] = new PostTracker(api);
              }
            }
            if (!(api.getInfo() && api.getInfo().id == uid)) {
              if (opts.clearPrevious) {
                api._db.clearAll(c);
              }
              api.init(function() {
                addApi();
              });
            } else {
              plus = newPlus;
              addApi();
            }
          });
        });

        initTimeoutId = window.setTimeout(initialize, INIT_REPEAT_INTERVAL);
      } else {
        initTimeoutId = window.setTimeout(initialize, INIT_RETRY_INTERVAL);
      }
    });
  } catch (e) {
    _gaq.push(['_trackEvent', 'Failure', 'plus.init']);
    console.error(e, e.message);
    window.setTimeout(initialize, INIT_RETRY_INTERVAL);
  }
};

var lastUpdate = -1;
function update() {
  lastUpdate = new Date().getTime();
}

function c(e){console.log(e)}

try {
  var s;
  var db = new IDBWrap("nightwatchDb", "writeTimeStamp");
  db.init(function(ok) {
    s = new Sched5("nightwatch", "writeTimeStamp", publishScheduled, handleMissedPost);
    s.init(function() {
      dbInit = true;
    });
  });
} catch(e) {
  console.error('Error initializing database', e);
}

var actionController = new BrowserActionController();

// HACKKKKK
var fakeDiv = document.createElement('div');
var gpe = new GPEditor(fakeDiv, '', 'fake', function(){}, {}, true);

var previousTotal;
var previousLogicBits;
function updateAction(numDrafts, numScheduled) {
  var hasScheduled = (numScheduled > 0);

  var total = numDrafts + numScheduled;
  var logicBits = !!total + hasScheduled << 1;
  if (total == previousTotal && logicBits == previousLogicBits) {
    return;
  }
  previousTotal = total;
  previousLogicBits = logicBits;

  var badgeText = "Do Share - ";
  function s(count) {
    if (count == 1) {
      return '';
    }
    return 's';
  }
  if (total == 0) {
    badgeText += "Ready";
  } else if (hasScheduled) {
    badgeText += numScheduled + " post" + s(numScheduled) + " scheduled, " + numDrafts + " draft" + s(numDrafts) + " saved";
  } else {
    badgeText += numDrafts + " draft" + s(numDrafts) + " saved";
  }
  actionController.drawBadgeIcon(total, badgeText, hasScheduled);
}

(function refreshAction() {
  if (dbInit) {
    var waiting = 2;
    var numDrafts = 0;
    var numScheduled = 0;
    var waiter = function() {
      if (--waiting == 0) {
        updateAction(numDrafts, numScheduled);
      }
    }
    db.count(function(count) {
      numDrafts = count;
      waiter();
    });
    s.count(function(count) {
      numScheduled = count;
      waiter();
    });
  }
  window.setTimeout(refreshAction, ACTION_UPDATE_INTERVAL);
})();

/**
 * Thanks Hangout Canopy team!
 */
function fetchOzData(url, callback) {
  $.ajax(url).done(function(responseText) {
    initDataHandler = function(initDataMap) {
      callback(initDataMap);
    };
    document.getElementById('sandbox').contentWindow.postMessage({
      type: 'initData',
      responseText: responseText
    }, '*');
  });
}

function getActiveIdentity(url) {
  if (url) {
    var match = url.match(/u\/[0-9]\/b\/([0-9]+)/);
    return match && match[1];
  }
}

function fetchPostData(url, callback) {
  if (!url > '') {
    console.error('Url is not a string');
    return;
  }

  fetchOzData(url, function(dataMap) {
    var postData = dataMap && (dataMap[20] || dataMap[59][2]);
    if ((!dataMap) || (!postData)) {
      _gaq.push(['_trackEvent', 'Failure', 'fetchOzData']);
      console.error('Not a singleton post url');
      return;
    }

    // TODO: postData[43] has 2nd level via information which could be useful one day.
    var reshare_person_data = postData[44];

    var data = {};
    var name = postData[3];
    var id = postData[16];
    var activeIdentity = getActiveIdentity(url);

    data.content = postData[4];
    data.update_id = postData[8];
    data.url = 'https://plus.google.com/' + postData[21];
    data.timeStamp = postData[5];
    data.isPublic = (postData[32] === 1);
    if (!data.isPublic && activeIdentity) {
      data.activeIdentity = activeIdentity;
    }

    if (!reshare_person_data) {
      data.author_name = name;
      data.author_id = id;
      data.author_photo_url = 'https:' + postData[18];
    } else {
      data.author_name = reshare_person_data[0];
      data.author_id = reshare_person_data[1];
      data.author_photo_url = reshare_person_data[4];
      data.via_name = name;
      data.via_id = id;
    }

    data.rawMedia = postData[11];
    data.medias = processMediaItems(data.rawMedia);

    callback(data);
  });
}

/**
 * callback = function(person<Array>) (see gp_editor)
 */
function profileAutocomplete(prefix, callback) {
  if (!prefix) {
    callback([]);
    return;
  }
  plus.getPeople({'person.name': prefix + '%'}, function(getPeopleResponse) {
    var persons = {};
    if (getPeopleResponse.status) {
      getPeopleResponse.data.forEach(function(person) {
        person.photoUrl = person.photo;
        persons[person.id] = person;
      });
    }
    plus.profileAutocomplete(function(response) {
      var results = response[1];
      if (!results) {
        callback([]);
        return;
      }

      for (var i = 0; i < results.length; ++i) {
        var personObject = results[i];
        var personData = results[i][3][0];
        var person = {
          name: (personData['n'] ? personData['n'] : personObject[0]),
          id: personData['g']
        };
        if (personData['p']) {
          person.photoUrl = 'https:' + personData['p'] + '?sz=24';
        }
        persons[person.id] = person;
      }
      var resultArray = [];
      for (var key in persons) {
        resultArray.push(persons[key]);
      }
      callback(resultArray);
    }, prefix);
  });
}

function hashtagAutocomplete(prefix, callback) {
  if (!prefix) {
    return;
  }
  plus.hashtagAutocomplete(function(response) {
    var results = response[1];
    if (!results) {
      callback([]);
      return;
    }

    callback(results.map(function(result) {
      return result[0];
    }));
  }, prefix);
}

function handleMissedPost(post) {
  post.state = 'draft';
  _gaq.push(['_trackEvent', 'MissedPost', 'MissedPost']);
  post.error = 'Chrome was not running at the scheduled time';
  addPost(post, c);
}

function publishScheduled(post) {
  update();
  publish(post);
}

function publish(post, callback) {
  if (!callback) {
    callback = c;
  }

  if (sentPosts[post.writeTimeStamp]) {
    return;
  }

  function restorePost(errorMessage) {
    var post = JSON.parse(postBackup);
    post.state = 'draft';
    post.error = errorMessage || '';
    // Avoid UI races by upping the failed posts's id.
    post.writeTimeStamp += 1;
    addPost(post, callback);
  };
  var postBackup = JSON.stringify(post);
  trackPost(post);
  if (post.entities instanceof Array) {
    post.aclItems = parseEntities(post.entities);
  }
  var idForSettings = (post.shareAs && post.shareAs.id) || '';
  if (Settings.get('postNumbering' + idForSettings) == '1' && isPublic(post)) {
    var shareAs = (post.shareAs && post.shareAs.id) || (plus.getInfo() && plus.getInfo().id) || '';
    if (post.title) {
      post.title = getPostNumberingString(shareAs) + post.title;
    } else {
      post.content = getPostNumberingString(shareAs) + post.content;
    }
  }
  if (post.title) {
    post.content = '*' + post.title.replace(/(\s|&nbsp;)+$/, '') + '*\n\n' + post.content;
  }
  if (post.rawMedia && post.rawMedia[0] && post.rawMedia[0][47] && post.rawMedia[0][47][0] &&
      post.rawMedia[0][47][0][1] == 'picasa') {
    post.isPicasaImage = true;
  }
  var publishResolved = false;
  var TIMEOUT_LENGTH = 30 * 1000;
  window.setTimeout(function() {
    if (!publishResolved) {
      restorePost("Timed out sending post to Google+");
    }
  }, TIMEOUT_LENGTH);
  var wrapCallback = function(response) {
    if (response.status == false) {
      _gaq.push(['_trackEvent', 'Failure', 'newPost']);
      restorePost("Could not send post to Google+");
      publishResolved = true;
    } else {
      publishResolved = true;
      delPost(post.writeTimeStamp, function(){});
      callback(true);
    }
  };
  var api = getApi(post.shareAs && post.shareAs.id);
  if (post.shareAs && post.shareAs.id != api.getInfo().id) {
    _gaq.push(['_trackEvent', 'Failure', 'noApiForPage']);
    restorePost("Could not log in as " + post.shareAs.name);
    return;
  }
  postTrackers[api.getInfo().id].afterLocallyPosting();
  sentPosts[post.writeTimeStamp] = true;
  api.newPost(wrapCallback, post);
  console.log("Posting");
  console.log(post);
}

function schedule(post, callback) {
  s.schedule(post, post.timeStamp, callback);
}

function draft(post, callback) {
  db.put(post, callback);
}

function addPost(post, callback) {
  var state = post.state;
  update();

  delPost(post.writeTimeStamp, function(){});
  if (state == "scheduled") {
    schedule(post, callback);
  } else if (state == "draft") {
    draft(post, callback);
  } else if (state == "post") {
    publish(post, callback);
  } else {
    _gaq.push(['_trackEvent', 'Failure', 'Invalid']);
    console.error('Invalid state');
    callback(false);
  }
}

function fetchAll(reqLastUpdate, callback) {
  var result = {posts: [], lastUpdate: lastUpdate};
  if (!dbInit || reqLastUpdate == lastUpdate) {
    callback(result);
    return;
  }
  var wrapCallback = function() {
    s.count(function(count) {
      if (count == 0) {
        callback(result);
      } else {
        s.processAllItems(function(item) {
          result.posts.push(item);
          if (--count == 0) {
            callback(result);
          }
        });
      }
    });
  };
  db.count(function(count) {
    if (count == 0) {
      wrapCallback();
    } else {
      db._processAllItemsByRange(undefined, function(post) {
        result.posts.push(post);
        if (--count == 0) {
          wrapCallback();
        }
      });
    }
  });
}

function processMediaItems(mediaArray) {
  var result = {images: [], rawMedia: mediaArray};
  mediaArray.forEach(function(media, index) {
    var type = media[24] && media[24][3];
    if (!media[24]) {
      // TODO(tzafrir): Find a better way to classify old/new objects
      if (media[2] instanceof Object) {
        for (var i in media[2]) {
          var m = media[2][i];
          if (!result.link) {
            result.link = {'url': m[2], 'title': m[0], 'description': m[1]};
          }
          if (m[5] && !(result.images.length > 0)) {
            result.images.push({'url': m[5]});
          }
          break;
        }
      }
    } else {
      if (media[24][4] == "image" || media[24][4] == "photo") {
        var url;
        if (media[5]) {
          url = media[5][1];
        } else if (media[41]) {
          url = media[41][0][1];
        } else {
          url = media[24][1];
        }
        if (!url.match(/http/)) {
          url = 'https:' + url;
        }
        var image = {'url': url};
        result.images.push(image);
      }
    }
    if (type && type.match(/^text/) || type == "application/x-shockwave-flash" || type == "application/octet-stream") {
      var url = media[24][1];
      if (url && !url.match(/^http/)) {
        url = 'https://plus.google.com/' + url;
      }
      result.link = {'url': url, 'title': media[3], 'description': media[21]};
    }
    if (type == "application/x-shockwave-flash") {
      result.video = {'embed': getVideoEmbed(media[5][1]), 'w': media[5][3], 'h': media[5][2]};
    }
    if (media.isPlaceholder) {
      result.isPlaceholder = true;
    }
  });
  return result;
}

function processFrontendMedias(medias) {
  if (medias.change) {
    var change = medias.change;
    if (change.chosenImageIndex) {
      medias.rawMedia = keepNthImage(medias.rawMedia, change.chosenImageIndex);
    }
    if (change.removeDescription) {
      medias.rawMedia = removeDescription(medias.rawMedia);
    }
  }
  return medias.rawMedia;
}

function removeDescription(rawMedia) {
  rawMedia.forEach(function(media) {
    var type = media[24] && media[24][3];
    if (type == "text/html" || type == "application/x-shockwave-flash") {
      media[21] = '';
    }
  });
  return rawMedia;
}

function keepNthImage(rawMedia, n) {
  var result = [];
  for (var i = 0, j = 0; i < rawMedia.length; ++i) {
    var media = rawMedia[i];
    if (media[24] && (media[24][4] == "image" || media[24][4] == "photo")) {
      if (j++ == n) {
        result.push(media);
      }
    } else {
      result.push(media);
    }
  }
  return result;
}

function getVideoEmbed(embedUrl) {
  embedUrl = embedUrl.replace('autoplay', 'noplay');
  if (embedUrl.match('youtube.com/v/')) {
    var v = embedUrl.match('/v/(.*?)[?&]')[1];
    return 'https://www.youtube.com/embed/' + v + '?wmode=opaque';
  } else {
    return embedUrl;
  }
}

function fetchPost(writeTimeStamp, callback) {
  var race = false;
  var racer = function(item) {
    if (race) {
      // How did this happen? The assumption is that a post is is in only one of db, s.
      _gaq.push(['_trackEvent', 'Failure', 'fetchPostRaceWTF']);
      console.error("WTF");
      return;
    }
    race = true;
    callback(item);
  };
  db.processItem(writeTimeStamp, racer);
  s.processItem(writeTimeStamp, racer);
}

function delPost(writeTimeStamp, callback) {
  update();
  s._removeItem(writeTimeStamp, c);
  db._removeItem(writeTimeStamp, c);
  // If you're not me and here because of a bug, I owe you a beer.
  callback(true);
}

function post(post, callback) {
    if (post.state == 'scheduled' && post.timeStamp < new Date().getTime()) {
      callback(false);
      return;
    }
    if (!post) {
      _gaq.push(['_trackEvent', 'Failure', 'MissingRequestPost']);
      console.error('Missing request.post');
      callback(false);
      return
    }
    var state = post.state;
    if (!state) {
      _gaq.push(['_trackEvent', 'Failure', 'MissingPostState']);
      console.error('Missing post.state');
      callback(false);
      return;
    }

    function postThis() {
      var a = post.circlesNotifyArray;
      post.notify = [];
      if (a && a.length > 0) {
        var len = a.length;
        a.forEach(function(id) {
          plus.getPeople({circle_id: id}, function(result) {
            if (result.data) {
              result.data.forEach(function(person) {
                post.notify.push(person.id);
              });
            }
            len--;
            if (len == 0) {
              addPost(post, callback);
            }
          })
        });
      } else {
        addPost(post, callback);
      }
    }

    // If reshare, don't waste time on fetching media links.
    if (post.reshare) {
      if (post.reshare.rawMedia) {
        post.reshare.medias = processMediaItems(post.reshare.rawMedia);
      }
      postThis();
    } else if (post.medias && !post.medias.isPlaceholder) {
      // Dance for me.
      post.rawMedia = processFrontendMedias(post.medias);
      post.medias = processMediaItems(post.rawMedia);
      postThis();
    } else if (post.link) {
      getLinkMedia(post.link, function(data) {
        if (data) {
          post.rawMedia = data;
          post.medias = processMediaItems(data);
        }
        postThis();
      });
    } else if (post.image_id) {
      plus.fetchPhotoMetadata(function(response) {
        if (response.error || !response.data) {
          _gaq.push(['_trackEvent', 'Failure', 'fetchPhotoMetadata']);
          console.error(response);
          callback(false);
        } else {
          post.rawMedia = [plus._createPicasaImageItem(response.data)];
          post.medias = processMediaItems(post.rawMedia);
          postThis();
        }
      }, post.image_id);
    } else {
      postThis();
    }
}

function getLinkMedia(link, callback) {
  if (!link) {
    console.error('invalid link');
    return;
  }
  plus.fetchLinkMedia(function(response) {
    if (!response.status) {
      if (plus.isAuthenticated()) {
        _gaq.push(['_trackEvent', 'Failure', 'fetchLinkMedia']);
      }
      console.error('Error fetching media for ' + link);
      if (!link.match(/^http/)) {
        link = 'http://' + link;
      }
      callback([{24: {1: link, 3: 'text/html'}, 3: link, isPlaceholder: true}]);
    } else if (response.data) {
      callback(response.data);
    }
  }, link);
}

function newPost(post) {
  function openNewPost() {
    post.content = post.content || '';
    if (Settings.get('promoText') == 'all') {
      post.content += '\n\n_(Shared using #DoShare)_';
    }
    // Set temporary values and open the frontend. Expect frontend to clear these from LS.
    localStorage['_tmp_post'] = JSON.stringify(post);
    chrome.tabs.create({'url': chrome.extension.getURL('main.html')}, c);
  }
  if (!post.entities) {
    var lastUsed = localStorage['lastUsedCircles'];
    if (lastUsed) {
      post.entities = JSON.parse(lastUsed);
    } else {
      post.entities = [];
    }
  }
  if (post.image_id) {
    var api = getApi(post.activeIdentity);
    api.fetchPhotoMetadata(function(response) {
      if (response.error || !response.data) {
        _gaq.push(['_trackEvent', 'Failure', 'fetchPhotoMetadata']);
        console.error(response);
        callback(false);
      } else {
        post.rawMedia = [api._createPicasaImageItem(response.data)];
        post.medias = processMediaItems(post.rawMedia);
        openNewPost();
      }
    }, post.image_id);
  } else {
    openNewPost();
  }
}

function resharePost(url, htmlContent, mentioned) {
  // HACKKKKKKKKKKK
  var div = document.createElement('div');
  div.innerHTML = htmlContent || '';
  var content = gpe.visitNormalizedHtmlNode(div);
  fetchPostData(url, function(data) {
    if (htmlContent && mentioned) {
      var postIdentifier;
      if (!data.via_id) {
        postIdentifier = 'the original post';
      } else {
        mentioned[data.via_id] = data.via_name;
        postIdentifier = '@' + data.via_id + '\'s reshare of the original post';
      }
      content = content.replace('${DS_POST_IDENTIFIER}', postIdentifier);
    }
    if (Settings.get('promoText') == 'shares') {
      content += '\n\n_(Shared using #DoShare)_';
    }
    var post = {reshare: data,
                share_id: data.update_id,
                content: content,
                mentioned: mentioned,
                writeTimeStamp: new Date().getTime(),
                activeIdentity: data.activeIdentity};
    var lastUsed = localStorage['lastUsedCircles'];
    if (lastUsed && data.isPublic) {
      post.entities = JSON.parse(lastUsed);
    } else {
      post.entities = [];
    }
    newPost(post);
  });
}

function parseEntities(entities) {
  if (!(entities instanceof Array)) {
    return;
  }
  return entities.map(function(entity) {
    if (entity.circleId) {
      var id = entity.circleId;
      if (id == 'PUBLIC') {
        return {type: GooglePlusAPI.AclType.PUBLIC};
      } else if (id == 'EXTENDED_CIRCLES') {
        return {type: GooglePlusAPI.AclType.EXTENDED_CIRCLES};
      } else if (id == 'YOUR_CIRCLES') {
        return {type: GooglePlusAPI.AclType.YOUR_CIRCLES};
      } else {
        return {
          type: GooglePlusAPI.AclType.SPECIFIED_CIRCLE,
          id: id
        }
      }
    } else if (entity.personId) {
      return {
        type: GooglePlusAPI.AclType.SPECIFIED_PERSON,
        id: entity.personId
      }
    }
  });
}

function getApi(identityId) {
  var api = apis[identityId];
  if (!api) {
    api = plus;
  }
  return api;
}

function getPostNumberingString(shareAs) {
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var pt = postTrackers[shareAs];
  if (!pt) {
    console.error('No postTracker for ' + shareAs);
    return '';
  }
  var number = pt.getCount();
  if (number == undefined || number == null) {
    console.error('Post count not defined when posting');
    return '';
  }
  number += 1;
  if (number < 10) {
    number = '0' + number;
  }
  return '(' + days[new Date().getDay()] + number + ') ';
}

function onRequest(request, sender, callback) {
  var type = request.type;
  if (type == "post") {
    post(request.post, callback);
  } else if (type == "fetchAll") {
    fetchAll(request.lastUpdate, callback);
  } else if (type == "delPost") {
    delPost(request.writeTimeStamp, callback);
  } else if (type == "fetchPost") {
    fetchPost(request.writeTimeStamp, callback);
  } else if (type == "newPost") {
    newPost({content: request.content || '',
             link: request.link || '',
             image_id: request.image_id || '',
             writeTimeStamp: new Date().getTime(),
             activeIdentity: request.activeIdentity});
    _gaq.push(['_trackEvent', 'Source', request.source || 'unknown']);
  } else if (type == "resharePost") {
    resharePost(request.url, request.htmlContent, request.mentioned);
    _gaq.push(['_trackEvent', 'Source', (request.htmlContent ? 'commentReshare' : 'streamReshare')]);
  } else if (type == 'getId') {
    var info = plus && plus.getInfo();
    if (plus && plus.isAuthenticated() && info) {
      callback({'id': plus.getInfo().id});
    } else {
      callback({})
    }
  } else if (type == 'profileAutocomplete') {
    profileAutocomplete(request.prefix, callback);
  } else if (type == 'hashtagAutocomplete') {
    hashtagAutocomplete(request.prefix, callback);
  } else if (type == 'getLinkMedia') {
    getLinkMedia(request.link, function(rawMedia) {
      callback(processMediaItems(rawMedia));
    });
  } else if (type == 'getCircles') {
    var api = getApi(request.identityId);
    api.getCircles(function(response) {
      if (response.status) {
        callback(response.data);
      }
    });
  } else if (type == 'oauthAuthenticate') {
    oauth.authorize(callback);
  } else if (type == 'reInit') {
    initialize({clearPrevious: true});
    callback();
  } else if (type == 'refreshLogin') {
    initialize({clearPrevious: true});
    callback();
    oauth.clearTokens();
  } else if (type == 'getPostNumberingString') {
    var id = request.id || (plus.getInfo() && plus.getInfo().id);
    callback(getPostNumberingString(id));
  }
}

chrome.extension.onRequest.addListener(onRequest);
chrome.browserAction.onClicked.addListener(function(tab) {
  if (tab.url && tab.url.match(/^http/) && !tab.url.match(/http(|s):\/\/(plus|mail).google.com/)) {
    localStorage['_tmp_tab'] = JSON.stringify(tab);
  }
  chrome.tabs.create({url: chrome.extension.getURL('main.html'),
                      index: tab.index + 1}, c);
});

initialize({clearPrevious: true});

(function() {
 var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
 ga.src = 'https://ssl.google-analytics.com/ga.js';
 var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

// Oauth setup
var oauth = ChromeExOAuth.initBackgroundPage({
  'request_url': 'https://www.google.com/accounts/OAuthGetRequestToken',
  'authorize_url': 'https://www.google.com/accounts/OAuthAuthorizeToken',
  'access_url': 'https://www.google.com/accounts/OAuthGetAccessToken',
  'consumer_key': 'anonymous',
  'consumer_secret': 'anonymous',
  'scope': 'https://picasaweb.google.com/data/',
  'app_name': 'Do Share'
});

var initDataHandler = c;
window.addEventListener('message', function(event) {
  if (event.data.type == 'initDataMap') {
    initDataHandler(event.data.initDataMap);
  }
});
