function GPEditor(div, text, id) {
  var toolbar = document.createElement('div');
  toolbar.innerHTML = 
      ('<div class="toolbar">' +
        '<span id="boldButton$"><strong>B</strong></span>' +
        '<span id="italicButton$"><em>I</em></span>' +
        '<span id="overStrike$"><strike>S</strike></span>' +
      '</div>').replace(/\$/g, id);

  var container = this._container = document.createElement('div');
  container.className = 'gp-e-container';
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
  }
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
      }
      dontCrawlChildren = true;
      break;
    case "P":
      postfix = "\n\n";
      break;
    case "BR":
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

