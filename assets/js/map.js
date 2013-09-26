/*JSHINT Disable for ALL Other USES*/
/*jshint expr:true */
/*global esri: true, dojo: true/*
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
var SNOWPACK_SYMBOL_COLOR = [0, 153, 255, 0.5];
var AVALANCHE_SYMBOL_COLOR = [153, 51, 255, 0.5];


/************************************* APIS ***************************************/

/*
 * Use http://www.nwac.us/api/v1/ for production
 * Use http://dev.nwac.us/api/v1/ for development and debugging
 * NOTE: the nwac api does not support cross-domain requests.  For get requests
 * you can use a jsonp callback which is supported.  For posts, the proxy server
 * will need to be used.
 */
var NWAC_API = "http://dev.nwac.us/api/v1/";
var NWAC_SNOWPACK_API = NWAC_API + 'observation/';
var NWAC_AVALANCHE_API = NWAC_API + 'avalancheObservation/';
var NWAC_STABILITY_API = NWAC_API + 'stabilityTest/';
var MAPQUEST_ELEVATION_API = 'http://open.mapquestapi.com/elevation/v1/profile?shapeFormat=raw&unit=f&latLngCollection=';


/******************************** GLOBAL VARIABLES ********************************/
var map;
var basemaps;
var markup;
var prevFromDate, prevToDate;
var storeUser = 'NWACMobileUserInfo';
var useLocalStorage = supports_local_storage();
var proxyUrl;
var queryTask, query;
var symbol;
var RegionsBoth;
var query, queryTask;
var initExtent;
var basemapGallery;
var today = formatDate(new Date(), 'display');
var observationClickHandles = {};
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
var symbols = {};
var currentObservationType;
var activeObservation;
var activeObservationSymbol;

/********************************* GLOBAL LOOKUPS *********************************/

var true_false_lookup = {
	"true" : "Yes",
	"on" : "Yes",
	"false" : "No",
	"off" : "No"
};

var destructive_force_lookup = {
	"D1" : "(D1) Relatively harmless to people",
	"D2" : "(D2) Could bury, injure, or kill a person",
	"D3" : "(D3) Could bury and destroy a car, damage a truck, destroy a wood frame house, or break a few trees",
	"D4" : "(D4) Could destroy a railway car, large truck, several buildings, or a substantial amount of forest",
	"D5" : "(D5) Could gouge the landscape. Largest snow avalanche known"
};

var relative_size_lookup = {
	"R1" : "(R1) Very small, relative to the path",
	"R2" : "(R2) Small, relative to the path",
	"R3" : "(R3) Medium, relative to the path",
	"R4" : "(R4) Large, relative to the path",
	"R5" : "(R5) Major or maximum, relative to the path"
};

var weak_layer_lookup = {
	"PP" : "Precipitation Particles (New Snow)",
	"MM" : "Machine Made snow",
	"DF" : "Decomposing and Fragmented Particles",
	"RG" : "Rounded Grains",
	"FC" : "Faceted Crystals",
	"DH" : "Depth Hoar",
	"SH" : "Surface Hoar",
	"MF" : "Melt Forms",
	"IF" : "Ice Formations"
};

var bed_surface_lookup = {
	"S" : "The avalanche released within a layer of recent storm snow",
	"I" : "The avalanche released at the new snow/old snow interface",
	"O" : "The avalanche released within the old snow",
	"G" : "The avalanche released at the ground, glacial ice or firn",
	"U" : "Unknown"
};

var slide_type_lookup = {
	"L" : "Loose-snow avalanche",
	"WL" : "Wet loose-snow avalanche",
	"SS" : "Soft slab avalanche",
	"HS" : "Hard slab avalanche",
	"WS" : "Wet slab avalanche",
	"I" : "Ice fall or avalanche",
	"SF" : "Slush flow",
	"C" : "Cornice fall (w/o additional avalanche)",
	"R" : "Roof avalanche",
	"U" : "Unknown"
};

var avalanche_cause_lookup = {
	"AS" : "Skier",
	"AR" : "Snowboarder",
	"AI" : "Snowshoer",
	"AM" : "Snowmobile",
	"AB" : "An explosive detonated above the snow surface (air blast)",
	"AO" : "Unclassified artificial trigger (specify in comments)",
	"AI" : "Unknown artificial trigger",
	"N" : "Natural trigger",
	"NC" : "Cornice fall",
	"NE" : "Earthquake",
	"NI" : "Ice fall",
	"AF" : "Foot penetration",
	"AE" : "An explosive thrown or placed on or under the snow surface by hand",
	"NL" : "Avalanche triggered by loose snow avalanche",
	"NS" : "Avalanche triggered by slab avalanche",
	"NR" : "Rock fall",
	"NO" : "Unclassified natural trigger (specify in comments)",
	"AA" : "Artillery",
	"AL" : "Avalauncher",
	"AC" : "Cornice fall triggered by human or explosive action",
	"AX" : "Gas exploder",
	"AH" : "Explosives placed via helicopter",
	"AP" : "Pre-placed, remotely detonated explosive charge",
	"AW" : "Wildlife",
	"AK" : "Snowcat",
	"AV" : "Vehicle (specify vehicle type in comments)"
};

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


