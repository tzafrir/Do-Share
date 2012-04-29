/**
 * person: {
 *   name,
 *   id,
 *   photoUrl
 * }
 *
 * @param{function(string, function(person<Array>))} profileAutocompleter.
 */
function GPEditor(div, text, id, profileAutocompleter) {
  var toolbar = document.createElement('div');
  toolbar.innerHTML = 
      ('<div class="toolbar">' +
        '<span id="boldButton$"><strong>B</strong></span>' +
        '<span id="italicButton$"><em>I</em></span>' +
        '<span id="overStrike$"><strike>S</strike></span>' +
      '</div>').replace(/\$/g, id);

  this.CONTAINER_CLASSNAME = 'gp-e-container';
  this._profileAutocompleter = profileAutocompleter;

  var container = this._container = document.createElement('div');
  container.className = this.CONTAINER_CLASSNAME;
  this.setText(text);

  div.appendChild(toolbar);
  div.appendChild(container);

  this._div = div;
  this._toolbar = toolbar;
  this._container = container;
  this._mentioned = {};

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

  var self = this;
  container.onkeydown = function(event) {
    self.onKeyDown(event, this);
  }
}

GPEditor.prototype.destroy = function() {
  this._div.removeChild(this._toolbar);
  this._div.removeChild(this._container);
}

GPEditor.prototype.normalizeHtml = function(element) {
  element.innerHTML = element.innerHTML
    // Add space if in middle of word.
    .replace(/([a-zA-Z0-9\.,])(<b[ >]|<i[ >]|<s(trike|)[ >])/g, "$1 $2")
    .replace(/(<\/b>|<\/i>|<\/s(trike|)>)([a-zA-Z0-9])/g, "$1 $3");
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
      .replace(/( +|(&nbsp;)+)(<\/.*?>)/g, "$3$1")
      .replace(/<b><\/b>/g, '')
      .replace(/<i><\/i>/g, '')
      .replace(/<(s|strike)><\/(s|strike)>/g, '');
  return this.visitNormalizedHtmlNode(clone);
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
        data = '@' + element.getAttribute('oid');
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
        return s;
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

GPEditor.prototype.onKeyDown = function(event, element) {
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

  var offset = range.startOffset;
  if (offset > 0) {
    var lastChar = range.commonAncestorContainer.data[offset - 1];
    if (!(lastChar == ' ' || lastChar == String.fromCharCode(160))) { // &nbsp;
      return;
    }
  }

  range.deleteContents();

  function setCaretAfter(element) {
    var range = document.createRange();
    range.setStartAfter(element);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }

  event.preventDefault();
  var wrapper = $('<span>'),
      proflinkWrapper = $('<span class="proflinkWrapper"></span>')
        .css({'white-space': 'nowrap'})
        .attr({contenteditable: false})
        .appendTo(wrapper),
      plusSpan = $('<span></span>').addClass('proflinkPrefix').text((k == KEY.AT ? '@' : '+')).appendTo(proflinkWrapper),
      a = $('<a></a>').addClass('proflink').appendTo(proflinkWrapper),
      dummy = $('<pre>').css({
        display: 'inline-block',
        visibility: 'hidden',
        color: 'white',
        margin: 0,
        font: 'normal 13px/1.4 Arial, sans-serif'
      }).appendTo(wrapper);
      wrapper[0].appendChild(document.createTextNode(' '));
  range.insertNode(wrapper[0]);

  var acDiv = $('<div>').addClass("ui-helper-clearfix").appendTo($(document.body)),
      input = $('<input>').addClass('gp-ac-input').appendTo(acDiv);

  input.position({
          my: 'left top',
          at: 'left bottom',
          of: a,
          offset: '0 -1'
          })
      .keydown(function() {
        window.setTimeout(function(){dummy.text(input.val());}, 1);
      })
      .autocomplete({
    minLength: 0,
    source: function(request, callback) {
      self._profileAutocompleter(request.term, callback);
    },
    focus: function() {return false;},
    select: function(event, ui) {
      plusSpan.text('+');
      var item = ui.item;
      a.attr({
            oid: item.id,
            href: 'https://plus.google.com/' + item.id
          }).text(item.name);
      wrapper[0].appendChild(document.createTextNode(' '));
      setCaretAfter(wrapper[0]);
      acDiv.remove();
      dummy.remove();
      $(element).focus();
      self._mentioned[item.id] = item.name;
    },

  })
  .focus()
  .keydown(function(event) {
    var KEY = {
      ESC: 27,
      BACKSPACE: 8
    };
    var k = event.keyCode;
    if (k == KEY.BACKSPACE && !input.val()) {
      setCaretAfter(wrapper[0]);
      acDiv.remove();
      wrapper.remove();
    } else if (k == KEY.ESC) {
      setCaretAfter(wrapper[0]);
      proflinkWrapper.remove();
      wrapper.text('+' + input.val());
      acDiv.remove();
    }
  })
  .data('autocomplete')._renderItem = function(ul, item) {
    return $('<li></li>')
      .data('item.autocomplete', item)
      .append('<a><img src="' + item.photoUrl + '" />' + item.name + '</a>' )
      .appendTo(ul);
  }
}
