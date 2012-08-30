(function() {
  function complicatedDefaults(str) {
    var defaults = {
      promoText: 'shares',
      alternateAccount: '0',
      alwaysShare: '0'
    }
    if (str.indexOf('postNumbering') == 0) {
      return '0';
    }
    return defaults[str];
  }

  function _getName(name) {
    return '_setting_' + name;
  };
  window.Settings = {
    get: function(name) {
      return localStorage[_getName(name)] || complicatedDefaults(name) || '';
    },
    set: function(name, value) {
      localStorage[_getName(name)] = value;
    }
  }
})()
