/**
 * Handler for scheduled tasks.
 *
 * @constructor
 *
 * @param {string} dbName A name for this instance. Sched5 will use a database by this name.
 * @param {function(Object)} scheduledCallback A function to run on an object at the scheduled time.
 * @param {function(Object)} missCallback A function to run on an object that was not run on
 *     its scheduled time.
 */
Sched5 = function(dbName, scheduledCallback, missCallback) {
  this._dbName = dbName;
  this._scheduledCallback = scheduledCallback;
  this._missCallback = missCallback;
  this._expiredTasks = {};
  this.STORE_NAME = "scheduledItems";
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
      self._handleMisses();
      self._startPolling();
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
  var trans = db.transaction([this.STORE_NAME], IDBTransaction.READ_WRITE);
  var store = trans.objectStore(this.STORE_NAME);
  var request = store.put({
    "item": item,
    "timeStamp" : timeStamp
  });

  request.onsuccess = this._onSuccess(callback);
  request.onerror = this._onError(callback);
}

/**
 * Run callback on every scheduled container.
 *
 * @param {Function(Object)} callback The callback to be run.
 */
Sched5.prototype.processAllItems = function(callback) {
  var keyRange = IDBKeyRange.lowerBound(0);
  this._processAllContainersByRange(keyRange, function(itemContainer) {
    callback(itemContainer.item);
  });
}

/**
 * Count how many items are in the database.
 *
 * @param {Function(Number)} callback.
 */
Sched5.prototype.count = function(callback) {
  var store = this._getItemStore();
  var countRequest = store.count(IDBKeyRange.lowerBound(0));
  countRequest.onsuccess = function(e) {
    var result = e.target.result;
    if (result != 0 && !result) {
      return;
    }
    callback(result);
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
  var request = indexedDB.open(this._dbName);
  var self = this;
  request.onsuccess = function(event) {

    var db = event.target.result;
    self._db = db;

    // Generic error handler.
    db.onerror = function(e) {
      console.error(event.target.errorCode);
    };

    var v = "1.1";
    if (v != db.version) {
      var setVrequest = db.setVersion(v);

      setVrequest.onfailure = self._onError(callback);
      setVrequest.onsuccess = function(e) {
        if (!db.objectStoreNames.contains(self.STORE_NAME)) {
          db.createObjectStore(self.STORE_NAME, {keyPath: "timeStamp"});
        }
        callback(true);
      };
    } else {
      callback(true);
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
  var trans = db.transaction([this.STORE_NAME], IDBTransaction.READ_ONLY);
  return trans.objectStore(this.STORE_NAME);
}

Sched5.prototype._processAllContainersByRange = function(keyRange, callback) {
  var store = this._getItemStore();
  var cursorRequest = store.openCursor(keyRange);

  cursorRequest.onsuccess = function(e) {
    var result = e.target.result;
    if(!result) {
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
  var trans = db.transaction([this.STORE_NAME], IDBTransaction.READ_WRITE);
  var store = trans.objectStore(this.STORE_NAME);
  var request = store.delete(key);

  request.onsuccess = this._onSuccess(callback);
  request.onerror = this._onError(callback);
}

Sched5.prototype._onSuccess = function(callback) {
  return function(event) {
    callback(true);
  }
}

Sched5.prototype._onError =  function(callback) {
  return function(event) {
    _fail(callback, 'Failed with errorCode ' + event.target.errorCode);
  };
}

Sched5.prototype._handleMisses = function() {
  var self = this;
  this._runAndRemove(function(value) {
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
      if (!self._expiredTasks[value.key]) {
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
    self._removeItem(value.timeStamp, function(){});
    func(value);
  });
}