/*
 * Parses the url for parameters onload and adds the appropriate layer.
 * If snowpack=true, then the snowpack observation layer is loaded by default
 * if avalanche=true, then the avalanche observation layer is loaded by default
 * Previously, the parameter "obs" was used for the snowpack observations and
 * the paramter avyObs was used for avalanche observations.  These have been 
 * removed and replaced with snowpack and avalanche for better clarity.
 * If the previous links are still used, we can add them back
 */
function checkForURLParams() {
	var urlObject = esri.urlToObject(document.location.href);
	
	if (urlObject.query) {

		if (urlObject.query.snowpack === 'true') {
			dojo.connect(map, "onLoad", function() {
				toggleObservationLayer('snowpack', 'show');
				$('#obsFlip')[0].selectedIndex = 1;
			});
		}
		
		if (urlObject.query.avyObs) {
			if (urlObject.query.avalanche === 'TRUE') {
				dojo.connect(map, "onLoad", function() {
					toggleObservationLayer('avalanche', 'show');
					$('#avyObsFlip')[0].selectedIndex = 1;
				});
			}
		}
		
	}
}


/*
 * This function runs upon the completion of a Stability Test form
 * submission.  If the form was submitted correctly (statusText === 'OK') then
 * the add stability dialog box's main message is changed to 'Add another stability
 * test?', the forms fields are reset, and the page changes from the stability form
 * to the main map page where the add stability form dialog is still showing from
 * the initial submission.  If the form is not correctly processed, then an alert
 * message is presented to the user.
 * NOTE: The add stability dialog is displayed from another function upon successful
 * completion of either a snowpack or avalanche observation form submittal
 */
function stabFormReturn(response) {
	$.mobile.hidePageLoadingMsg();
	if (response.statusText === 'OK') {
		$('#stabTestDivLabel').html('Add another stability test?');
		resetForm('stabTestForm');
		$.mobile.changePage('#mapPage');
	} else {
		alert('Oops, error submitting stability test');
	}
}


/*
 * Processes a successful avalanche or observation form response.  Gets the object
 * id of the observation.  The id is created on the server and returned as part of the
 * response.  The id is set to the global lastObsAdded variable.  This is used for any
 * subsequent stability tests that need to be linked to the observation.
 * Additionally, an appropriate symbol is created for the point and added to the correct
 * layer for the observation type.
 */
function formResponse(response, formName) {
	var layer;
	var endpoint;
	var symbol;
	
	//set for stabTest adds
	lastObsAdded = response.id;

	// add the graphic to correct graphicsLayer if layer already populated
	switch (currentObservationType) {
		case 'snowpack':
			symbol = symbols['new-snowpack'];	
			layer = 'snowpack';
			endpoint = 'observation';
			$("#askAddStabTestDiv").show();
			break;
		case 'avalanche':
			symbol = symbols['new-avalanche'];
			layer = 'avalanche';
			endpoint = 'avalancheObservation';
			break;
	}
	getObservationById(endpoint, lastObsAdded, symbol, layer);
	map.graphics.hide();
	hideReportToggle();
	updateGraphicHandles();
	resetForm(formName);
	$.mobile.changePage('#mapPage');
	$.mobile.hidePageLoadingMsg();

}


/*
 * Handles an unsucessful snowpack or avalanche submission by hiding the loading message
 * and displaying a popup alert
 */
function formFail(error) {
	$.mobile.hidePageLoadingMsg();
	alert('Oops, error adding your observation', error);
}


/*
 * Gets an observation from the NWAC API.  Can get observations from either the 
 * 'observation', or avalancheObservation endpoints'.  The api server does not support
 * cross-domain requests, so we use a jsonp callback.  The callback parses the data
 * and adds an appropriate point to the map using the addObservationToMap functoin
 */
function getObservationById(endpoint, id, symbol, layerName) {
	var url = NWAC_API + endpoint + '/' + id + '/';
	$.ajax({
		url : url,
		contentType : 'application/json',
		dataType : "jsonp",
		data : {'format' : 'jsonp'},
		type : 'GET',
		success : function(data) {
			//Only add the point to the map if the layer already exists.  Otherwise
			//the point will be visible when the appropriate observation layer
			//is toggled on
			if (map.getLayer(layerName)) {
				addObservationToMap(symbol, layerName, data);
			}
		},
		error : function(error) {
			console.log(error);
		}
	});
}

/*
 * Adds an observation to the map using the appropriate symbol and observation type. 
 * snowpack/weather observations get added to the 'obsLayer' and avalanche observations
 * get added to the avyObsLayer using the appropriate symbols and layers passed in with 
 * the symbol and layer parameters
 */
function addObservationToMap(symbol, layerName, data) {
	var layer = map.getLayer(layerName);
	var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(data.location.longitude, data.location.latitude));
	var graphic = new esri.Graphic(pt, symbol, data);
	layer.add(graphic);
}



