function createEditor() {

/*
	Commands
	--------
*/

function Command(command, editDoc) {
	this.execute = function() {
		editDoc.execCommand(command, false, null); 
	};
	this.queryState = function() {
		return editDoc.queryCommandState(command);
	};
}

function ValueCommand(command, editDoc) {
	this.execute = function(value) {
		editDoc.execCommand(command, false, value); 
	};
	this.queryValue = function() {
		return editDoc.queryCommandValue(command);
	};
}

function LinkCommand(editDoc) {
	var tagFilter = createElementFilter("A");
	this.execute = function() {
		var a = getContaining(editWindow, tagFilter);
		var initialUrl = a ? a.href : "http://";
		var url = window.prompt("Enter an URL:", initialUrl);
		if (url===null) return;
		if (url==="") {
			editDoc.execCommand("unlink", false, null); 
		} else {
			editDoc.execCommand("createLink", false, url); 
		}
	};
	this.queryState = function() {
		return !!getContaining(editWindow, tagFilter);
	};		
}

function InsertHelloWorldCommand() {
	this.execute = function() {		
		var elem = editWindow.document.createElement("SPAN");
		elem.style.backgroundColor = "red";
		elem.innerHTML = "Hello world!";
		overwriteWithNode(editWindow, elem);
	}	
	this.queryState = function() {
		return false;
	 }
}

/*

	Controllers
	-----------
	Connects Command-obejcts to DOM nodes which works as UI

*/

function TogglCommandController(command, elem) {	
	this.updateUI = function() {
		var state = command.queryState();
		elem.className = state?"active":"";
	}
	var self = this;
	elem.unselectable = "on"; // IE, prevent focus
	bindEvent(elem, "mousedown", function(evt) { 
		// we cancel the mousedown default to prevent the button from getting focus
		// (doesn't work in IE)
		if (evt.preventDefault) evt.preventDefault();
	});		
	bindEvent(elem, "click", function(evt) { 
		command.execute(); 	
		updateToolbar();
	});
}
function ValueSelectorController(command, elem) {
	this.updateUI = function() {
		var value = command.queryValue();
		elem.value = value;
	}
	var self = this;
	elem.unselectable = "on"; // IE, prevent focus		
	bindEvent(elem, "change", function(evt) { 
		editWindow.focus();
		command.execute(elem.value);	
		updateToolbar();
	});	
}
	

	var editFrame = document.getElementById("editFrame");
	editFrame.contentWindow.document.designMode="on";
	var editWindow = editFrame.contentWindow;
	var editDoc = editWindow.document;
	var updateListeners = [];
	
	var toolbarCommands = [
		["boldButton", TogglCommandController, new Command("Bold", editDoc)], 
		["italicButton", TogglCommandController, new Command("Italic", editDoc)],
		["leftButton", TogglCommandController, new Command("JustifyLeft", editDoc)],
		["rightButton", TogglCommandController, new Command("JustifyRight", editDoc)],
		["centerButton", TogglCommandController, new Command("JustifyCenter", editDoc)],
		["linkButton", TogglCommandController, new LinkCommand(editDoc)],
		["helloButton", TogglCommandController, new InsertHelloWorldCommand(editDoc)],
		["fontSelector", ValueSelectorController, new ValueCommand("FontName", editDoc)],
		["sizeSelector", ValueSelectorController, new ValueCommand("FontSize", editDoc)]
	];
		
	//for (var ix=0; ix<toolbarCommands.length;ix++) {
	//	var binding = toolbarCommands[ix];
	toolbarCommands.map(function(binding) {
		var elemId = binding[0], ControllerConstructor = binding[1], command=binding[2];
		var elem = document.getElementById(elemId);	
		var controller = new ControllerConstructor(command, elem);		
		updateListeners.push(controller);
	});
	
	function updateToolbar() { 
		updateListeners.map(function(controller){
			controller.updateUI();
		});
	};	
	
	bindEvent(editDoc, "keyup", updateToolbar);
	bindEvent(editDoc, "mouseup", updateToolbar); 
}
bindEvent(window, "load", createEditor);
