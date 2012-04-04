function GPEditor(div, text, id) {
  var toolbar = document.createElement('div');
  toolbar.innerHTML = 
      ('<div class="toolbar">' +
        '<span id="boldButton$"><strong>B</strong></span>' +
        '<span id="italicButton$"><em>I</em></span>' +
        '<span id="overStrike$"><strike>S</strike></span>' +
      '</div>').replace(/\$/g, id);

  this.CONTAINER_CLASSNAME = 'gp-e-container';

  var container = this._container = document.createElement('div');
  container.className = this.CONTAINER_CLASSNAME;
  this.setText(text);

  div.appendChild(toolbar);
  div.appendChild(container);

  Editor(container, id);

  this.tagStack = new function() {
    this.stack = [];

    this.wrap = function(text) {
      var s = '';
      for (var i = 0; i < this.stack.length; ++i) {
        s += this.stack.reverse()[i];
      }
      s += text;
      for (var i = 0; i < this.stack.length; ++i) {
        s += this.stack[i];
      }

      return s;
    }

    this.push = function(tag) {
      this.stack.push(tag);
    }

    this.pop = function() {
      this.stack.pop();
    }
  }();

  container.onkeydown = this.onKeyDown;
}

GPEditor.prototype.normalizeHtml = function(element) {
  element.innerHTML = element.innerHTML
    // Add space if in middle of word.
    .replace(/([a-zA-Z0-9\.,])(<b[ >]|<i[ >]|<s(trike|)[ >])/g, "$1 $2")
    .replace(/(<\/b>|<\/i>|<\/s(trike|)>)([a-zA-Z0-9])/g, "$1 $2");
}

GPEditor.prototype.getText = function() {
  var clone = this._container.cloneNode(true);
  this.normalizeHtml(clone);
  return this.normalizedHtmlToPlusFormat(clone)
      .replace(/^\s*/, '')
      .replace(/\s*$/, '');
}

GPEditor.prototype.setText = function(text) {
  var html = this.plusFormatToHtml(text);
  this._container.innerHTML = '<p>' + (html || '<br>') + '</p>';
}

GPEditor.prototype.plusFormatToHtml = function(text) {
  return text
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')

    .replace(/\n/g, '\n ')
    .replace(/(([\s()\.,!?]|^)((<[^>]*>)|[-_])*)\*([^\n]*?[^\s])\*(((<[^>]*>)|[-_])*([()\.,!?]|$|\s))/g, '$1<b>$5</b>$6')
    .replace(/(([\s()\.,!?]|^)((<[^>]*>)|[-\*])*)_([^\n]*?[^\s])_(((<[^>]*>)|[-\*])*([()\.,!?]|$|\s))/g, '$1<i>$5</i>$6')
    .replace(/(([\s()\.,!?]|^)((<[^>]*>)|[\*_])*)-([^\n]*?[^\s])-(((<[^>]*>)|[\*_])*([()\.,!?]|$|\s))/g, '$1<s>$5</s>$6')
    .replace(/\n /g, '<br>');
  return $;
}

/**
 * Assumption: Source HTML only has design tags in the beginning or end of a word.
 */
GPEditor.prototype.normalizedHtmlToPlusFormat = function(element) {
  var clone = element.cloneNode(true);
  clone.innerHTML = clone.innerHTML
      .replace(/<.*?>\s*<.*?>/g, '')
      .replace(/( +)(<\/.*?>)/g, "$2$1");
  return this.visitNormalizedHtmlNode(element);
}

GPEditor.prototype.visitNormalizedHtmlNode = function(element) {
  var debug = false;
  var tagName = element.tagName;
  debug &= !!tagName;
  var s = '';

  var data = element.data || '';
  var plusStyleTag = '';
  var prefix = '';
  var postfix = '';
  var dontCrawlChildren = false;
  var tag = element.tagName;
  switch (tag) {
    case "B":
      prefix = postfix = plusStyleTag = '*';
      break;
    case "I":
      prefix = postfix = plusStyleTag = "_";
      break;
    case "S":
    case "STRIKE":
      prefix = postfix = plusStyleTag = "-";
      break;
    case "A":
      if (element.className == 'proflink') {
        data = '@' + element.getAttribute('oid') + ' ' || '';
        dontCrawlChildren = true;
      }
      break;
    case "P":
      postfix = "\n\n";
      break;
    case "BR":
      // The browser handles <b>line<br>line</b> but Google+ needs *line*\n*line*, use tagStack.
      data = this.tagStack.wrap('\n');
      break;
    case "SPAN":
      if (element.className == 'proflinkPrefix') {
        return s + ' ';
      }
      break;
  }

  s += (debug ? '{' + tagName + '}' : '');

  if (plusStyleTag) {
    this.tagStack.push(plusStyleTag);
  }

  s += prefix;
  if (data) {
    s += data;
  }
  var c = element.childNodes;
  if (!dontCrawlChildren) {
    for (var i = 0; i < c.length; ++i) {
      s += this.visitNormalizedHtmlNode(c[i]);
    }
  }
  s += postfix;

  if (plusStyleTag) {
    this.tagStack.pop();
  }

  s += (debug ? '{/' + tagName + '}' : '')
  return s;
}

GPEditor.prototype.onKeyDown = function(event) {
  var KEY = {
    PLUS: 187,
    AT: 50
  };
  var k = event.keyCode;
  if (!((k == KEY.AT || k == KEY.PLUS) && event.shiftKey)) {
    return;
  }

  var self = this;

  var range = window.getSelection().getRangeAt(0);
  range.deleteContents();

  event.preventDefault();
	var wrapper = $('<span class="proflinkWrapper"></span>');
	range.insertNode(wrapper[0]);

  var acDiv = $('<div>').addClass("ui-helper-clearfix").appendTo($(document.body)),
      input = $('<input>').appendTo(acDiv);

	input.position({
	        of: wrapper,
	        my: 'left top'
	        })
	    .autocomplete({
		minLength: 0,
		source: function(request, callback) {
		  // TODO: use Google+
		  callback(request.term && [{
			  name: request.term,
			  photoUrl: 'https://lh5.googleusercontent.com/-prSv4WTob5c/AAAAAAAAAAI/AAAAAAAAAAA/Ct8skkiZrCE/s27-c/photo.jpg',
			  id: 3
			}] || undefined);
		},
		focus: function() {return false;},
		select: function(event, ui) {
		  var item = ui.item;
      var plusSpan = $('<span></span>').addClass('proflinkPrefix').text('+').appendTo(wrapper),
			    a = $('<a></a>').addClass('proflink').attr({
			      oid: item.id,
			      href: 'https://plus.google.com'
			    }).text(item.name).appendTo(wrapper);
			range.insertNode(wrapper[0]);
			input.remove();
			$(self).focus();
			range = document.createRange();
			range.setStartAfter(wrapper[0]);
			window.getSelection().removeAllRanges();
			window.getSelection().addRange(range);
			return false;
		},
		
	})
	.focus()
	.data('autocomplete')._renderItem = function(ul, item) {
		return $('<li></li>')
			.data('item.autocomplete', item)
			.append('<a><img src="' + item.photoUrl + '" />' + item.name + '</a>' )
			.appendTo(ul);
	}
}