/*
 * Resets a form to it's default state by passing the name of the form to reset as a
 * string.  Will also repopulate the firstname, lastname and email address fields
 * from localstorage, if supported, or from a cookie
 */
function resetForm(formName) {
	var form = $('[name="' + formName + '"]');
	//reset whole form
	form[0].reset();
	
	// Uncheck all checkboxes in form
	form.find(':checkbox').attr('checked', false).checkboxradio("refresh");

	//reset select menus to their blank default
	form.find("select").val('').selectmenu("refresh", true);

	//Set the observation form units field back to feet
	if (formName === 'obsForm') {
			$('#obs_location-elevation_units').val('feet').selectmenu("refresh", true);
	}
	
	//Set the avalanche form units field back to feet
	if (formName === 'avyObsForm') {
		$('#avy_location-elevation_units').val('feet').selectmenu("refresh", true);
	}
		
	//Repopulate user info (email, firstname, lastname) from storage/cookie
	if (formName !== 'stabTestForm') {
		if (useLocalStorage) {
			//Get from local storage if supported in the browser
			setUserInfo(window.localStorage.getItem(storeUser));
		} else {
			//Otherwise, get from a cookie
			setUserInfo(dojo.cookie(storeUser));
		}
	}
}



/*
 * This function submits either the snowpack or avalanche observation forms using
 * the jQuery Form Plugin (http://jquery.malsup.com/form/).  This plugin allows
 * file attachments to be sent through ajax on older browsers using an iFrame method
 * or using FormData method on newer browsers.
 * Additionally, the datetime field has a 12:00 hour appended to it and a location
 * field is added based on the location where the observation was added (by glick
 * or GPS)
 */
function submitForm(formName) {
	var form = $('[name="' + formName + '"]');
	//Append 12:00 to the date to match the NWAC format 
	var dateField = form.find(':input[name=datetime]');
	var date = formatDate(new Date(dateField.val())) + " 12:00";
	dateField.val(date);
	
	var options = {
		url : proxyUrl + '?' + form.attr('action'),
		data : {
			'location-region' : zone
		},
		type : 'POST',
		dataType: 'json',
		success : function(response) {
			formResponse(response, formName);
		},
		error : function(error) {
			console.log('error', error);
			formFail(error);
		}
	};
	form.ajaxSubmit(options);
}



/*
 * This function toggles the visibility of the observation layers.  The two possible
 * values for layerName are "avalanche" and "snowpack". The visibility variable can
 * be either "hide" or "show".  This function, depending on the two variables, will
 * toggle the visibility of the selected layer.  The observation data is only requested
 * from the server the first time the layer is toggled on.  All subsequent requests 
 * just toggle the layers visibility.
 */
function toggleObservationLayer(layerName, visibility) {
	$.mobile.showPageLoadingMsg();
	if (visibility === 'show') {
		
		// disconnect first so doesn't repeat
		if (observationClickHandles[layerName]) {
			dojo.disconnect(observationClickHandles[layerName]);
		}
		
		if (map.getLayer(layerName)) {
			map.getLayer(layerName).show();
			observationClickHandles[layerName] = dojo.connect(map.getLayer(layerName), "onClick", showAttributes);
		} else {
			getObservationsByLayer(layerName);
		}
		
	} else if (visibility === 'hide') {
		if (map.getLayer(layerName)) {
			map.getLayer(layerName).hide();
		}
	}
	
	$.mobile.hidePageLoadingMsg();
}


/*
 * Makes a request to the NWAC API to get all observations (either avalanche or snowpack
 * depending on the layerName) between dates from the date-select controls.  Because the
 * date returned from the date selectors contains a time unit, we set the datetime to
 * mignight the following day to be sure all requests from the last day selected are 
 * returned.  The ESRI request function is used to make the ajax request.  The Huxley
 * proxy server is used for this request because the NWAC server does not allow cross-
 * domain requests.
 */
function getObservationsByLayer(layerName) {
	var url;
	
	if (layerName === "snowpack") {
		url = NWAC_SNOWPACK_API;
	} else if (layerName === 'avalanche') {
		url = NWAC_AVALANCHE_API;
	}
	
	// add day so obs request contains the last day in range
	var request = esri.request({
		url : url,
		// Service parameters if required, sent with URL as key/value pairs
		content : {
			format : 'json',
			datetime__gte : formatDate(new Date(prevFromDate), 'obs'),
			//Set hours to midnight (the next day) so that all points for that day are retreieved
			datetime__lte : formatDate(new Date(new Date(prevToDate).setHours(24,0,0,0)), 'obs'),
			time : new Date().getTime()
		},
		// Data format
		handleAs : "json"
	});

	request.then(function (data) {
		var json = JSON.stringify(data, null, 2);
		var parsed = $.parseJSON(json);
		addLayer(parsed, layerName);

	});
}


/*
 * Adds the appropriate observation layer to the map requested by the 
 * getObservationsByLayer function.
 */
