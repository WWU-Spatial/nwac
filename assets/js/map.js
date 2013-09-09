/*JSHINT Disable for ALL Other USES*/
var esri, dojo, alert;
/*jshint expr:true */
/* END JSHINT*/

//initialize dojo
dojo.require("esri.map");
dojo.require("esri.dijit.BasemapGallery");
dojo.require("dijit.form.Slider");
dojo.require("esri.tasks.query");
dojo.require("esri.tasks.geometry");

/**************************** CHECK FOR BROWSER SUPPORT ***************************/



/********************************** CONSTANTS *************************************/
var DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;


/******************************** GLOBAL VARIABLES ********************************/
var map;
var basemaps;
var markup;
var graphic = null;
var type;
var obsGotten = false;
var avyObsGotten = false;
var addObType;
var prevFromDate, prevToDate;
var datesChanged = false;
var storeUser = 'NWACMobileUserInfo';
var useLocalStorage = supports_local_storage();
var proxyUrl;
var queryTask, query;
var symbol;
var RegionsBoth;
var query, queryTask;
var initExtent;
var form;
var basemapGallery;
var today = formatDate(new Date(), 'display');
var showObsAttsHandle, showAvyObsAttsHandle;
var addGraphicHandle;
var currentLocSymbol;
var avyObsSymbol;
var obsSymbol;
var highlighted;
var prevObsLayer = null;
var prevGraphic = null;
var lastObsAdded;
var zone;
var infoTimeout;

/********************************** FUNCTIONS *************************************/

/*
 * Formats a javascript Date() object and returns it as a string.  Accepts two 
 * parameters.  The first parameter is the date object.  The second parameter is 
 * the optional format.  If no format parameter is passed, then the date string is 
 * returned as yyyy-mm-dd.  If the second parameter is set to "display" then the date 
 * string is returned as yyyy-mm-dd
 */
function formatDate(date, format) {
	var dd = date.getDate();
	var mm = date.getMonth() + 1; //Jan = 0
	var yyyy = date.getFullYear();
	
	if (dd < 10) {
		dd = '0' + dd;
	}
	
	if (mm < 10) {
		mm = '0' + mm;
	}
	
	if (format === 'display') {
		return mm + '/' + dd + '/' + yyyy;
	}
	
	return yyyy + '-' + mm + '-' + dd;
}


function isInputTypeFileImplemented() {
	var elem = document.createElement("input");
	elem.type = "file";
	if (elem.disabled) {
		$('.fileInput').remove();
		return false;
	}
	try {
		elem.value = "Test";
		//Throws error if type=file is implemented
		return elem.value !== "Test";
	} catch (e) {
		return elem.type === "file";
	}
}



// check for URL query and show obs and/or avyObs if specified "TRUE"
function checkForURLParams() {
	var url = document.location.href;
	var urlObject = esri.urlToObject(url);
	if (urlObject.query) {
		if (urlObject.query.obs) {
			if (urlObject.query && urlObject.query.obs === 'TRUE') {
				dojo.connect(map, "onLoad", function() {
					show_hideObs('showObs');
					$('#obsFlip')[0].selectedIndex = 1;
				});
			}
		}
		if (urlObject.query.avyObs) {
			if (urlObject.query && urlObject.query.avyObs === 'TRUE') {
				dojo.connect(map, "onLoad", function() {
					show_hideObs('showAvyObs');
					$('#avyObsFlip')[0].selectedIndex = 1;
				});
			}
		}
	}
}



function addFilesForUpload(data) {
	// add image files to FormData if they have been selected
	$.each($(':file'), function() {
		var file = this.files[0];
		var name = $(this).attr('name');
		if (file) {
			data.append(name, file);
		}
	});
	return data;
}


function stabFormReturn(data, form) {
	$.mobile.hidePageLoadingMsg();
	var json = JSON.stringify(data, null, 2);
	var statusText = $.parseJSON(json).statusText;
	if (statusText === 'OK') {
		$('#stabTestDivLabel').html('Add another stability test?');
		$.mobile.changePage('#mapPage');
		resetForms(form);
	} else {
		alert('Oops, error submitting stability test');
	}
}



function formFail(error) {
	$.mobile.hidePageLoadingMsg();
	alert('Oops, error adding your observation', error);
	console.log(error);
}



function stabTestFormResponse() {
	$('#stabTestDivLabel').html('Add another stability test?');
	$.mobile.changePage('#mapPage');
	resetForms(form);
}



function getSingleObs(kind, id, sym, layer) {
	var url = 'http://dev.nwac.us/api/v1/' + kind + '/' + id;
	var request = esri.request({
		url : url,
		// Service parameters if required, sent with URL as key/value pairs
		content : {
			format : 'json'
		},
		// Returned data format
		handleAs : "json"
	});
	request.then(function(data) {
		appendOb(layer, data, sym);
	}, requestFailed);
}

function appendOb(layer, data, sym) {
	var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(data.location.longitude, data.location.latitude));
	var gr = new esri.Graphic(pt, sym, data);
	layer.add(gr);
}




function resetForms(form) {
	//reset whole form
	form[0].reset();
	// reset checkboxes in form
	try {
		$.each($(':checkbox'), function() {
			var name = $(this).attr('name');
			$('input[name=' + name + ']').attr('checked', false).checkboxradio("refresh");
		});
	} catch(err) {/*do nothing other than catch err*/
	}

	//reset select menus in form
	try {
		form.find("select").val('').selectmenu("refresh", true);
	} catch (e) {
		console.log(e);
	}
	form.attr("name") === 'obsForm' ? function() {
		try {
			$('#obs_location-elevation_units').val('feet').selectmenu("refresh", true);
		} catch (e) {
			console.log(e);
		}
	} : null;
	form.attr("name") === 'avyObsForm' ? function() {
		try {
			$('#avy_location-elevation_units').val('feet').selectmenu("refresh", true);
		} catch (e) {
			console.log(e);
		}
	} : null;

	//	refill user info if stored
	form.attr("name") !== 'stabTestForm' ? function() {
		useLocalStorage ? setUserInfo(window.localStorage.getItem(storeUser)) : setUserInfo(dojo.cookie(storeUser));
	} : null;
}



function formResponse(response, form) {
	//	console.log('response is: ', response);
	$.mobile.hidePageLoadingMsg();

	var json = JSON.stringify(response, null, 2);
	var id = $.parseJSON(json).id;
	//set for stabTest adds
	lastObsAdded = id;
	var layer;
	var sym = new esri.symbol.SimpleMarkerSymbol();

	// add the graphic to correct graphicsLayer if layer already populated
	switch (addObType) {
		case 'addObByClick' || 'addObByGeoloc':
			sym.setColor(new dojo.Color([0, 153, 255, 0.5]));
			layer = map.getLayer('obsLayer');
			!obsGotten ? null : getSingleObs('observation', id, sym, layer);
			askAddStabTest();
			break;
		case 'addAvyObByClick' || 'addAvyObByGeoloc':
			sym.setColor(new dojo.Color([153, 51, 255, 0.5]));
			layer = map.getLayer('avyObsLayer');
			!avyObsGotten ? null : getSingleObs('avalancheObservation', id, sym, layer);
			break;
	}
	map.graphics.hide();
	hideAskFillOutForm();
	updateGraphicHandles();
	$.mobile.changePage('#mapPage');
	resetForms(form);
}



