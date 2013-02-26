/**
 * Handler for scheduled tasks.
 *
 * @constructor
 *
 * @param {string} dbName A name for this instance. Sched5 will use a database by this name.
 * @param {string} keyPath A unique key path in the stored objects.
 * @param {function(Object)} scheduledCallback A function to run on an object at the scheduled time.
 * @param {function(Object)} missCallback A function to run on an object that was not run on
 *     its scheduled time.
 */
Sched5 = function(dbName, keyPath, scheduledCallback, missCallback) {
  this._dbName = dbName;
  this._keyPath = keyPath;
  this._scheduledCallback = scheduledCallback;
  this._missCallback = missCallback;
  this._expiredTasks = {};
  this._cacheExpired = true;
  this._cachedCount = 0;
  this.STORE_NAME = "scheduledItems";
  this.TIMESTAMP_INDEX = "timeStampIndex";
  this.TIMESTAMP_KEYPATH = "timeStamp";
  this.INTERVAL = 5000;
};

/**
 * Initialize the scheduler.
 *
 * @param {function(boolean)} callback Success/failure callback.
 */
Sched5.prototype.init = function(callback) {
  var self = this;
  this._initDb(function(success) {
    if (success) {
      window.setTimeout(function() {
        self._handleMisses();
        self._startPolling();
      }, 1000);
    }
    callback(success);
  });

};

/**
 * Adds an item to the scheduler. The scheduler will run scheduledCallback on item at timeStamp.
 *
 * @param {Object} An item.
 * @param {number} timeStamp time in milliseconds since Jan 1 1970 at which to schedule the item.
 * @param {function(boolean)} callback A success/failure callback.
 */
Sched5.prototype.schedule = function(item, timeStamp, callback) {
  var db = this._db;
  var trans = db.transaction([this.STORE_NAME], 'readwrite');
  var store = trans.objectStore(this.STORE_NAME);
  var container = {"item": item};
  container[this.TIMESTAMP_KEYPATH] = timeStamp;
  var request = store.put(container);

  request.onsuccess = this._onWriteSuccess(callback);
  request.onerror = this._onError(callback);
}

/**
 * Run callback on every scheduled container.
 *
 * @param {Function(Object)} callback The callback to be run.
 * @param {Function(Object)} doneCallback Callback to run when all items are processed.
 */
Sched5.prototype.processAllItems = function(callback, doneCallback) {
  var keyRange = IDBKeyRange.lowerBound(0);
  this._processAllContainersByRange(keyRange, function(itemContainer) {
    callback(itemContainer.item);
  }, doneCallback);
}

/**
 * Count how many items are in the database.
 *
 * @param {Function(Number)} callback.
 */
Sched5.prototype.count = function(callback) {
  var self = this;
  if (this._cacheExpired) {
    var store = this._getItemStore();
    var countRequest = store.count(IDBKeyRange.lowerBound(0));
    countRequest.onsuccess = function(e) {
      var result = e.target.result;
      if (result != 0 && !result) {
        return;
      }
      self._cachedCount = result;
      self._cacheExpired = false;
      callback(result);
    };
  } else {
    callback(this._cachedCount);
  }
}

/**
 * Process a single item in the scheduler.
 */
Sched5.prototype.processItem = function(key, callback) {
  var store = this._getItemStore();
  var cursorRequest = store.openCursor(IDBKeyRange.only(key));

  cursorRequest.onsuccess = function(e) {
    var result = e.target.result;
    if (!result) {
      return;
    }
    callback(result.value.item);
    result.continue();
  };
}

