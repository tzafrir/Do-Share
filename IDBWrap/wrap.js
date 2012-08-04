IDBWrap = function(dbName, keyPath) {
  this._dbName = dbName;
  this._keyPath = keyPath;
  this._cachedCount = 0;
  this._cacheExpired = true;
  this.STORE_NAME = "IDBWrap.db";
  this.INTERVAL = 5000;
};

/**
 * Initialize the scheduler.
 *
 * @param {function(boolean)} callback Success/failure callback.
 */
IDBWrap.prototype.init = function(callback) {
  this._initDb(callback);

};

/**
 * Adds an item to the db.
 *
 * @param {Object} An item.
 * @param {function(boolean)} callback A success/failure callback.
 */
IDBWrap.prototype.put = function(item, callback) {
  var db = this._db;
  var trans = db.transaction([this.STORE_NAME], 'readwrite');
  var store = trans.objectStore(this.STORE_NAME);
  var request = store.put(item);

  request.onsuccess = this._onWriteSuccess(callback);
  request.onerror = this._onError(callback);
}

/**
 * Count how many items are in the database.
 *
 * @param {Function(Number)} callback.
 */
IDBWrap.prototype.count = function(callback) {
  if (this._cacheExpired) {
    var self = this;
    var store = this._getItemStore();
    var countRequest = store.count(IDBKeyRange.lowerBound(0));
    countRequest.onsuccess = function(e) {
      var result = e.target.result;
      if (result != 0 && !result) {
        return;
      }
      self._cacheExpired = false;
      self._cachedCount = result;
      callback(result);
    };
  } else {
    callback(this._cachedCount);
  }
}

IDBWrap.prototype.processItem = function(key, callback) {
  this._processAllItemsByRange(IDBKeyRange.only(key), callback);
}

IDBWrap.prototype._initDb = function(callback) {
  // Only Chrome is supported officially. Chrome's indexedDB implementation is a bit different than
  // other browsers', pull requests to handle multi browser are welcome.
  var indexedDB = window.indexedDB || window.webkitIndexedDB;
  if (!indexedDB) {
    _fail('IDBWrap requires a browser with IndexedDB support');
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
          db.createObjectStore(self.STORE_NAME, {keyPath: self._keyPath});
        }
        callback(true);
      };
    } else {
      callback(true);
    }
  };
  request.onerror = this._onError(callback);
}

IDBWrap.prototype._fail = function(callback, message) {
  callback(false);
  console.error(message);
}

IDBWrap.prototype._getItemStore = function() {
  try {
  var db = this._db;
  var trans = db.transaction([this.STORE_NAME], 'readonly');
  return trans.objectStore(this.STORE_NAME);
  } catch(e){console.log(e)}
}

IDBWrap.prototype._processAllItemsByRange = function(keyRange, callback) {
  if (!keyRange) {
    keyRange = IDBKeyRange.lowerBound(0);
  }
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

IDBWrap.prototype._removeItem = function(key, callback) {
  var db = this._db;
  var trans = db.transaction([this.STORE_NAME], 'readwrite');
  var store = trans.objectStore(this.STORE_NAME);
  var request = store.delete(key);

  request.onsuccess = this._onWriteSuccess(callback);
  request.onerror = this._onError(callback);
}

IDBWrap.prototype._onSuccess = function(callback) {
  return function(event) {
    callback(true);
  }
}

IDBWrap.prototype._onWriteSuccess = function(callback) {
  var self = this;
  return function(event) {
    self._cacheExpired = true;
    self._onSuccess(callback)();
  }
}

IDBWrap.prototype._onError =  function(callback) {
  return function(event) {
    this._fail(callback, 'Failed with errorCode ' + event.target.errorCode);
  };
}