function submitForm($this) {
	if (window.FormData !== undefined) {
		var data = new FormData();
		$this.serializeArray().forEach(function(field) {
			switch (field.name) {
				case 'datetime':
					var dt = new Date(field.value);
					field.value = formatDate(dt, 'obs') + ' 12:00';
					data.append(field.name, field.value);
					break;
			}
			data.append(field.name, field.value);
		});

		//append region name to FormData
		data.append('location-region', zone);

		// add image files to FormData if they have been selected
		addFilesForUpload(data);

		$.ajax({
			url : proxyUrl + '?' + $this.attr('action'),
			data : data,
			cache : false,
			contentType : false,
			processData : false,
			type : 'POST',
			success : function(response) {
				formResponse(response, $this);
			},
			error : function(error) {
				formFail(error);
			}
		});
	} else {
		var dtf = $this.find(':input[name=datetime]');
		dtf.val(formatDate(new Date(dtf.val()), 'obs') + ' 12:00');
		var options = {
			url : proxyUrl + '?' + $this.attr('action'),
			//add location-region
			data : {
				'location-region' : zone
			},
			cache : false,
			contentType : false,
			processData : false,
			type : 'POST',
			success : function(response) {
				formResponse(response, $this);
			},
			error : function(error) {
				formFail(error);
			}
		};
		$this.ajaxSubmit(options);
	}
}




function show_hideObs(value) {
	$.mobile.showPageLoadingMsg();
	if (value === 'showObs') {
		// disconnect addGraphic handler when showing obs
		!addGraphicHandle ? null : removeAddGraphicHandles();
		// disconnect first so doesn't repeat
		showObsAttsHandle ? dojo.disconnect(showObsAttsHandle) : null;
		if (!obsGotten) {
			getObs('observation');
		} else {
			map.getLayer('obsLayer').show();
			showObsAttsHandle = dojo.connect(map.getLayer('obsLayer'), "onClick", showAttributes);
			$.mobile.hidePageLoadingMsg();
		}
	} else if (value === 'showAvyObs') {
		// disconnect addGraphic handler when showing obs
		!addGraphicHandle ? null : removeAddGraphicHandles();
		// disconnect first so doesn't repeat
		showAvyObsAttsHandle ? dojo.disconnect(showAvyObsAttsHandle) : null;
		if (!avyObsGotten) {
			getObs('avalancheObservation');
		} else {
			map.getLayer('avyObsLayer').show();
			showAvyObsAttsHandle = dojo.connect(map.getLayer('avObsLayer'), "onClick", showAttributes);
			$.mobile.hidePageLoadingMsg();
		}
	} else if (value === 'hideObs') {
		!map.getLayer('obsLayer') ? null : map.getLayer('obsLayer').hide();
		$.mobile.hidePageLoadingMsg();
	} else if (value === 'hideAvyObs') {
		!map.getLayer('avyObsLayer') ? null : map.getLayer('avyObsLayer').hide();
		$.mobile.hidePageLoadingMsg();
	}
}

function removeAddGraphicHandles() {
	//remove map graphic (obs point) if not just location
	dojo.disconnect(addGraphicHandle);
	!addObType ? null : graphic.setSymbol(null);
	addObType = null;
	addGraphicHandle = null;
}

function getObs(kind) {
	type = kind;
	// add day so obs request contains the last day in range
	var plusDay = new Date(new Date(prevToDate).getTime() + DAY_IN_MILLISECONDS);
	var url = 'http://dev.nwac.us/api/v1/' + type + '/';
	var request = esri.request({
		url : url,
		// Service parameters if required, sent with URL as key/value pairs
		content : {
			format : 'json',
			datetime__gte : formatDate(new Date(prevFromDate), 'obs'),
			datetime__lte : formatDate(plusDay, 'obs'),
			time : new Date().getTime()
		},
		// Data format
		handleAs : "json"
	});
	type === 'observation' ? request.then(obsRequestSucceeded, requestFailed) : request.then(avyObsRequestSucceeded, requestFailed);

	datesChanged = false;
}

function obsRequestSucceeded(data) {
	var json = JSON.stringify(data, null, 2);
	var parsed = $.parseJSON(json);
	addObsLayer(parsed);
}

// added this function to handle bug when adding both obs types quickly
function avyObsRequestSucceeded(data) {
	var json = JSON.stringify(data, null, 2);
	var parsed = $.parseJSON(json);
	addAvyObsLayer(parsed);
}

function requestFailed(error) {
	console.log("Error: ", error.message);
}

function addObsLayer(data) {
	var sym = new esri.symbol.SimpleMarkerSymbol();
	var obsLayer = new esri.layers.GraphicsLayer();
	sym.setColor(new dojo.Color([0, 153, 255, 0.5]));
	obsLayer.id = 'obsLayer';
	obsGotten = true;
	//Add to map
	map.addLayer(obsLayer);

	//Add reports to the graphics layer
	dojo.forEach(data.objects, function(ob) {
		var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(ob.location.longitude, ob.location.latitude));
		var gr = new esri.Graphic(pt, sym, ob);
		obsLayer.add(gr);
	});
	showObsAttsHandle = dojo.connect(obsLayer, "onClick", showAttributes);
	//    type==='observation'?showObsAttsHandle=dojo.connect(obsLayer, "onClick", showAttributes):showAvyObsAttsHandle=dojo.connect(avyObsLayer, "onClick", showAttributes);
	obsLayer.show();
	map.reorderLayer(obsLayer, 1);
	$.mobile.hidePageLoadingMsg();
}

function addAvyObsLayer(data) {
	var sym = new esri.symbol.SimpleMarkerSymbol();
	var avyObsLayer = new esri.layers.GraphicsLayer();
	sym.setColor(new dojo.Color([153, 51, 255, 0.5]));
	avyObsLayer.id = 'avyObsLayer';
	avyObsGotten = true;

	map.addLayer(avyObsLayer);
	//Add reports to the graphics layer
	dojo.forEach(data.objects, function(ob) {
		var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(ob.location.longitude, ob.location.latitude));
		var gr = new esri.Graphic(pt, sym, ob);
		avyObsLayer.add(gr);
	});
	showAvyObsAttsHandle = dojo.connect(avyObsLayer, "onClick", showAttributes);
	//    type==='observation'?showObsAttsHandle=dojo.connect(obsLayer, "onClick", showAttributes):showAvyObsAttsHandle=dojo.connect(avyObsLayer, "onClick", showAttributes);
	avyObsLayer.show();
	map.reorderLayer(avyObsLayer, 1);
	$.mobile.hidePageLoadingMsg();
}

//// stability test
function getStabTest(gr, id) {
	var num = gr.attributes.id;
	// add day so obs request contains the last day in range
	var url = 'http://dev.nwac.us/api/v1/stabilityTest/';
	var rq = esri.request({
		url : url,
		content : {
			format : 'json',
			observation : num,
			time : new Date().getTime()
		},
		handleAs : "json"
	});

	rq.then(function(data) {
		stabTestRequestSucceeded(data, gr, id);
	}, requestFailed);
}