function addLayer(data, layerName) {
	var symbol = new esri.symbol.SimpleMarkerSymbol();
	var layer = new esri.layers.GraphicsLayer();
	
	if (layerName === 'snowpack'){
		symbol.setColor(new dojo.Color(SNOWPACK_SYMBOL_COLOR));
		layer.id = 'snowpack';
	} else if (layerName === 'avalanche') {
		symbol.setColor(new dojo.Color(AVALANCHE_SYMBOL_COLOR));
		layer.id = 'avalanche';
	}
	
	//Add to map
	map.addLayer(layer);

	//Add reports to the graphics layer
	dojo.forEach(data.objects, function(item) {
		var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(item.location.longitude, item.location.latitude));
		var graphic = new esri.Graphic(pt, symbol, item);
		layer.add(graphic);
	});
	
	observationClickHandles[layerName] = dojo.connect(layer, "onClick", showAttributes);
	layer.show();

	$.mobile.hidePageLoadingMsg();
}


/*
 * Gets the elevation at a given latitude and longitude using the MapQuest
 * Elevation Profile API.  This function no longer uses a proxy server.  The
 * elevation value is truncated at the decimal point and added to the elevation
 * field in both observation forms.  The returned elevation value is in feet.
 */
function getElevation(latitude, longitude) {
	var url = MAPQUEST_ELEVATION_API + latitude + ',' + longitude;
	$.ajax({
		url: url,
		dataType: 'json',
		success: function(data){
			var elevation = data.elevationProfile[0].height.toFixed(0);
			$('#obs_location-elevation').val(elevation);
			$('#avy_location-elevation').val(elevation);
		}
	});
}

/*
 * Creates a basemap gallery that contains the selectable basemaps.
 */
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
}

/*
 * Changes the visible basemap.  Uses the basemapGallery created with the 
 * createBasemapGallery function
 */
function changeBasemap(basemap) {
	basemapGallery.select(basemap);
}

/*
 * Hides the splash screen and activates the other map controls.  This is either fired
 * by the timeout (default is 5000ms) after load, or by clicking the okay button on 
 * the splash screen.
 */
function hideSplashScreen() {
	clearTimeout(infoTimeout);
	$('#infoDiv').fadeOut(1000);
	$('.esriSimpleSlider').css({
		visibility : "visible"
	});
	$('#map_zoom_slider').css({
		visibility : "visible"
	});
	$('#footerGroup').fadeIn(500);

	map.enableMapNavigation();
}



/*
 * Get the current location of the user (via GPS or other browser built-in location service
 * Only gets location if supported by the browser.  Otherwise pops up an alert error.
 * See https://developer.mozilla.org/en-US/docs/Web/API/Geolocation.getCurrentPosition
 */
function getLocation() {
	var options = {
		enableHighAccuracy: true,
		timeout: 8000,
		maximumAge: 0
	};
	
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(showCurrentLocation, locationError, options);
	} else {
		alert("Your location couldn't be determined...Either your browser doesn't support geolocation, or geolocation is disabled.  Check your browser settings to make sure location services are allowed for this site.");
	}
}


/*
 * Process error codes and return custom messages if unable to retrieve geoLocation
 */
function locationError(error) {
	switch (error.code) {
		case error.PERMISSION_DENIED || error.POSITION_UNAVAILABLE:
			alert("Your location couldn't be determined...Check your browser settings to make sure location services are allowed for this site.");
			break;
		case error.TIMEOUT:
			alert("Location request timed out");
			break;
		default:
			alert("Error getting location");
			break;
	}
}

/*
 * Zoom to a specified latitude and longitude and center on the point
 */
function zoomToLocation(latitude, longitude) {
	var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(longitude, latitude));
	map.centerAndZoom(pt, 14);
}

/*
 * Adds a point to the map based on the current location retrieved with the
 * function getLocation and then zooms to that point.
 */
function showCurrentLocation(location) {
	//move the graphic and reset symbol color
	var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(location.coords.longitude, location.coords.latitude));
	var graphic = new esri.Graphic(pt, symbols['new-' + currentObservationType]);
	map.graphics.show();
	zoomToLocation(location.coords.latitude, location.coords.longitude);
}


/*
 * Get latitude and longitude from a map point and return as an array
 */
function getLatLong(mapPoint) {
	var pt = esri.geometry.webMercatorToGeographic(mapPoint);
	var lt = pt.y.toFixed(6);
	var lng = pt.x.toFixed(6);
	return ([lt, lng]);
	
}

/*
 * Adds a graphic to the map by clicking.  The symbology is gotten from the symbols
 * object depending on the type of observation being added (snowpack, avalanche) and is
 * determeined from the currentObservationType global variable.  This function clears all previous
 * graphics from the default graphics layer so only the most recent click is shown.
 * Once the graphic is added, latitude, longitude and elevation are all captured and
 * the appropriate form fields are auto-populated.  Finally, the add observation and
 * switch observation type form is displayed.
 */
