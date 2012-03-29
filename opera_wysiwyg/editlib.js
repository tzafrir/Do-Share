/*
Editlib.js
----------
Various functions for manipulating selections, used by editing commands
*/

var getContaining = (window.getSelection)?w3_getContaining:ie_getContaining;
var overwriteWithNode = (window.getSelection)?w3_overwriteWithNode:ie_overwriteWithNode;

function createElementFilter(tagName) {
	return function(elem){ return elem.tagName==tagName; }
}

/* walks up the hierachy until an element with the tagName if found.
Returns null if no element is found before BODY */
function getAncestor(elem, filter) {
	while (elem.tagName!="BODY") {
		if (filter(elem)) return elem;
		elem = elem.parentNode;
	}
	return null;
}

function includes(elem1, elem2) {
	if (elem2==elem1) return true;
	while (elem2.parentNode && elem2.parentNode) {
		if (elem2==elem1) return true;	
		elem2 = elem2.parentNode;
	}
	return false;
}

function ie_getContaining(editWindow, filter) {
	var selection = editWindow.document.selection;
	if (selection.type=="Control") {
		// control selection
		var range = selection.createRange();
		if (range.length==1) { 
			var elem = range.item(0); 
		}
		else { 
			// multiple control selection 
			return null; 
		}
	} else {
		var range = selection.createRange();
		var elem = range.parentElement();
	}
	return getAncestor(elem, filter);		
} 

function ie_overwriteWithNode(editWindow, node) {
	var rng = editWindow.document.selection.createRange();
	var marker = writeMarkerNode(editWindow, rng);
	marker.appendChild(node);
	marker.removeNode(); // removes node but not children
}

// writes a marker node on a range and returns the node.
function writeMarkerNode(editWindow, rng) {
	var id = editWindow.document.uniqueID;
	var html = "<span id='" + id + "'></span>";
	rng.pasteHTML(html);
	var node = editWindow.document.getElementById(id);
	return node;
}

// overwrites the current selection with a node
function w3_overwriteWithNode(editWindow, node) {
	var rng = editWindow.getSelection().getRangeAt(0);
	rng.deleteContents();
	if (isTextNode(rng.startContainer)) {
		var refNode = rightPart(rng.startContainer, rng.startOffset)		
		refNode.parentNode.insertBefore(node, refNode);
	} else {
		if (rng.startOffset==rng.startContainer.childNodes.length) {
			refNode.parentNode.appendChild(node);
		} else {
			var refNode = rng.startContainer.childNodes[rng.startOffset];
			refNode.parentNode.insertBefore(node, refNode);
		}
	}	
}

function w3_getContaining(editWindow, filter) {
	var range = editWindow.getSelection().getRangeAt(0);
	var container = range.commonAncestorContainer;		
	return getAncestor(container, filter);	
}

function isTextNode(node) {
	return node.nodeType==3;
}

function rightPart(node, ix) {
	return node.splitText(ix);
}
function leftPart(node, ix) {
	node.splitText(ix);
	return node;
}