function stabTestRequestSucceeded(data, gr, id) {
	//	console.log(data.objects);
	var json = JSON.stringify(data, null, 2);
	var parsed = $.parseJSON(json);
	if (parsed.objects) {
		$.each(parsed.objects, function(num, obj) {
			//			console.log(num, obj);
			markup += "<li data-role='list-divider' data-theme='a'>" + 'Stability Test ' + (num + 1) + "</li>";
			obj.test_type !== '' && obj.test_type !== null ? addToMarkup('Shear quality', obj.test_type) : null;
			obj.failure_load !== '' && obj.failure_load !== null ? addToMarkup('Shear quality', obj.failure_load) : null;
			obj.shear_depth !== '' && obj.shear_depth !== null ? addToMarkup("Depth of shear", obj.shear_depth + ' ' + obj.shear_depth_units) : null;
			obj.shear_quality !== '' && obj.shear_quality !== null ? addToMarkup('Shear quality', 'Q' + obj.shear_quality) : null;
			obj.observations_comments !== '' && obj.observations_comments !== null ? addToMarkup('Test comments', obj.observations_comments) : null;
		});
	}

	makePage(gr, id);
}

////
function getElevation(lt, lng) {
	var getURL = 'http://open.mapquestapi.com/elevation/v1/profile?shapeFormat=raw&unit=f&latLngCollection=' + lt + ',' + lng;
	var request = esri.request({
		// Location of the data
		url : getURL,
		// Service parameters if required, sent with URL as key/value pairs
		content : {
		},
		// Data format
		handleAs : "json"
	});
	request.then(elevRequestSucceeded, requestFailed);
}

function elevRequestSucceeded(data) {
	var json = JSON.stringify(data.elevationProfile[0], null, 2);
	var parsed = $.parseJSON(json);
	var elev = Number(parsed.height).toFixed(0);
	$('#obs_location-elevation').val(elev);
	$('#avy_location-elevation').val(elev);
}

function createBasemapGallery() {
	var basemaps = [], basemapTopo, basemapStreets, basemapImagery;
	basemapTopo = new esri.dijit.Basemap({
		layers : [new esri.dijit.BasemapLayer({
			url : "http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer"
		})],
		id : "topo",
		title : "Topo"
	});
	basemapStreets = new esri.dijit.Basemap({
		layers : [new esri.dijit.BasemapLayer({
			url : "http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer"
		})],
		id : "streets",
		title : "Streets"
	});
	basemapImagery = new esri.dijit.Basemap({
		layers : [new esri.dijit.BasemapLayer({
			url : "http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
		})],
		id : "imagery",
		title : "Imagery"
	});
	basemaps.push(basemapTopo);
	basemaps.push(basemapStreets);
	basemaps.push(basemapImagery);

	basemapGallery = new esri.dijit.BasemapGallery({
		showArcGISBasemaps : false,
		basemaps : basemaps,
		map : map
	});
	basemapGallery.startup();
	dojo.connect(basemapGallery, "onError", function(error) {
		console.log(error);
	});
}

function changeBasemap(val) {
	basemapGallery.select(val);

	$('#basemapSelect').selectmenu("refresh", true);
}

function hideInfoDiv() {
	clearTimeout(infoTimeout);
	$('#infoDiv').fadeOut(1000);
	$('.esriSimpleSlider').css({
		visibility : "visible"
	});
	$('#map_zoom_slider').css({
		visibility : "visible"
	});
	$('#footerGroup').fadeIn(500);

	resizeMap();
	map.enableMapNavigation();
}

function addDangerOverlay() {

	RegionsBoth = new esri.layers.ArcGISTiledMapServiceLayer("http://140.160.114.190/ArcGIS/rest/services/NWAC/RegionsBoth/MapServer", {
		"opacity" : 0.55
	});

	//build query task for region
	buildRegionQuery();

	map.addLayer(RegionsBoth);

	// set date range for obs
	setDatePicker();
}

function setDate(db) {
	$(db).trigger('datebox', {
		'method' : 'set',
		'value' : today,
		'date' : new Date()
	}).trigger('datebox', {
		'method' : 'doset'
	});
	console.log(db, $(db).val());
	db === '#avy_Date' ? $('#avy_').html(today + '  Click to change') : $('#obs_').html(today + '  Click to change');
}

function setDatePicker() {
	console.log("FUNCTION: setDatePicker");
	prevToDate = today;
	prevFromDate = formatDate(new Date(new Date(prevToDate).getTime() - 10 * DAY_IN_MILLISECONDS), 'display');
	$('#from').html('From:  ' + prevFromDate);
	$('#to').html('To:  ' + prevToDate);

	$('#fromDate').live('change', function() {
		var temp = new Date();
		var diff = parseInt(($('#fromDate').data('datebox').theDate - temp) / (1000 * 60 * 60 * 24 ), 10);
		var diffstrt = (diff * -1) - 1;
		// If you want a minimum of 1 day between, make this -2 instead of -1

		$('#toDate').data('datebox').options.minDays = diffstrt;

		var dif = Math.round(((new Date($('#fromDate').val()).getTime() - new Date($('#toDate').val()).getTime())) / DAY_IN_MILLISECONDS);
		if (dif > 0) {
			var newTo = formatDate(new Date(new Date($('#fromDate').val()).getTime() + DAY_IN_MILLISECONDS), 'display');
			$('#toDate').val(newTo);
			$('#to').html('To:  ' + $('#toDate').val());
			prevToDate = newTo;
		}
	});
}

function getLocation() {
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(showLocation, locationError);
	} else {
		alert("Your location couldn't be determined...Either your browser doesn't support geolocation, or geolocation is disabled.  Check your browser settings to make sure location services are allowed for this site.");
	}
}

function locationError(error) {
	switch (error.code) {
		case error.PERMISSION_DENIED:
			alert("Your location couldn't be determined...Check your browser settings to make sure location services are allowed for this site.");
			console.log("Location not provided");
			break;
		case error.POSITION_UNAVAILABLE:
			alert("Your location couldn't be determined...Check your browser settings to make sure location services are allowed for this site.");
			console.log("Current location not available");
			break;
		case error.TIMEOUT:
			alert("Location request timed out");
			console.log("Timeout");
			break;
		default:
			alert("Error getting location");
			console.log("unknown error");
			break;
	}
}

function zoomToLocation(location) {
	var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(location.coords.longitude, location.coords.latitude));
	getLatLongThenGetElev(pt);

	map.centerAndZoom(pt, 16);
}

function setLongLatInForms(lt, lng) {
	$('#obs_location-latitude').val(lt);
	$('#obs_location-longitude').val(lng);
	$('#avy_location-latitude').val(lt);
	$('#avy_location-longitude').val(lng);
}

