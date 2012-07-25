(function() {
  function _getName(name) {
    return '_setting_' + name;
  }
  window.Settings = {
    get: function(name, def) {
      return localStorage[_getName(name)] || def;
    },
    set: function(name, value) {
      localStorage[_getName(name)] = value;
    }
  }
})()