function addObservationByClick(e) {
	var graphic = new esri.Graphic();
	map.graphics.clear();
	map.graphics.show();
	graphic.setSymbol(symbols['new-' + currentObservationType]);
	graphic.setGeometry(e.mapPoint);
	map.graphics.add(graphic);

	// request elevation and set in form
	var coords = getLatLong(e.mapPoint);
	var latitude = coords[0];
	var longitude = coords[1];
	getElevation(latitude, longitude);
	
	//Set latitude and longitude in form fields
	$('#obs_location-latitude').val(latitude);
	$('#obs_location-longitude').val(longitude);
	$('#avy_location-latitude').val(latitude);
	$('#avy_location-longitude').val(longitude);

	activateReportToggle();
}


/*
 * This is the function to call when preparing to add observations by click or geolocation.
 * This function takes two arguments.  The first is the type of observationbeing added 
 * (snowpack, avalanche) and the second is the method by which they are being added 
 * (Click, GeoLocation).  Once set, we return the user to the main map page and set the 
 * report type slider on the add point confirmation window.
 */
function addObservation(type, method) {

	currentObservationType = type;

	//Remove onclick listener for point attributes so that attributes are not displayed whil
	//adding a new point if the points overlap
	disconnectShowAttsHandles();

	// Check if point is being added by click, or by GeoLocation
	if (method === 'Click') {
		addGraphicHandle = dojo.connect(map, 'onClick', addObservationByClick);
	} else if (method === 'GeoLocation') {
		getLocation();
		activateReportToggle();
	}

	// Return to map
	$.mobile.changePage('#mapPage');
	
	// Reset select menus on the add observation page to the default "Select One" option
	$('#addAvyObSelect option')[0].selected = true;
	$('#addObSelect option')[0].selected = true;
	$('#addObSelect').selectmenu("refresh", true);
	$('#addAvyObSelect').selectmenu("refresh", true);

	//set value of slider in askFormDiv
	if (type === 'snowpack') {
		$('#changeReportSlider')[0].selectedIndex = 0;
	} else if (type = 'avalanche') {
		$('#changeReportSlider')[0].selectedIndex = 1;
	}
	$('#changeReportSlider').slider("refresh");

}



/*
 * Gets a stability test from the NWAC API given the id number of the associated
 * observation.  This function uses the esri.request and is routed through the
 * proxy server since the NWAC api does not support CORS
 */
function getStabilityTest(id) {
	var request = esri.request({
		url : NWAC_STABILITY_API,
		content : {
			format : 'json',
			observation : id,
			time : new Date().getTime()
		},
		handleAs : "json"
	});

	request.then(function(data) {
		processStabilityTest(data);
	});
}


/*
 * Takes a successful ajax response from the getStabilityTest function and appends
 * it to the observation view after removing any previous stability tests from the
 * DOM
 */
function processStabilityTest(data) {
	$('.stability-attribute').remove();
	var html = '';
	if (data.objects) {
		$.each(data.objects, function(num, obj) {
			html += "<li class='stability-attribute' data-role='list-divider' data-theme='a'>" + 'Stability Test ' + (num + 1) + "</li>";
			html += "<li class='stability-attribute' data-role='list-divider'>Test Type</li><li class='observation-attribute stability-attribute' id='datetime'>" + obj.test_type + "</li>";
			html += "<li class='stability-attribute' data-role='list-divider'>Shear quality</li><li class='observation-attribute stability-attribute' id='datetime'>" + obj.failure_load + "</li>";
			html += "<li class='stability-attribute' data-role='list-divider'>Depth of shear</li><li class='observation-attribute stability-attribute' id='datetime'>" + obj.shear_depth + " " + obj.shear_depth_units + "</li>";
			html += "<li class='stability-attribute' data-role='list-divider'>Shear quality</li><li class='observation-attribute stability-attribute' id='datetime'>" + obj.shear_quality + "</li>";
			html += "<li class='stability-attribute' data-role='list-divider'>Test comments</li><li class='observation-attribute stability-attribute' id='datetime'>" + obj.observations_comments + "</li>";
		});
	}
	$("#obsAtts").append(html);
	$('#obsAtts').listview('refresh');
}



function changeSymbol(gr, val, id) {
	var sym = new esri.symbol.SimpleMarkerSymbol();

	if (val === 'highlight') {
		gr.setSymbol(highlighted);
	} else if (val === 'reset') {
		if (id === "obsLayer_layer") {
			sym.setColor(new dojo.Color(SNOWPACK_SYMBOL_COLOR));
			gr.setSymbol(sym);
		} else if (id === "avyObsLayer_layer") {
			sym.setColor(new dojo.Color(AVALANCHE_SYMBOL_COLOR));
			gr.setSymbol(sym);
		}
	}
	prevGraphic = gr;
	prevObsLayer = id;
}


/*
 * Takes the click attributes when an observation has been clicked on.  Stores the
 * graphic and symbology to a global variable to facilitate reseting that graphic to
 * its default later.  Changes the symbology of the clicked symbol to the highlighted
 * symbology.  Parses the attributes of the object and adds them to the DOM on the view
 * attribute page.  Does this through a recursive iteration of the graphic.attributes
 * and matching that to the element in the DOM whose id matches the key of the object.
 * Appropriate lookups are performed as needed and multiple attributes are combined into
 * a single field as appropriate.  Any empty fields ar e hidden.  Finally, if a snowpack 
 * observation, Stability tests are retrieved from the NWAC API and appended.
 */