function showLocation(location) {
	if (addGraphicHandle.length > 0) {
		removeAddGraphicHandles();
	}
	
	//move the graphic and reset symbol color
	var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(location.coords.longitude, location.coords.latitude));
	graphic.setSymbol(getSymbol());
	graphic.setGeometry(pt);
	map.graphics.show();

	zoomToLocation(location);

}

/// add graphic
function addGraphic() {
	var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(0, 90));
	graphic = new esri.Graphic(pt, getSymbol());
	map.graphics.add(graphic);
	map.graphics.hide();
}

/// add point at current location
function getLatLongThenGetElev(mp) {
	var pt = esri.geometry.webMercatorToGeographic(mp);
	var lt = pt.y.toFixed(6);
	var lng = pt.x.toFixed(6);
	getElevation(lt, lng);
	setLongLatInForms(lt, lng);
}

/// add or move point on click
function addGraphicClick(e) {
	map.graphics.show();
	graphic.setSymbol(getSymbol());
	graphic.setGeometry(e.mapPoint);

	// request elevation and set in form
	getLatLongThenGetElev(e.mapPoint);

	askFillOutForm();
}

/// activate adding graphic on click by ob type
function startAddOb(value) {
	//remove handler if it exists before adding another...
	!addGraphicHandle ? null : removeAddGraphicHandles();

	addObType = value;
	getSymbol();

	//disconnect listeners for obs point clicks to show attributes if adding new ob
	disconnectShowAttsHandles();

	// call appropriate function for adding a point
	if (value !== 'addAvyObByGeoLoc' && value !== 'addObByGeoLoc') {
		addGraphicHandle = dojo.connect(map, 'onClick', addGraphicClick);
	} else {
		getLocation();
		askFillOutForm();
	}

	$.mobile.changePage('#mapPage');
	//,{changeHash: false});
	$('#addAvyObSelect option')[0].selected = true;
	$('#addObSelect option')[0].selected = true;

	$('#addObSelect').selectmenu("refresh", true);
	$('#addAvyObSelect').selectmenu("refresh", true);

	//set value of slider in askFormDiv
	if (value === 'addObByGeoLoc' || value === 'addObByClick') {
		$('#changeReportSlider')[0].selectedIndex = 0;
	} else {
		$('#changeReportSlider')[0].selectedIndex = 1;
	}
	$('#changeReportSlider').slider("refresh");

	addObType !== null ? changeObs(value) : null;
}

function getSymbol() {
	if (!addObType) {
		symbol = currentLocSymbol;
	} else if (addObType === 'addAvyObByClick' || addObType === 'addAvyObByGeoLoc') {
		symbol = avyObsSymbol;
	} else {
		symbol = obsSymbol;
	}
	return symbol;
}

function jQueryReady() {
	$('#mapPage').bind('pageshow', function() {
		resizeMap();
	});
}

function orientationChanged() {
	if (map) {
		resizeMap();
	}
}

function resizeMap() {
	if (map && $.mobile.activePage.data('url') === 'mapPage') {
		map.reposition();
		map.resize();

		// - $('#header').height() - $('#footer').height();
		$('#mapPage').css("height", $('body').height());
		$('#map').css("height", $('body').height());
		$('#map').css("width", "auto");

		$('#footer').css("width", '100%');
		$('#footer').css("bottom", '0');
		$('#header').css("width", '100%');
	}
}

// bookmarks
function bookmarkSelect_changeHandler(value) {

	var SR = new esri.SpatialReference({
		wkid : 102100
	});

	var OlympicsEXT = new esri.geometry.Extent(-13851000, 6045000, -13687000, 6050000, SR);
	var MtHoodEXT = new esri.geometry.Extent(-13592300, 5638300, -13510300, 5710600, SR);
	var StevensPassEXT = new esri.geometry.Extent(-13503992, 6024773, -13455073, 6098152, SR);
	var SnoqPassEXT = new esri.geometry.Extent(-13542712, 5957299, -13493793, 6030678, SR);
	var WhitePassEXT = new esri.geometry.Extent(-13536249, 5830776, -13487329, 5904155, SR);
	var WestStevensNorthEXT = new esri.geometry.Extent(-13603953, 5988709, -13408275, 6282227, SR);
	var WestStevensToSnoqEXT = new esri.geometry.Extent(-13655625, 5750225, -13459946, 6043743, SR);
	var WestSnoqToWhiteEXT = new esri.geometry.Extent(-13576436, 5955535, -13478597, 6102294, SR);
	var WestWhiteSouthEXT = new esri.geometry.Extent(-13674887, 5637557, -13479208, 5931075, SR);
	var EastStevensNorthEXT = new esri.geometry.Extent(-13497247, 5986263, -13301569, 6279781, SR);
	var EastStevensToSnoqEXT = new esri.geometry.Extent(-13542039, 5827732, -13346361, 6121250, SR);
	var EastSnoqToWhiteEXT = new esri.geometry.Extent(-13537501, 5846544, -13439662, 5993303, SR);
	var EastWhiteSouthEXT = new esri.geometry.Extent(-13569842, 5648857, -13374163, 5942375, SR);

	///
	var fullPT = {
		'point' : new esri.geometry.Point(-13521308.650948754, 5826008.784827091, SR),
		'level' : 6
	};
	var OlympicsPT = {
		'point' : new esri.geometry.Point(-13769917.244339418, 6020431.108485553, SR),
		'level' : 9
	};
	var MtHoodPT = {
		'point' : new esri.geometry.Point(-13554976.320801608, 5642220.692530684, SR),
		'level' : 9
	};
	var StevensPassPT = {
		'point' : new esri.geometry.Point(-13480396.74151801, 6043270.487268172, SR),
		'level' : 10
	};
	var SnoqPassPT = {
		'point' : new esri.geometry.Point(-13516933.64103834, 5987840.391056036, SR),
		'level' : 10
	};
	var WhitePassPT = {
		'point' : new esri.geometry.Point(-13510818.67877556, 5855936.581646458, SR),
		'level' : 10
	};
	var WestStevensNorthPT = {
		'point' : new esri.geometry.Point(-13502445.022642313, 6104318.377371862, SR),
		'level' : 8
	};
	var WestStevensToSnoqPT = {
		'point' : new esri.geometry.Point(-13533631.462262811, 6002457.104711823, SR),
		'level' : 9
	};
	var WestSnoqToWhitePT = {
		'point' : new esri.geometry.Point(-13562983.281124303, 5891164.79152866, SR),
		'level' : 9
	};
	var WestWhiteSouthPT = {
		'point' : new esri.geometry.Point(-13585608.641496703, 5771527.591557064, SR),
		'level' : 9
	};
	var EastStevensNorthPT = {
		'point' : new esri.geometry.Point(-13392681.582105009, 6101572.496190777, SR),
		'level' : 8
	};
	var EastStevensToSnoqPT = {
		'point' : new esri.geometry.Point(-13440939.23492287, 5991457.104711815, SR),
		'level' : 9
	};
	var EastSnoqToWhitePT = {
		'point' : new esri.geometry.Point(-13496024.250017693, 5889177.419305798, SR),
		'level' : 9
	};
	var EastWhiteSouthPT = {
		'point' : new esri.geometry.Point(-13481654.28302891, 5790008.23682748, SR),
		'level' : 9
	};

	var extentList = [initExtent, OlympicsEXT, MtHoodEXT, StevensPassEXT, SnoqPassEXT, WhitePassEXT, WestStevensNorthEXT, WestSnoqToWhiteEXT, WestStevensToSnoqEXT, WestWhiteSouthEXT, EastStevensNorthEXT, EastStevensToSnoqEXT, EastSnoqToWhiteEXT, EastWhiteSouthEXT];

	var pointList = [fullPT, OlympicsPT, MtHoodPT, StevensPassPT, SnoqPassPT, WhitePassPT, WestStevensNorthPT, WestSnoqToWhitePT, WestStevensToSnoqPT, WestWhiteSouthPT, EastStevensNorthPT, EastStevensToSnoqPT, EastSnoqToWhitePT, EastWhiteSouthPT];
	var center = extentList[value].getCenter();

	map.centerAndZoom(center, pointList[value].level);
	$.mobile.changePage('#mapPage');
}

