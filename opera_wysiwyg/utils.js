if (!Array.prototype.map) {
	Array.prototype.map = function(fun) {
		var collect = [];
		for (var ix = 0; ix < this.length; ix++) { collect[ix] = fun(this[ix]); }
		return collect;
	}
}

function bindEvent(target, eventName, fun) {
	if (target.addEventListener) {
		target.addEventListener(eventName, fun, false);
	} else {
		target.attachEvent("on" + eventName, function(){ fun(event); });
	} 
}