Sched5.prototype._initDb = function(callback) {
  // Only Chrome is supported officially. Chrome's indexedDB implementation is a bit different than
  // other browsers', pull requests to handle multi browser are welcome.
  var indexedDB = window.indexedDB || window.webkitIndexedDB;
  if (!indexedDB) {
    _fail('Sched5 requires a browser with IndexedDB support');
  }
  if ('webkitIndexedDB' in window) {
    window.IDBTransaction = window.webkitIDBTransaction;
    window.IDBKeyRange = window.webkitIDBKeyRange;
  }
  var request = indexedDB.open(this._dbName, 3);
  var self = this;
  request.onsuccess = function(event) {

    var db = event.target.result;
    self._db = db;

    // Generic error handler.
    db.onerror = function(e) {
      console.error(event.target.errorCode);
    };

    callback(true);
  };
  request.onerror = this._onError(callback);
  request.onupgradeneeded = function(e) {
    var db = event.target.result;
    if (!db.objectStoreNames.contains(self.STORE_NAME)) {
          var store = db.createObjectStore(self.STORE_NAME, {keyPath: "item." + self._keyPath});
          var index = store.createIndex(self.TIMESTAMP_INDEX, self.TIMESTAMP_KEYPATH,
          // Things you can only learn by reading the webkit source:
              {'unique': false});
    }
  };

  request.onerror = this._onError(callback);
}

Sched5.prototype._fail = function(callback, message) {
  callback(false);
  console.error(message);
}

Sched5.prototype._getItemStore = function() {
  var db = this._db;
  var trans = db.transaction([this.STORE_NAME], 'readonly');
  return trans.objectStore(this.STORE_NAME);
}

Sched5.prototype._processAllContainersByRange = function(keyRange, callback, doneCallback) {
  var index = this._getItemStore().index(this.TIMESTAMP_INDEX);
  var cursorRequest = index.openCursor(keyRange);

  cursorRequest.onsuccess = function(e) {
    var result = e.target.result;
    if (!result) {
      if (doneCallback instanceof Function) {
        doneCallback();
      }
      return;
    }
    callback(result.value);
    result.continue();
  };
}

Sched5.prototype._processAllContainersBefore = function(timeStamp, callback) {
  var keyRange = IDBKeyRange.upperBound(timeStamp);
  this._processAllContainersByRange(keyRange, callback);
}

Sched5.prototype._removeItem = function(key, callback) {
  var db = this._db;
  var trans = db.transaction([this.STORE_NAME], 'readwrite');
  var store = trans.objectStore(this.STORE_NAME);
  var request = store.delete(key);

  request.onsuccess = this._onWriteSuccess(callback);
  request.onerror = this._onError(callback);
}

Sched5.prototype._onWriteSuccess = function(callback) {
  var self = this;
  return function(event) {
    self._cacheExpired = true;
    self._onSuccess(callback)();
  }
}

Sched5.prototype._onSuccess = function(callback) {
  return function(event) {
    callback(true);
  }
}

Sched5.prototype._onError =  function(callback) {
  var self = this;
  return function(event) {
    self._fail(callback, 'Failed with errorCode ' + event.target.errorCode);
  };
}

Sched5.prototype._handleMisses = function() {
  var self = this;
  self._runAndRemove(function(value) {
    self._expiredTasks[value.timeStamp] = true;
    self._missCallback(value.item);
  });
}

Sched5.prototype._startPolling = function() {
  var self = this;
  var f = function() {
    self._runAndRemove(function(value) {
      // Workaround for concurrency issue with IndexedDB transactions. Handles the situation where
      // there are expired tasks with a pending delete request that wasn't run yet.
      if (!self._expiredTasks[value.timeStamp]) {
        self._scheduledCallback(value.item);
      } else {
        console.log('expired ' + value.timeStamp);
      }
    });
    window.setTimeout(f, self.INTERVAL);
  }

  // Take a break so the delete transactions start queuing.
  window.setTimeout(f, 3000);
}

Sched5.prototype._runAndRemove = function(func) {
  var self = this;
  this._processAllContainersBefore(new Date().getTime(), function(value) {
    self._removeItem(getKey(value, self._keyPath), function(){});
    func(value);
  });
}

function getKey(value, path) {
  var paths = path.split('.').reverse();
  var $ = value.item;
  while (paths.length > 0) {
    $ = $[paths.pop()];
  }
  return $;
}