function changeObs(val) {
	addObType = val;
	graphic.setSymbol(getSymbol());
	val === 'addObByClick' ? $('#changeReportSlider').attr('data-theme', 'b') : $('#changeReportSlider').attr('data-theme', 'd');
	$('#changeReportSlider').slider('refresh');
}

function changeSymbol(gr, val, id) {
	var sym = new esri.symbol.SimpleMarkerSymbol();

	if (val === 'highlight') {
		gr.setSymbol(highlighted);
	} else if (val === 'reset') {
		if (id === "obsLayer_layer") {
			sym.setColor(new dojo.Color([0, 153, 255, 0.5]));
			gr.setSymbol(sym);
		} else if (id === "avyObsLayer_layer") {
			sym.setColor(new dojo.Color([153, 51, 255, 0.5]));
			gr.setSymbol(sym);
		}
	}
	prevGraphic = gr;
	prevObsLayer = id;
}

function showAttributes(e) {
	//some bug makes this neccessary so as not to repeat this handler??
	showObsAttsHandle ? dojo.disconnect(showObsAttsHandle) : null;

	showGoToAttsDiv();

	var id = e.currentTarget.id;
	var gr = e.graphic;

	$('#hideGoToAttsDivButton').bind('click', function() {
		changeSymbol(gr, 'reset', id);
		hideGoToAttsDiv();
	});

	//reset symbol then change to highlighted color
	!prevObsLayer ? null : changeSymbol(prevGraphic, 'reset', prevObsLayer);
	changeSymbol(gr, 'highlight', id);

	$('#obsAttsContent').children().empty();
	markup = '';
	$.each(gr.attributes, function(k, v) {
		// Generate a list item for each item in the category and add it to our markup.
		if (v !== null && v !== '') {
			if (k === 'observer') {
				$.each(v, function(observerK, observerV) {
					if (observerV !== null && observerV !== '') {
						if (observerK !== "id" && observerK !== "resource_uri") {
							window[observerK + "VAR"] = observerV;
						}
					} else {
						window[observerK + "VAR"] = '';
					}
				});
			} else if (k === 'location') {
				$.each(v, function(locationK, locationV) {
					if (locationV !== null && locationV !== '') {
						if (locationK !== 'region') {
							if (locationK !== "id" && locationK !== "resource_uri") {
								window[locationK + "VAR"] = locationV;
							}
						}
					} else {
						window[locationK + "VAR"] = '';
					}
				});
			} else {
				if (k !== "id" && k !== "resource_uri") {
					if (k !== "id" && k !== "resource_uri"/** && k!=="make_public"*/) {
						window[k + "VAR"] = v;
					}
				}
			}
		} else {
			window[k + "VAR"] = '';
		}
	});

	//all types get these..
	var datetimeVAR, first_nameVAR, last_nameVAR, latitudeVAR, longitudeVAR, elevationVAR, slope_angleVAR, slope_aspectVAR, descriptionVAR, elevation_unitsVAR;
	datetimeVAR !== '' ? addToMarkup('Date', datetimeVAR[5] + datetimeVAR[6] + '/' + datetimeVAR[8] + datetimeVAR[9] + '/' + datetimeVAR[0] + datetimeVAR[1] + datetimeVAR[2] + datetimeVAR[3]) : null;
	first_nameVAR !== '' ? addToMarkup('Name', first_nameVAR + ' ' + last_nameVAR) : null;
	latitudeVAR !== '' ? addToMarkup('Latitude', Number(latitudeVAR).toFixed(6)) : null;
	longitudeVAR !== '' ? addToMarkup('Longitude', Number(longitudeVAR).toFixed(6)) : null;
	elevationVAR !== '' ? addToMarkup('Elevation', elevationVAR + ' ' + elevation_unitsVAR) : null;
	slope_angleVAR !== '' ? addToMarkup('Slope angle', slope_angleVAR + " degrees") : null;
	slope_aspectVAR !== '' ? addToMarkup('Slope aspect', slope_aspectVAR) : null;
	descriptionVAR !== '' ? addToMarkup('Location description', descriptionVAR) : null;

	if (id === 'avyObsLayer_layer') {
		//avy obs get these
		var slide_typeVAR, crown_depth_unitsVAR, causeVAR, slide_widthVAR, runout_lengthVAR, runout_length_unitsVAR, crown_depthVAR, slide_width_unitsVAR, weak_layerVAR, bed_surfaceVAR, number_caughtVAR, number_carriedVAR,
			number_buriedVAR, number_partially_buriedVAR, number_injuredVAR, number_killedVAR, avalanche_size_destructive_forceVAR, avalanche_size_relativeVAR;
		slide_typeVAR !== '' ? addToMarkup('Slide type', type_Lookup(slide_typeVAR)) : null;
		causeVAR !== '' ? addToMarkup('Caused by', cause_lookup(causeVAR)) : null;
		slide_widthVAR !== '' ? addToMarkup('Slide width', slide_widthVAR + ' ' + slide_width_unitsVAR) : null;
		runout_lengthVAR !== '' ? addToMarkup('Vertical fall', runout_lengthVAR + ' ' + runout_length_unitsVAR) : null;
		crown_depthVAR !== '' ? addToMarkup('Crown depth', crown_depthVAR + ' ' + crown_depth_unitsVAR) : null;
		weak_layerVAR !== '' ? weakLayer_lookup('Weak layer', weak_layerVAR) : null;
		bed_surfaceVAR !== '' ? addToMarkup('Bed surface', bedSurface_lookup(bed_surfaceVAR)) : null;
		number_caughtVAR !== '' ? addToMarkup('Number caught', number_caughtVAR) : null;
		number_carriedVAR !== '' ? addToMarkup('Number carried', number_carriedVAR) : null;
		number_buriedVAR !== '' ? addToMarkup('Number buried', number_buriedVAR) : null;
		number_partially_buriedVAR !== '' ? addToMarkup('Number partially buried', number_partially_buriedVAR) : null;
		number_injuredVAR !== '' ? addToMarkup('Number injured', number_injuredVAR) : null;
		number_killedVAR !== '' ? addToMarkup('Number killed', number_killedVAR) : null;
		avalanche_size_destructive_forceVAR !== '' ? addToMarkup('Size/Destructive force', sizeDF_lookup(avalanche_size_destructive_forceVAR)) : null;
		avalanche_size_relativeVAR !== '' ? addToMarkup('Size relative to path', sizeRelative_lookup(avalanche_size_relativeVAR)) : null;
	} else if (id === 'obsLayer_layer') {
		//snow and weather obs get these
		var air_tempVAR, cloud_coverVAR, precipitation_typeVAR, precipitation_intensityVAR, wind_directionVAR, wind_speedVAR, rapid_warmingVAR, recent_avalanchesVAR,
			recent_loadingVAR, shooting_cracksVAR, signs_of_collapseVAR, terrain_trapsVAR, weather_commentsVAR, snowpack_commentsVAR, observation_commentsVAR, snowpit_profile_imageVAR, snowpit_profile_image_urlVAR, mediaVAR;
		air_tempVAR !== '' ? addToMarkup('Air temperature', air_tempVAR + air_tempVAR) : null;
		cloud_coverVAR !== '' ? addToMarkup('Cloud cover', cloud_coverVAR) : null;
		precipitation_typeVAR !== '' ? addToMarkup('Precipitation type', precipitation_typeVAR) : null;
		precipitation_intensityVAR !== '' ? addToMarkup('Precipitation intensity', precipitation_intensityVAR) : null;
		wind_directionVAR !== '' ? addToMarkup('Wind direction', wind_directionVAR) : null;
		wind_speedVAR !== '' ? addToMarkup('Wind speed', wind_speedVAR) : null;
		rapid_warmingVAR !== '' ? addToMarkup('Rapid warming?', TF_lookup(rapid_warmingVAR)) : null;
		recent_avalanchesVAR !== '' ? addToMarkup('Recent avalanches?', TF_lookup(recent_avalanchesVAR)) : null;
		recent_loadingVAR !== '' ? addToMarkup('Recent loading', TF_lookup(recent_loadingVAR)) : null;
		shooting_cracksVAR !== '' ? addToMarkup('Shooting cracks', TF_lookup(shooting_cracksVAR)) : null;
		signs_of_collapseVAR !== '' ? addToMarkup('Signs of collapse?', TF_lookup(signs_of_collapseVAR)) : null;
		terrain_trapsVAR !== '' ? addToMarkup('Terrain traps', TF_lookup(terrain_trapsVAR)) : null;
		weather_commentsVAR !== '' ? addToMarkup('Snowpack comments', replaceURL(weather_commentsVAR)) : null;
		snowpack_commentsVAR !== '' ? addToMarkup('Snowpack comments', replaceURL(snowpack_commentsVAR)) : null;
		observation_commentsVAR !== '' ? addToMarkup('Observation comments', replaceURL(observation_commentsVAR)) : null;
		snowpit_profile_imageVAR !== '' ? addImgLinkToMarkup('Snowpit profile image', snowpit_profile_imageVAR) : null;
		snowpit_profile_image_urlVAR !== '' ? addToMarkup('Snowpit profile image URL', replaceURL(snowpit_profile_image_urlVAR)) : null;
		mediaVAR !== '' ? addImgLinkToMarkup('Photo', mediaVAR) : null;
	}

	//add stability tests if obs, if avyobs then just make page
	id === 'obsLayer_layer' ? getStabTest(gr, id) : makePage(gr, id);
}