function showAttributes(e) {
	var id = e.currentTarget.id;
	var gr = e.graphic;
	
	//some bug makes this neccessary so as not to repeat this handler??
	//NOTE: Not a bug, probably just have added multiple click-handlers.  Let's redo
	//this so the click-handler is only created upon creation of the observation layer
	//(we can turn it off and back on when need-be)
	//Why isn't the avalanche click-handler here too?'
	if (observationClickHandles['snowpack']){
		dojo.disconnect(observationClickHandles['snowpack']);
	};

	$("#observation-view-toggle").show();
	hideReportToggle();

	$('#hideobservation-view-toggleButton').on('click', function() {
		changeSymbol(gr, 'reset', id);
		$('#observation-view-toggle').hide();
	});

	//If there is currently an activeObservation (an observation that is highlighted)
	//reset it back to its default symbology
	if (activeObservation){
		activeObservation.setSymbol(activeObservationSymbol);
	}
	
	//Store the default symbology for the selected symbol before changing it
	activeObservationSymbol = gr.symbol;
	activeObservation = gr;
	
	//Highlight the symbol
	gr.setSymbol(symbols['highlight']);

	//Empty values from any previous observations
	$(".observation-attribute").empty();
	//Make sure all fields are visible
	$('#obsAtts li').each(function() {
		$(this).show();	
	});
	
	$.each(gr.attributes, recurseAttributes);
		
	function recurseAttributes(key, value) {
		if(value==null || value===false){
			return;
		}
		if (value instanceof Object) {
			$.each(value, recurseAttributes);
		} else {
			var elem = $('#' + key);
			if (elem.hasClass('observation-attribute')){
				switch(key){
					//We'll ignore these because they will be joined together with other fields later
					case 'last_name': // fall through
					case 'elevation_units': // fall through
					case 'slide_width_units' : // fall through
					case 'runout_length_units' : // fall through
					case 'crown_depth_units' : // fall through
					case 'air_temp_units' : // fall through
						break;
					case "first_name" :
						elem.html(value + " " + gr.attributes.observer.last_name);
						break;
					case 'elevation':
						if (gr.attributes.elevation_units) {
							elem.html(value + " " + gr.attributes.elevation_units);
						} else {
							elem.html(value);
						}
						break;
					case 'slope_angle':
						elem.html(value + " degrees");
						break;
					case 'slide_width':
						elem.html(value + " " + gr.attributes.slide_width_units);
						break;
					case 'runout_length':
						elem.html(value + " " + gr.attributes.runout_length_units);
						break;
					case 'crown_depth':
						elem.html(value + " " + gr.attributes.crown_units);
						break;
					case 'air_temp':
						elem.html(value + " " + gr.attributes.air_temp_units);
						break;
					case 'datetime' : 
						elem.html(formatDate(new Date(value), "display"));
						break;
					case 'latitude' : // fall through
					case 'longitude' : 
						elem.html(Number(value).toFixed(6));
						break;
					case "slide_type" : 
						elem.html(slide_type_lookup[value]);
						break;
					case "cause" : 
						elem.html(avalanche_cause_lookup[value]);
						break;
					case "bed_surface" :
						elem.html(bed_surface_lookup[value]);
						break;
					case "avalanche_side_destructive_force" :
						elem.html(destructive_force_lookup[value]);
						break;
					case "avalanche_size_relative" :
						elem.html(relative_size_lookup[value]);
						break;
					case "rapid_warming" :
						elem.html(true_false_lookup[value]);
						break;
					case "recent_avalanches" :
						elem.html(true_false_lookup[value]);
						break;
					case "recent_loading" :
						elem.html(true_false_lookup[value]);
						break;
					case "shooting_cracks" :
						elem.html(true_false_lookup[value]);
						break;
					case "signs_of_collapse" :
						elem.html(true_false_lookup[value]);
						break;
					case "terrain_traps" :
						elem.html(true_false_lookup[value]);
						break;
					case "weather_comments" :
						elem.html(replaceURL(value));
						break;
					case "snowpack_comments" :
						elem.html(replaceURL(value));
						break;
					case "observation_comments" :
						elem.html(replaceURL(value));
						break;
					case "snowpit_profile_image_url" :
						elem.html(replaceURL(value));
						break;
					default :
						elem.html(value);
						break;
				}
			}
		}
	}
	
	//For snowpack observation layers, get any associated stability tests
	//The stability tests will be appended to the observation page asyncronously 
	//upon completion of the getStabilityTest ajax request
	if (id === 'snowpack_layer') {
		getStabilityTest(gr.attributes.id);
	}
	
	//Hide empty fields and their list-divider element from being displayed
	$('.observation-attribute').each(function() {
		if ($(this).html().trim() == '') {
			$(this).prev().hide();
			$(this).hide();
		}		
	});
	
	//Prepare the observation page for viewing
	//Page won't be viewed until the "view" button is pushed on the observation-view-toggle widget
	$('#obsAtts').trigger('create');
	$('#obsAttsPage').page();

}

