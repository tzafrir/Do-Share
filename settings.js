(function() {
  function _getName(name) {
    return '_setting_' + name;
  };
  var defaults = {
    promoText: 'shares',
    alternateAccount: '0',
    postNumbering: '0'
  }
  window.Settings = {
    get: function(name) {
      return localStorage[_getName(name)] || defaults[name] || '';
    },
    set: function(name, value) {
      localStorage[_getName(name)] = value;
    }
  }
})()