function replaceURL(val) {
	var exp = /(\b(https?|http|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
	return val.replace(exp, "<a href='$1' target='_blank'>$1</a>");
}

function makePage() {
	$('#obsAtts').html(markup);
	$('#obsAtts').listview('refresh');
	$('#obsAttsPage').page();
}

function addImgLinkToMarkup(name, value) {
	markup += "<li data-role='list-divider'>" + name + '</li><li><a href="' + value + '"target="_blank" />View photo in new window</li>';
	return markup;
}

function addToMarkup(name, value) {
	markup += "<li data-role='list-divider'>" + name + "</li><li><p>" + value + "</p></li>";
	return markup;
}

function TF_lookup(val) {
	var text;
	val === 'true' || val === 'on' || val === true ? text = 'Yes' : text = "No";
	return text;
}

function sizeDF_lookup(df) {
	var dfText;
	if (df === "D1") {
		dfText = "(D1) Relatively harmless to people";
	} else if (df === "D2") {
		dfText = "(D2) Could bury, injure, or kill a person.";
	} else if (df === "D3") {
		dfText = "(D3) Could bury and destroy a car, damage a truck, destroy a wood frame house, or break a few trees.";
	} else if (df === "D4") {
		dfText = "(D4) Could destroy a railway car, large truck, several buildings, or a substantial amount of forest.";
	} else if (df === "D5") {
		dfText = "(D5) Could gouge the landscape. Largest snow avalanche known.";
	}

	return dfText;
}

function sizeRelative_lookup(rel) {
	var relText;
	if (rel === "R1") {
		relText = "(R1) Very small, relative to the path.";
	} else if (rel === "R2") {
		relText = "(R2) Small, relative to the path.";
	} else if (rel === "R3") {
		relText = "(R3) Medium, relative to the path.";
	} else if (rel === "R4") {
		relText = "(R4) Large, relative to the path.";
	} else if (rel === "R5") {
		relText = "(R5) Major or maximum, relative to the path.";
	}

	return relText;
}

function weakLayer_lookup(wL) {
	var wLText;
	if (wL === "PP") {
		wLText = "Precipitation Particles (New Snow)";
	} else if (wL === "MM") {
		wLText = "Machine Made snow";
	} else if (wL === "DF") {
		wLText = "Decomposing and Fragmented Particles";
	} else if (wL === "RG") {
		wLText = "Rounded Grains";
	} else if (wL === "FC") {
		wLText = "Faceted Crystals";
	} else if (wL === "DH") {
		wLText = "Depth Hoar";
	} else if (wL === "SH") {
		wLText = "Surface Hoar";
	} else if (wL === "MF") {
		wLText = "Melt Forms";
	} else if (wL === "IF") {
		wLText = "Ice Formations";
	}

	return wLText;
}

function bedSurface_lookup(bS) {
	var bSText;
	if (bS === "S") {
		bSText = "The avalanche released within a layer of recent storm snow.";
	} else if (bS === "I") {
		bSText = "The avalanche released at the new snow/old snow interface.";
	} else if (bS === "O") {
		bSText = "The avalanche released within the old snow.";
	} else if (bS === "G") {
		bSText = "The avalanche released at the ground, glacial ice or firn.";
	} else if (bS === "U") {
		bSText = "Unknown";
	}

	return bSText;
}

function type_Lookup(type) {
	var typeText;
	if (type === "L") {
		typeText = "Loose-snow avalanche";
	} else if (type === "WL") {
		typeText = "Wet loose-snow avalanche";
	} else if (type === "SS") {
		typeText = "Soft slab avalanche";
	} else if (type === "HS") {
		typeText = "Hard slab avalanche";
	} else if (type === "WS") {
		typeText = "Wet slab avalanche";
	} else if (type === "I") {
		typeText = "Ice fall or avalanche";
	} else if (type === "SF") {
		typeText = "Slush flow";
	} else if (type === "C") {
		typeText = "Cornice fall (w/o additional avalanche)";
	} else if (type === "R") {
		typeText = "Roof avalanche";
	} else if (type === "U") {
		typeText = "Unknown";
	}

	return typeText;
}

function cause_lookup(cause) {
	var causeText;
	if (cause === "AS") {
		causeText = "Skier";
	} else if (cause === "AR") {
		causeText = "Snowboarder";
	} else if (cause === "AI") {
		causeText = "Snowshoer";
	} else if (cause === "AM") {
		causeText = "Snowmobile";
	} else if (cause === "AB") {
		causeText = "An explosive detonated above the snow surface (air blast)";
	} else if (cause === "AO") {
		causeText = "Unclassified artificial trigger (specify in comments)";
	} else if (cause === "AU") {
		causeText = "Unknown artificial trigger";
	} else if (cause === "N") {
		causeText = "Natural trigger";
	} else if (cause === "NC") {
		causeText = "Cornice fall";
	} else if (cause === "NE") {
		causeText = "Earthquake";
	} else if (cause === "NI") {
		causeText = "Ice fall";
	} else if (cause === "AF") {
		causeText = "Foot penetration";
	} else if (cause === "AE") {
		causeText = "An explosive thrown or placed on or under the snow surface by hand";
	} else if (cause === "NL") {
		causeText = "Avalanche triggered by loose snow avalanche";
	} else if (cause === "NS") {
		causeText = "Avalanche triggered by slab avalanche";
	} else if (cause === "NR") {
		causeText = "Rock fall";
	} else if (cause === "NO") {
		causeText = "Unclassified natural trigger (specify in comments)";
	} else if (cause === "AA") {
		causeText = "Artillery";
	} else if (cause === "AL") {
		causeText = "Avalauncher";
	} else if (cause === "AC") {
		causeText = "Cornice fall triggered by human or explosive action";
	} else if (cause === "AX") {
		causeText = "Gas exploder";
	} else if (cause === "AH") {
		causeText = "Explosives placed via helicopter";
	} else if (cause === "AP") {
		causeText = "Pre-placed, remotely detonated explosive charge";
	} else if (cause === "AW") {
		causeText = "Wildlife";
	} else if (cause === "AK") {
		causeText = "Snowcat";
	} else if (cause === "AV") {
		causeText = "Vehicle (specify vehicle type in comments)";
	}

	return causeText;
}

function showGoToAttsDiv() {
	$('#goToAttsDiv').css({
		visibility : "visible",
		display : "block"
	});

	//hide the other div if it's visible
	hideAskFillOutForm();
}

function hideGoToAttsDiv() {
	$('#goToAttsDiv').css({
		visibility : "hidden",
		display : "none"
	});
}

function askFillOutForm() {
	//show form
	$('#askObsFormDiv').css({
		visibility : "visible",
		display : "block"
	});

	//set slider switch
	$('#askObsFormDivButton').bind('click', function() {
		if (addObType === 'addObByClick' || addObType === 'addObByGeoLoc') {
			$.mobile.changePage('#obsReport');
			//, {changeHash: false});
			!$('#obs_Date').val() ? setDate('#obs_Date') : null;
		} else {
			$.mobile.changePage('#avyReport');
			//, {changeHash: false});
			!$('#avy_Date').val() ? setDate('#avy_Date') : null;
		}
	});

	//reset symbols if any obs are highlighted
	!prevObsLayer ? null : changeSymbol(prevGraphic, 'reset', prevObsLayer);
	//hide the other div if it's visible
	hideGoToAttsDiv();
}

function askAddStabTest() {
	$('#askAddStabTestDiv').css({
		visibility : "visible",
		display : "block"
	});
}

function hideAskAddStabTestDiv() {
	$('#askAddStabTestDiv').css({
		visibility : "hidden",
		display : "none"
	});
	$('#stabTestDivLabel').html('Add stability test with observation?');
}

function hideAskFillOutForm() {
	$('#askObsFormDiv').css({
		visibility : "hidden",
		display : "none"
	});

	map.graphics.hide();
	addObType = null;
	updateGraphicHandles();
}

function disconnectShowAttsHandles() {
	showObsAttsHandle ? dojo.disconnect(showObsAttsHandle) : null;
	showAvyObsAttsHandle ? dojo.disconnect(showAvyObsAttsHandle) : null;
}

function updateGraphicHandles() {
	!addGraphicHandle ? null : removeAddGraphicHandles();
	!obsGotten ? null : showObsAttsHandle = dojo.connect(map.getLayer('obsLayer'), "onClick", showAttributes);
	!avyObsGotten ? null : showAvyObsAttsHandle = dojo.connect(map.getLayer('avObsLayer'), "onClick", showAttributes);
}

function buildRegionQuery() {
	console.log("FUNCTION: buldRegionQuery");
	dojo.connect(map, "onClick", getRegion);
	queryTask = new esri.tasks.QueryTask("http://140.160.114.190/ArcGIS/rest/services/NWAC/RegionsBoth/MapServer/0");
	dojo.connect(queryTask, "onError", noRegion);
	query = new esri.tasks.Query();
	query.spatialRelationship = esri.tasks.Query.SPATIAL_REL_INTERSECTS;
	query.returnGeometry = true;
	query.outFields = ["name", "region_num"];
	query.outSpatialReference = {
		"wkid" : 102100
	};
}

function noRegion() {
	console.log('not in a region - selecting region 1 for now, until there is a 14/other avalailable');
	zone = 1;
}

function getRegion(evt) {
	query.geometry = evt.mapPoint;
	queryTask.execute(query, function updateRegion(result) {
		var json = JSON.stringify(result, null, 2);
		var parsed = $.parseJSON(json);
		if (!parsed.features[0]) {
			noRegion('filler');
		} else {
			var regionNum = parsed.features[0].attributes.region_num;
			zone = regionNum;
		}
	});
}

function upDatePoint(lt, lng) {
	var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(lng, lt));
	graphic.setGeometry(pt);
}

function supports_local_storage() {
	try {
		return 'localStorage' in window && window['localStorage'] !== null;
	} catch( e ) {
		return false;
	}
}

function refreshUserInfo(email, first_name, last_name) {
	var user = {
		'email' : email,
		'first_name' : first_name,
		'last_name' : last_name
	};
	if (useLocalStorage) {
		window.localStorage.setItem(storeUser, dojo.toJson(user));
	} else {
		var exp = 7;
		// number of days to persist the cookie
		dojo.cookie(storeUser, dojo.toJson(user), {
			expires : exp
		});
	}
}

function setUserInfo(item) {
	var json = $.parseJSON(item);
	//obsForm
	$('#id_obs_observer-email').val(json.email);
	$('#id_obs_observer-first_name').val(json.first_name);
	$('#id_obs_observer-last_name').val(json.last_name);
	//avyObsForm
	$('#id_avyObs_observer-email').val(json.email);
	$('#id_avyObs_observer-first_name').val(json.first_name);
	$('#id_avyObs_observer-last_name').val(json.last_name);
}




function init() {
	esri.config.defaults.io.proxyUrl = proxyUrl = "http://140.160.114.190/proxy/proxy.ashx";
	esri.config.defaults.io.alwaysUseProxy = false;

	esri.config.defaults.map.slider = {
		top : "100px" // lower zoomSlider from default
	};

	initExtent = new esri.geometry.Extent(-13937126, 5280024, -13154411, 6454097, new esri.SpatialReference({
		wkid : 102100
	}));
	map = new esri.Map("map", {
		extent : initExtent,
		logo : false,
		wrapAround180 : true,
		fadeOnZoom : true,
		force3DTransforms : true,
		navigationMode : "css-transforms"
	});

	// disable map navigation until infoDiv is hidden
	map.disableMapNavigation();
	//	map.hideZoomSlider();

	//add the world topomap from arcgis online
	var basemap = new esri.layers.ArcGISTiledMapServiceLayer("http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer");
	map.addLayer(basemap);

	// basemap gallery
	createBasemapGallery();

	//onorientationchange doesn't always fire in a timely manner in Android so check for both orientationchange and resize
	var supportsOrientationChange = "onorientationchange" in window, orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";

	window.addEventListener(orientationEvent, function() {
		orientationChanged();
	}, false);

	dojo.connect(map, "onLoad", function() {
		infoTimeout = setTimeout(function() {
			// hide infoDive after 5 seconds
			hideInfoDiv();
		}, 5000);
		resizeMap();
		$.mobile.hidePageLoadingMsg();
		$('#infoDiv div:first').fadeIn(500);
	});

	addDangerOverlay();

	// set symbols colors
	currentLocSymbol = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([210, 150, 50, 0.5]), 8), new dojo.Color([210, 150, 50, 0.9]));
	avyObsSymbol = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([153, 51, 255, 0.5]), 8), new dojo.Color([153, 51, 255, 0.9]));
	obsSymbol = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 153, 255, 0.5]), 8), new dojo.Color([0, 153, 255, 0.9]));
	highlighted = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 20, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 0, 0]), 2), new dojo.Color([245, 7, 189, 0.5]));

	// preemptively add graphic so it appears at first click when adding an observation	-- hacky but works
	dojo.connect(map, 'onLoad', addGraphic);

	checkForURLParams();

	// Look for stored user info and use it for forms
	var userInfoJSON;
	if (useLocalStorage) {
		userInfoJSON = window.localStorage.getItem(storeUser);
	} else {
		userInfoJSON = dojo.cookie(storeUser);
	}
	// Load user info
	// Fall back to a single bookmark if no cookie
	if (userInfoJSON && userInfoJSON !== 'null'/* && userInfoJSON.length > 2*/) {
		setUserInfo(userInfoJSON);
	}
}