/*
 * takes an html link adn returns an <a> element for that link.
 * Can be used to make html links in the attributes of an ajax request clickable.
 * Defaults to opening html links in a blank window
 */
function replaceURL(val) {
	var exp = /(\b(https?|http|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
	return val.replace(exp, "<a href='$1' target='_blank'>$1</a>");
}


/*
 * Turns on the add-report-toggle.  This allows the user to switch between avalanche and
 * snowpack reports.  Pressing the add button will set the current date in the avalance/snowpack
 * date field and open up the report form.  Pressing no will cancel the reporting process and
 * return the highlighted graphic back to its default symbology
 */
function activateReportToggle() {
	//Disconnect addGraphicHandle after we show the form.  If they'd like to add another point, they will have to select it again
	dojo.disconnect(addGraphicHandle);
	
	//show add report toggle
	$('#add-report-toggle').show();
	
	//hide the observation-view-toggle div
	$('#observation-view-toggle').hide();

	//set slider switch
	$('#add-report-toggleButton').on('click', function() {
		if ($('#changeReportSlider').val() === 'snowpack') {
			$.mobile.changePage('#obsReport');
			if ($('#obs_Date').val()) {
				setDate('#obs_Date');
			}
		} else {
			$.mobile.changePage('#avyReport');
			if ($('#avy_Date').val()) {
				setDate('#avy_Date');
			}
		}
	});

	//If there is currently an activeObservation (an observation that is highlighted)
	//reset it back to its default symbology
	if (activeObservation){
		activeObservation.setSymbol(activeObservationSymbol);
	}
}


/*
 * Hides the add-report-toggle div, hides any map graphics not part of the observation
 * or avalanche graphics layer (i.e. hides any new observation being created) and
 * turns back on the onClick handlers for the snowpack and avalanche observation layers
 */
function hideReportToggle() {
	$('#add-report-toggle').hide();
	map.graphics.hide();
	updateGraphicHandles();
}

function disconnectShowAttsHandles() {
	observationClickHandles['snowpack'] ? dojo.disconnect(observationClickHandles['snowpack']) : null;
	observationClickHandles['avalanche'] ? dojo.disconnect(observationClickHandles['avalanche']) : null;
}

function updateGraphicHandles() {
	!map.getLayer('snowpack') ? null : observationClickHandles['snowpack'] = dojo.connect(map.getLayer('snowpack'), "onClick", showAttributes);
	!map.getLayer('avalanche') ? null : observationClickHandles['avalanche'] = dojo.connect(map.getLayer('avalanche'), "onClick", showAttributes);
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

function showCalendar (el) {
	$thisCalendar = $(el).attr('id');
	$('#'+$thisCalendar+'Date').datebox('open');
}


function init() {
	var SR = new esri.SpatialReference({wkid : 102100});
	var bookmarks = {};
	
	/* LOOKUPS */
	
	bookmarks['Full']				= {'extent' : new esri.geometry.Extent(-13937126, 5280024, -13154411, 6454097, SR), 'level' : 6};
	bookmarks['Olympics'] 			= {'extent' : new esri.geometry.Extent(-13851000, 6045000, -13687000, 6050000, SR), 'level' : 9};
	bookmarks['MtHood']				= {'extent' : new esri.geometry.Extent(-13592300, 5638300, -13510300, 5710600, SR), 'level' : 9};
	bookmarks['StevensPass']		= {'extent' : new esri.geometry.Extent(-13503992, 6024773, -13455073, 6098152, SR), 'level' : 10};
	bookmarks['SnoqualmiePass']		= {'extent' : new esri.geometry.Extent(-13542712, 5957299, -13493793, 6030678, SR), 'level' : 10};
	bookmarks['WhitePass']			= {'extent' : new esri.geometry.Extent(-13536249, 5830776, -13487329, 5904155, SR), 'level' : 10};
	bookmarks['WestStevensNorth']	= {'extent' : new esri.geometry.Extent(-13603953, 5988709, -13408275, 6282227, SR), 'level' : 8};
	bookmarks['WestStevensToSnoq']	= {'extent' : new esri.geometry.Extent(-13655625, 5750225, -13459946, 6043743, SR), 'level' : 9};
	bookmarks['WestStevensToWhite']	= {'extent' : new esri.geometry.Extent(-13655625, 5750225, -13459946, 6043743, SR), 'level' : 9};
	bookmarks['WestStoqToWhite']	= {'extent' : new esri.geometry.Extent(-13576436, 5955535, -13478597, 6102294, SR), 'level' : 9};
	bookmarks['WestWhiteSouth']		= {'extent' : new esri.geometry.Extent(-13674887, 5637557, -13479208, 5931075, SR), 'level' : 9};
	bookmarks['EastStevensNorth']	= {'extent' : new esri.geometry.Extent(-13497247, 5986263, -13301569, 6279781, SR), 'level' : 8};
	bookmarks['EastStevensToSnoq']	= {'extent' : new esri.geometry.Extent(-13542039, 5827732, -13346361, 6121250, SR), 'level' : 9};
	bookmarks['EastSnoqToWhite']	= {'extent' : new esri.geometry.Extent(-13537501, 5846544, -13439662, 5993303, SR), 'level' : 9};
	bookmarks['EastWhiteSouth']		= {'extent' : new esri.geometry.Extent(-13569842, 5648857, -13374163, 5942375, SR), 'level' : 9};
	
	
	
	
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

	dojo.connect(map, "onLoad", function() {
		infoTimeout = setTimeout(function() {
			// hide infoDive after 5 seconds
			hideSplashScreen();
		}, 5000);
		$.mobile.hidePageLoadingMsg();
		$('#infoDiv div:first').fadeIn(500);
	});

	RegionsBoth = new esri.layers.ArcGISTiledMapServiceLayer("http://140.160.114.190/ArcGIS/rest/services/NWAC/RegionsBoth/MapServer", {
		"opacity" : 0.55
	});

	//build query task for region
	buildRegionQuery();

	map.addLayer(RegionsBoth);

	// set date range for obs
	prevToDate = today;
	prevFromDate = formatDate(new Date(new Date(prevToDate).getTime() - 10 * DAY_IN_MILLISECONDS), 'display');
	$('#from').html('From:  ' + prevFromDate);
	$('#to').html('To:  ' + prevToDate);

	$('#fromDate').on('change', function() {
		var temp = new Date();
		var diff = parseInt(($('#fromDate').datebox('getTheDate') - temp) / (1000 * 60 * 60 * 24 ), 10);
		var diffstrt = (diff * -1) - 1;
		// If you want a minimum of 1 day between, make this -2 instead of -1

		$('#toDate').datebox({'minDays': diffstrt});
		$('#toDate').datebox('applyMinMax');
		

		var dif = Math.round(((new Date($('#fromDate').val()).getTime() - new Date($('#toDate').val()).getTime())) / DAY_IN_MILLISECONDS);
		if (dif > 0) {
			var newTo = formatDate(new Date(new Date($('#fromDate').val()).getTime() + DAY_IN_MILLISECONDS), 'display');
			$('#toDate').val(newTo);
			$('#to').html('To:  ' + $('#toDate').val());
			prevToDate = newTo;
		}
	});

	// set symbols colors
	symbols['current-location'] = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([210, 150, 50, 0.5]), 8), new dojo.Color([210, 150, 50, 0.9]));
	symbols['avalanche'] 		= new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color(AVALANCHE_SYMBOL_COLOR), 8), new dojo.Color([153, 51, 255, 0.9]));
	symbols['snowpack'] 		= new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color(SNOWPACK_SYMBOL_COLOR), 8), new dojo.Color([0, 153, 255, 0.9]));
	symbols['highlight'] 		= new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 20, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 0, 0]), 2), new dojo.Color([245, 7, 189, 0.5]));
	symbols['new-snowpack']		= new esri.symbol.SimpleMarkerSymbol().setColor(new dojo.Color(SNOWPACK_SYMBOL_COLOR));
	symbols['new-avalanche']	= new esri.symbol.SimpleMarkerSymbol().setColor(new dojo.Color(AVALANCHE_SYMBOL_COLOR));


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
	
	//Bookmark listener
	$(".bookmark").on("click", function(e) {
		var center = bookmarks[e.target.id].extent.getCenter();
		var level = bookmarks[e.target.id].level;
		map.centerAndZoom(center, level);
		$.mobile.changePage('#mapPage');
	});
	

}


