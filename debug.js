chrome.extension.sendRequest({type: 'fetchAll'}, function(r){document.write('<pre>' + JSON.stringify(r, null, 2).replace('<', '&lt;').replace('>', '&gt;'))});