function onDOMLoad() {
	$(document).ready(function() { jQueryReady;
		$.mobile.showPageLoadingMsg();

		$('#obsForm').validate();
		$("#avyObsForm").validate();
		$("#stabTestForm").validate();

		var datePickers = ['#fromDate', '#toDate', '#avy_Date', '#obs_Date'];
		dojo.forEach(datePickers, function(v) {
			//code to not allow any changes to be made to input field
			$(v).keydown(function() {
				return false;
			});
		});

	});

	// check if file input is supported
	isInputTypeFileImplemented();

	// set validator defaults
	jQuery.validator.setDefaults({
		debug : true,
		success : "valid"
	});

	// make toolbars not disappear
	$(document).delegate('[data-role=page]', 'pageinit', function() {
		$.mobile.fixedToolbars.setTouchToggleEnabled(false);
	});

	$('#dateLabel').html("NWAC Mobile");

	//resize map on pagechange to mapPage - to handle error...
	$(document).delegate('#mapPage', 'pageshow', function() {
		$('circle').each(function() {
			!$(this).attr('cx') ? $(this).attr('cx', 0) : null;
			!$(this).attr('cx') ? $(this).attr('cy', 0) : null;
		});
		resizeMap();
	});

	//add event handler to your form's submit event
	$('form').bind('submit', function(e) {
		//prevent the form from submitting normally
		e.preventDefault();

		//set observer value from email input
		var $this = $(this);

		var formName = $(this).attr("name");

		//show the default loading message while the $.post request is sent
		$.mobile.showPageLoadingMsg();
		console.log('submitting');
		if (formName === 'stabTestForm') {
			console.log('stabTestForm');
			if ($(this).valid()) {
				var obsID = lastObsAdded;
				var empty = true;

				var data = '{';
				var formArray = $this.serializeArray();
				formArray.forEach(function(field) {
					if (field.value) {
						switch(field.value) {
							case '':
							case null:
							default:
								empty = false;
						}
					}
				});
				if (empty === false) {
					formArray.forEach(function(field) {
						if (field.name === "shear_depth") {
							//don't add the N/V pair if no field.value
							field.value ? data += '"' + field.name + '": ' + field.value + ',' : null;
							//							data += '"'+field.name+'": '+field.value+',';
						} else if (field.name === "shear_quality") {
							if (field.value) {
								data += '"' + field.name + '": ' + field.value + ',';
							}
						} else {
							field.value ? data += '"' + field.name + '": "' + field.value + '",' : null;
							//							data += '"'+field.name+'": "'+field.value+'",';
						}
					});
					data += '"observation": "/api/v1/observation/' + obsID + '/"}';

					$.ajax({
						url : proxyUrl + '?' + $this.attr('action'),
						data : data,
						contentType : 'application/json',
						dataType : "json",
						type : 'POST',
						success : function(response) {
							stabTestFormResponse(response, $this);
						},
						error : function(data) {
							stabFormReturn(data, $this);
						}
					});
				} else {
					$.mobile.hidePageLoadingMsg();
					alert('At least one field must be entered');
				}
			} else {
				$.mobile.hidePageLoadingMsg();
				alert('Please fill out required fields');
			}
		} else {
			if (formName === "obsForm") {
				console.log('obsForm');
				if ($('#id_snowpit_profile_image_url').val().length > 0 && $('#id_snowpit_profile_image_url').val().substr(0, 7) !== 'http://') {
					$('#id_snowpit_profile_image_url').val('http://' + $('#id_snowpit_profile_image_url').val());
					$(this).validate({
						rules : {
							url : true
						}
					});
				}

				if ($(this).valid()) {
					refreshUserInfo($('#id_obs_observer-email').val(), $('#id_obs_observer-first_name').val(), $('#id_obs_observer-last_name').val());
					submitForm($this);
				} else {
					$.mobile.hidePageLoadingMsg();
					alert('Please fill out required fields');
				}
			} else {//avyObsForm
				if ($(this).valid()) {
					refreshUserInfo($('#id_avyObs_observer-email').val(), $('#id_avyObs_observer-first_name').val(), $('#id_avyObs_observer-last_name').val());
					submitForm($this);
				} else {
					$.mobile.hidePageLoadingMsg();
					alert('Please fill out required fields');
				}
			}
		}
	});
	init();
}



dojo.addOnLoad(onDOMLoad);