function setDate(inputId) {
	$(inputId).trigger('datebox', {
		'method' : 'set',
		'value' : today,
		'date' : new Date()
	}).trigger('datebox', {
		'method' : 'doset'
	});
	if (inputId === '#avy_Date') {
		$('#avy_').html(today + '  Click to change');
	} else {
		$('#obs_').html(today + '  Click to change');
	}
}


function onDOMLoad() {
	$(document).ready(function() {
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

	// set validator defaults
	jQuery.validator.setDefaults({
		debug : true,
		success : "valid"
	});

	// make toolbars not disappear
	$(document).delegate('[data-role=page]', 'pageinit', function() {
		$.mobile.fixedtoolbar({ tapToggle: false });
	});

	$('#dateLabel').html("NWAC Mobile");

	//resize map on pagechange to mapPage - to handle error...
	$(document).delegate('#mapPage', 'pageshow', function() {
		$('circle').each(function() {
			!$(this).attr('cx') ? $(this).attr('cx', 0) : null;
			!$(this).attr('cx') ? $(this).attr('cy', 0) : null;
		});
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
		if (formName === 'stabTestForm') {
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
						complete : function(response) {
							stabFormReturn(response);
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
					submitForm(formName);
				} else {
					$.mobile.hidePageLoadingMsg();
					alert('Please fill out required fields');
				}
			} else {//avyObsForm
				if ($(this).valid()) {
					refreshUserInfo($('#id_avyObs_observer-email').val(), $('#id_avyObs_observer-first_name').val(), $('#id_avyObs_observer-last_name').val());
					submitForm(formName);
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


