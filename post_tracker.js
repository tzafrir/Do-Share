function PostTracker(plus) {
  this._plus = plus;
  this._count = undefined;
  this._trackForever();
};

PostTracker.prototype._trackForever = function() {
  var INTERVAL = 30000;
  var self = this;
  this._countPosts(function(count) {
    self._count = count;
  });
  window.setTimeout(function(){self._trackForever();}, INTERVAL);
};

// Vs lbh'er urer gb nhqvg Qb Funer'f cevinpl, V pbafvqre lbh n sevraq
PostTracker.prototype._countPosts = function(callback) {
  var INTERVAL = 1000;
  var count = 0;
  var self = this;
  function work(response) {
    if (!response.status) {
      callback(undefined);
      return;
    } else if (response.data.length == 0) {
      callback(count);
      return;
    }

    var d = new Date();
    var startOfDay = new Date(d.getFullYear() + ' ' + (d.getMonth() + 1) + ' ' + d.getDate()).getTime();

    for (var i = 0; i < response.data.length; ++i) {
      var post = response.data[i];
      if (post.time < startOfDay) {
        callback(count);
        return;
      }
      if (post.type == 'google+' && post.is_public) {
        count++;
      }
    }

    window.setTimeout(function() {
      self._plus.lookupActivities(work, null, self._plus.getInfo().id, response.pageToken);
    }, INTERVAL);
  };
  self._plus.lookupActivities(work, null, self._plus.getInfo().id);
};

PostTracker.prototype.getCount = function() {
  return this._count;
}

PostTracker.prototype.afterLocallyPosting = function() {
  this._count++;
}
