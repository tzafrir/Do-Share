function GPEditor(div, text, id) {
  var toolbar = document.createElement('div');
  toolbar.innerHTML = 
      ('<div class="toolbar">' +
        '<span id="boldButton$"><strong>B</strong></span>' +
        '<span id="italicButton$"><em>I</em></span>' +
        '<span id="overStrike$"><strike>S</strike></span>' +
      '</div>').replace(/\$/g, id);

  var iframe = document.createElement('iframe');
  iframe.src = 'opera_wysiwyg/page.html';

  div.appendChild(toolbar);
  div.appendChild(iframe);
  this._doc = null;
  iframe.onload = function(){
    Editor(iframe, id);
    this._doc = iframe.contentDocument;
    this.setText(text);
  }.bind(this);
}

GPEditor.prototype.normalizeHtml = function(element) {
  element.innerHTML = element.innerHTML
    // Add space if in middle of word.
    .replace(/([a-zA-Z0-9\.,])(<b[ >]|<i[ >]|<s(trike|)[ >])/g, "$1 $2")
    .replace(/(<\/b>|<\/i>|<\/s(trike|)>)([a-zA-Z0-9])/g, "$1 $2");
}

GPEditor.prototype.getText = function() {
  var clone = this._doc.body.children[0].cloneNode(true);
  this.normalizeHtml(clone);
  return this.normalizedHtmlToPlusFormat(clone);
}

GPEditor.prototype.setText = function(text) {
  this._doc.body.children[0].innerHTML = text;
}

/**
 * Assumption: Source HTML only has design tags in the beginning or end of a word.
 */
GPEditor.prototype.normalizedHtmlToPlusFormat = function(element) {
  var debug = false;
  var tagName = element.tagName;
  debug &= !!tagName;
  var s = (debug ? '{' + tagName + '}' : '');
  var data = element.data;
  var prefix = '';
  var postfix = '';
  var dontCrawlChildren = false;
  switch (element.tagName) {
    case "B":
      prefix = postfix = '*';
      break;
    case "I":
      prefix = postfix = "_";
      break;
    case "S":
    case "STRIKE":
      prefix = postfix = "-";
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
      postfix = "\n";
      break;
  }
  s += prefix;
  if (data) {
    s += data;
  }
  var c = element.childNodes;
  if (!dontCrawlChildren) {
    for (var i = 0; i < c.length; ++i) {
      s += this.normalizedHtmlToPlusFormat(c[i]);
    }
  }
  s += postfix;
  s += (debug ? '{/' + tagName + '}' : '')
  return s;
}

