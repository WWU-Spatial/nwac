(function(){
	"use strict";

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
	dojo.require("esri.symbols.SimpleFillSymbol");
	dojo.require("esri.symbols.SimpleLineSymbol");
	dojo.require("esri.geometry.Polygon");
	
	//Prevents older browsers from breaking if a console.log() function is left in the code.
	if(!window.console){ window.console = {log: function(){} }; } 
	
	/**************************** CHECK FOR BROWSER SUPPORT ***************************/
	
	/*
	 * Test if the browser supports local storage and returns either true/false
	 */
	function supports_local_storage() {
		try {
			return 'localStorage' in window && window.localStorage !== null;
		} catch( e ) {
			return false;
		}
	}
	
	
	/********************************** CONSTANTS *************************************/
	var DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;
	var SNOWPACK_SYMBOL_COLOR = [0, 153, 255, 0.5];
	var AVALANCHE_SYMBOL_COLOR = [153, 51, 255, 0.5];
	
	
	/************************************* APIS ***************************************/
	
	/*
	 * Use http://www.nwac.us/api/v2/ for production
	 * Use http://dev2.nwac.us/api/v2/ for development and debugging
	 * NOTE: the nwac api does not support cross-domain requests.  For get requests
	 * you can use a jsonp callback which is supported.
	 */
	var NWAC_API = "http://dev2.nwac.us/api/v2/";
	var NWAC_SNOWPACK_API = NWAC_API + 'observation/';
	var NWAC_AVALANCHE_API = NWAC_API + 'avalancheObservation/';
	var NWAC_STABILITY_API = NWAC_API + 'stabilityTest/';
	var MAPQUEST_ELEVATION_API = 'http://open.mapquestapi.com/elevation/v1/profile?key=Fmjtd%7Cluubnu0ynl%2C8w%3Do5-9u1wgf&shapeFormat=raw&unit=f&latLngCollection=';
	
	
	/******************************** GLOBAL VARIABLES ********************************/
	var map;
	var basemaps;
	var markup;
	var fromDate, prevToDate;
	var storeUser = 'NWACMobileUserInfo';
	var useLocalStorage = supports_local_storage();
	var queryTask, query;
	var symbol;
	var initExtent;
	var basemapGallery;
	var today = new Date();
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
		"AU" : "Unknown artificial trigger",
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
		console.log(response);
		$.mobile.hidePageLoadingMsg();
		if (response.statusText === 'OK' || response.statusText === 'CREATED') {
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
	 * and adds an appropriate point to the map using the addObservationToMap function
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
		map.reorderLayer(layerName,4);
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

		var options = {
			url : form.attr('action'),
			data : {
				'location-region' : zone
			},
			type : 'POST',
			dataType: 'json',
			success : function(response) {
				if (response.errors){
					var errors = 'Please fix the following errors:\n\n';
					$.mobile.hidePageLoadingMsg();
					for (var i in response.errors){
						if (response.errors.hasOwnProperty(i)) {
							if (Object.keys(response.errors[i])[0] !== "location") {
								errors += Object.keys(response.errors[i])[0] + ": " + response.errors[i][Object.keys(response.errors[i])[0]][0] + "\n";
							}
							
						}						
					}
					alert(errors);
					
				} else {
					formResponse(response, formName);
				}
			},
			error : function(error) {	
				formFail(error);
				console.log('error', error);
			}
		};
		form.ajaxSubmit(options);
	}
	
	
	
	/*
	 * This function toggles the visibility of the observation layers.  The two possible
	 * values for layerName are "avalanche" and "snowpack". The visibility variable can
	 * be either "hide" or "show".  When the layer is turned off, it is actually removed
	 * from the map.  When it is re-enabled, it retreives the data (again) from the NWAC
	 * API.  A more ideal solution would be to hide the layer and only update the data
	 * from the server when the date variables change.
	 */
	function toggleObservationLayer(layerName, visibility) {
		$.mobile.showPageLoadingMsg();
		if (visibility === 'show') {
			getObservationsByLayer(layerName);
		} else if (visibility === 'hide') {
			if (map.getLayer(layerName)) {
				map.removeLayer(map.getLayer(layerName));
			}
		}
		
		$.mobile.hidePageLoadingMsg();
	}
	
	
	/*
	 * Makes a request to the NWAC API to get all observations (either avalanche or snowpack
	 * depending on the layerName) between dates from the date-select controls.  Because the
	 * date returned from the date selectors contains a time unit, we set the datetime to
	 * mignight the following day to be sure all requests from the last day selected are 
	 * returned.  The ESRI request function is used to make the ajax request.
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
				datetime__gte : formatDate($('#fromDate').datebox('getTheDate'), 'obs'),
				//Set hours to midnight (the next day) so that all points for that day are retreieved
				datetime__lte : formatDate(new Date(new Date($('#toDate').datebox('getTheDate')).setHours(24,0,0,0)), 'obs'),
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
	 * Elevation Profile API.  The
	 * elevation value is truncated at the decimal point and added to the elevation
	 * field in both observation forms.  The returned elevation value is in feet.
	 */
	function getElevation(latitude, longitude) {
		var url = MAPQUEST_ELEVATION_API + latitude + ',' + longitude;
		$.ajax({
			url: url,
			dataType: 'json',
			success: function(data){
				if (data.elevationProfile) {
					var elevation = data.elevationProfile[0].height.toFixed(0);
					$('#obs_location-elevation').val(elevation);
					$('#avy_location-elevation').val(elevation);
				}
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
		
		//Make sure there are no current graphics on the map
		//Does not include avalanche and snowpack layers
		map.graphics.clear();
		
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
		map.graphics.add(graphic);
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
		//Put get zone function here
		
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
		try {
			$('#addObSelect').selectmenu("refresh", true);
			$('#addAvyObSelect').selectmenu("refresh", true);
		} catch(ignore){};
		
		//set value of slider in askFormDiv
		if (type === 'snowpack') {
			$('#changeReportSlider')[0].selectedIndex = 0;
		} else if (type === 'avalanche') {
			$('#changeReportSlider')[0].selectedIndex = 1;
		}
		$('#changeReportSlider').slider("refresh");
	
	}
	
	
	
	/*
	 * Gets a stability test from the NWAC API given the id number of the associated
	 * observation.
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
	 * it to the observation view
	 */
	function processStabilityTest(data) {
		var html = '';
		if (data.objects) {
			$.each(data.objects, function(num, obj) {
				html += "<li class='stability-attribute' data-role='list-divider' data-theme='a'>" + 'Stability Test ' + (num + 1) + "</li>";
				if (obj.test_type) {html += "<li class='stability-attribute' data-role='list-divider'>Test Type</li><li class='observation-attribute stability-attribute'>" + obj.test_type + "</li>";};
				if (obj.failure_load) {html += "<li class='stability-attribute' data-role='list-divider'>Shear quality</li><li class='observation-attribute stability-attribute'>" + obj.failure_load + "</li>";};
				if (obj.shear_depth) {html += "<li class='stability-attribute' data-role='list-divider'>Depth of shear</li><li class='observation-attribute stability-attribute'>" + obj.shear_depth + " " + obj.shear_depth_units + "</li>";};
				if (obj.shear_quality) {html += "<li class='stability-attribute' data-role='list-divider'>Shear quality</li><li class='observation-attribute stability-attribute'>" + obj.shear_quality + "</li>";};
				if (obj.observations_comments) {html += "<li class='stability-attribute' data-role='list-divider'>Test comments</li><li class='observation-attribute stability-attribute'>" + obj.observations_comments + "</li>";};
			});
		}
		$("#obsAtts").append(html);
		$('#obsAtts').listview('refresh');
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
		if (observationClickHandles.snowpack){
			dojo.disconnect(observationClickHandles.snowpack);
		}
		if (observationClickHandles.avalanche){
			dojo.disconnect(observationClickHandles.avalanche);
		}
		
		
		//Remove any stability tests from previous views
		$('.stability-attribute').remove();
	
		$("#observation-view-toggle").show();
		hideReportToggle();
	
	
		//If there is currently an activeObservation (an observation that is highlighted)
		//reset it back to its default symbology
		if (activeObservation){
			activeObservation.setSymbol(activeObservationSymbol);
		}
		
		//Store the default symbology for the selected symbol before changing it
		activeObservationSymbol = gr.symbol;
		activeObservation = gr;
		
		//Highlight the symbol
		gr.setSymbol(symbols.highlight);
	
		//Empty values from any previous observations
		$(".observation-attribute").empty();
		//Make sure all fields are visible
		$('#obsAtts li').each(function() {
			$(this).show();	
		});
		
		$.each(gr.attributes, recurseAttributes);
			
		function recurseAttributes(key, value) {
			if(value===null || value===false){
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
							if (gr.attributes.location.elevation_units) {
								elem.html(value + " " + gr.attributes.location.elevation_units);
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
							elem.html(value + " " + gr.attributes.crown_depth_units);
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
						case "avalanche_size_destructive_force" :
							elem.html(destructive_force_lookup[value]);
							break;
						case "avalanche_size_relative" :
							elem.html(relative_size_lookup[value]);
							break;
						case "weak_layer" :
							elem.html(weak_layer_lookup[value]);
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
						case "snowpit_profile_image" :
							if(value){
								elem.html('<a href="' + value + '" target="_blank" >View photo in new window</a>');
							}
							break;
						case "snowpit_profile_image_url" :
							if(value){
								elem.html('<a href="' + value + '" target="_blank" >View photo in new window</a>');
							}
							break;
						case "media" :
							if (value) {
								elem.html('<a href="' + value + '" target="_blank" >View photo in new window</a>');
							}
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
			if ($(this).html().trim() === '') {
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
	 * sets the date of the input elemnt (by id) to the current date
	 * This function should go away.
	 */
	function setDate(inputId) {
		$(inputId).trigger('datebox', {
			'method' : 'set',
			'value' : formatDate(today, 'display'),
			'date' : new Date()
		}).trigger('datebox', {
			'method' : 'doset'
		});
		if (inputId === '#avy_Date') {
			$('#avy_').html(formatDate(today, 'display') + '  Click to change');
		} else {
			$('#obs_').html(formatDate(today, 'display') + '  Click to change');
		}
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
			} else {
				$.mobile.changePage('#avyReport');
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
	
	/*
	 * Turns off the onClick handlers for the snowpack and avalanche observations
	 */
	function disconnectShowAttsHandles() {
		if (observationClickHandles.snowpack) {
			dojo.disconnect(observationClickHandles.snowpack);
		}
		if (observationClickHandles.avalanche) {
			dojo.disconnect(observationClickHandles.avalanche);
		}
	}
	
	/*
	 * Turns on the onClick handlers for the snowpack and avalanche observations
	 */
	function updateGraphicHandles() {
		if (map.getLayer('snowpack')) {
			observationClickHandles.snowpack = dojo.connect(map.getLayer('snowpack'), "onClick", showAttributes);
		}
		if (map.getLayer('avalanche')) {
			observationClickHandles.avalanche = dojo.connect(map.getLayer('avalanche'), "onClick", showAttributes);
		}
	}
	
	
	/*
	 * Stores the email, first and last name of the user between browser sessions
	 * to speed the data entry process by pre-populating those fields.  The function
	 * preferably stores the data in local storage when supported, otherwise the data
	 * will be stored in a cookie
	 */
	function refreshUserInfo(email, first_name, last_name) {
		var user = {
			'email' : email,
			'first_name' : first_name,
			'last_name' : last_name
		};
		if (useLocalStorage) {
			window.localStorage.setItem(storeUser, dojo.toJson(user));
		} else {
			// number of days to persist the cookie
			var exp = 7;	
			dojo.cookie(storeUser, dojo.toJson(user), {
				expires : exp
			});
		}
	}
	
	/*
	 * Sets the first and last name as well as email address in the avalanche and
	 * observation forms.  The expected format passed to this function is JSON.
	 * This isn't really neccessary and reduces browser compatibility.  Functions
	 * should be reworked to just store these as objects.
	 */
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
	
	
	/*
	 * Using mobile frameworks that create new pages (jQuery Mobile) causes the map
	 * resize to fire when the map isn't showing.  This causes certain width/height
	 * attributes to display as NaN corrupting the map when returning to that page.
	 * To fix this, we prevent the API from autoreszing the map (see the map constructor)
	 * and handle resizing ourselves by checking to see if the map is visible.
	 */
	function resizeMap() {
		if (map && $.mobile.activePage.data('url')==='mapPage') {

			$('#mapPage').css("height", $('body').height());
			$('#map').css("height", $('body').height());
			$('#map').css("width", "auto");

			map.reposition();
			map.resize();

		}
	}

	/*
	 * Opens the calendar widget when selecting dates
	 */
	function showCalendar (el) {
		var $thisCalendar = $(el).attr('id');
		$('#'+$thisCalendar+'Date').datebox('open');
	}
	
	
	/*
	 * Inits the mapping capability
	 * Defines some constants, such as bookmarks and symbols
	 * Sets default esri values
	 * Loads the map object with map properties and disables navigation until splash screen dissapears
	 * Adds the basemaps
	 * Prepares the query to determine the clicked region
	 * Prepares the calendar widgets on the options pages
	 * Loads user data from LocalStorage or a cookie
	 */
	function init() {
		var SR = new esri.SpatialReference({wkid : 102100});
		var bookmarks = {};
		
		// Bookmarks
		bookmarks.Full				= {'extent' : new esri.geometry.Extent(-13937126, 5280024, -13154411, 6454097, SR), 'level' : 6};
		bookmarks.Olympics			= {'extent' : new esri.geometry.Extent(-13851000, 6045000, -13687000, 6050000, SR), 'level' : 9};
		bookmarks.MtHood			= {'extent' : new esri.geometry.Extent(-13592300, 5638300, -13510300, 5710600, SR), 'level' : 9};
		bookmarks.StevensPass		= {'extent' : new esri.geometry.Extent(-13503992, 6024773, -13455073, 6098152, SR), 'level' : 10};
		bookmarks.SnoqualmiePass	= {'extent' : new esri.geometry.Extent(-13542712, 5957299, -13493793, 6030678, SR), 'level' : 10};
		bookmarks.WhitePass			= {'extent' : new esri.geometry.Extent(-13536249, 5830776, -13487329, 5904155, SR), 'level' : 10};
		bookmarks.WestStevensNorth	= {'extent' : new esri.geometry.Extent(-13603953, 5988709, -13408275, 6282227, SR), 'level' : 8};
		bookmarks.WestStevensToSnoq	= {'extent' : new esri.geometry.Extent(-13655625, 5750225, -13459946, 6043743, SR), 'level' : 9};
		bookmarks.WestStevensToWhite= {'extent' : new esri.geometry.Extent(-13655625, 5750225, -13459946, 6043743, SR), 'level' : 9};
		bookmarks.WestStoqToWhite	= {'extent' : new esri.geometry.Extent(-13576436, 5955535, -13478597, 6102294, SR), 'level' : 9};
		bookmarks.WestWhiteSouth	= {'extent' : new esri.geometry.Extent(-13674887, 5637557, -13479208, 5931075, SR), 'level' : 9};
		bookmarks.EastStevensNorth	= {'extent' : new esri.geometry.Extent(-13497247, 5986263, -13301569, 6279781, SR), 'level' : 8};
		bookmarks.EastStevensToSnoq	= {'extent' : new esri.geometry.Extent(-13542039, 5827732, -13346361, 6121250, SR), 'level' : 9};
		bookmarks.EastSnoqToWhite	= {'extent' : new esri.geometry.Extent(-13537501, 5846544, -13439662, 5993303, SR), 'level' : 9};
		bookmarks.EastWhiteSouth	= {'extent' : new esri.geometry.Extent(-13569842, 5648857, -13374163, 5942375, SR), 'level' : 9};
		
		// Symbols
		symbols['current-location'] = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([210, 150, 50, 0.5]), 8), new dojo.Color([210, 150, 50, 0.9]));
		symbols.avalanche			= new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color(AVALANCHE_SYMBOL_COLOR), 8), new dojo.Color([153, 51, 255, 0.9]));
		symbols.snowpack			= new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color(SNOWPACK_SYMBOL_COLOR), 8), new dojo.Color([0, 153, 255, 0.9]));
		symbols.highlight			= new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 20, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 0, 0]), 2), new dojo.Color([245, 7, 189, 0.5]));
		symbols['new-snowpack']		= new esri.symbol.SimpleMarkerSymbol().setColor(new dojo.Color(SNOWPACK_SYMBOL_COLOR));
		symbols['new-avalanche']	= new esri.symbol.SimpleMarkerSymbol().setColor(new dojo.Color(AVALANCHE_SYMBOL_COLOR));
		
		//ESRI Configurations
		esri.config.defaults.map.slider = {top : "100px"};
		esriConfig.defaults.io.corsEnabledServers.push("dev2.nwac.us");
		
		
		// Create the map object
		map = new esri.Map("map", {
			extent : bookmarks.Full.extent,
			logo : false,
			wrapAround180 : true,
			fadeOnZoom : true,
			force3DTransforms : true,
			navigationMode : "css-transforms",
			autoResize: false
		});
		
		
		var timer;
	
		
		//We have overridden the default autoresize functionality of the map
		//and implemented are own that only fires when the map is visible
		dojo.connect(window, "resize", function() {
			if ($.mobile.activePage.data('url')==='mapPage') {
				//clear any existing resize timer
				clearTimeout(timer);
				//create new resize timer with delay of 500 milliseconds
				timer = setTimeout(function() { resizeMap(); }, 500);
			}
		});

	
		//add the world topomap from arcgis online
		var basemap = new esri.layers.ArcGISTiledMapServiceLayer("http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer");
		map.addLayer(basemap);
	
		// Create basemap gallery to facilitate changing basemaps
		createBasemapGallery();
	
		// On the map load, hide the splash screen after 5 seconds and
		// fade in the controls toolbar
		dojo.connect(map, "onLoad", function() {
			$.mobile.hidePageLoadingMsg();
			$('#infoDiv div:first').fadeIn(500);
		});
		
		//Download the region outline from geometry and add as a new graphics layer
		$.getJSON('regions.json', function(data){
			var regions = new esri.layers.GraphicsLayer({"id" : "regions", "opacity": 0.3});
			var regionsThin = new esri.layers.GraphicsLayer({"id" : "regionsThin", "opacity": 0.2});
			
			var regionSymbol = 	new esri.symbol.SimpleFillSymbol({"outline":{"color":[130,130,130,255],"width":3,"type":"esriSLS","style":"esriSLSolid"}, "type":"esriSFS","style":"esriSFSNull"});
			var regionThinSymbol = new esri.symbol.SimpleFillSymbol({"outline":{"color":[78,78,78,255],"width":0.3,"type":"esriSLS","style":"esriSLSolid"}, "color":[255,255,255,1],"type":"esriSFS","style":"esriSFSSolid"});
			
			for (var i=0; i < data.features.length; i++) {
				var polygon = new esri.geometry.Polygon({"rings":
		            [
		            	data.features[i].geometry.coordinates[0]
		            ],
		            "spatialReference":{"wkid":102100}
		          });
		          
				regions.add(new esri.Graphic(polygon, regionSymbol));
				regionsThin.add(new esri.Graphic(polygon, regionThinSymbol, data.features[i].properties));
			
			}
			
			//Change thickness of region outline at different zoom levels
			dojo.connect(map, "onZoomEnd", function(extent, zoomFactor, anchor, level) {
				var zoom_levels = [0.5,0.75,1,1.5,2,3,4,5,8,15,30,72,100,220,450,500,550,700,800];
				for (var i=0; i<regions.graphics.length; i++) {
					regions.graphics[i].setSymbol(new esri.symbol.SimpleFillSymbol({"outline":{"color":[130,130,130,255],"width":zoom_levels[level],"type":"esriSLS","style":"esriSLSolid"},"type":"esriSFS","style":"esriSFSNull"}));
					regionsThin.graphics[i].setSymbol(new esri.symbol.SimpleFillSymbol({"outline":{"color":[78,78,78,255],"width":(zoom_levels[level] / 10),"type":"esriSLS","style":"esriSLSolid"}, "color":[255,255,255,1],"type":"esriSFS","style":"esriSFSSolid"}));
				}
			});
			
			dojo.connect(regionsThin, "onClick", function(e) {
				if (e.graphic.attributes.region_num) {
					zone = e.graphic.attributes.region_num;
				} else {
					zone = 1;
				}
			});
				
			map.addLayer(regions);
			map.addLayer(regionsThin);
			
			
		});

		
		// set date range for obs
		fromDate = new Date(today.getTime()); //Copy today's date
		fromDate.setDate(fromDate.getDate() - 10); //Subtract 10 days
		
		//Set datetime fields on the observation forms to today's date.  These fields couldn't
		//easily be validated with jQurey validate tools and would fail submission if these
		//fields weren't set
		$('#snowpack-frm-select-dateDate').val(formatDate(today));
		$('#avalanche-frm-select-dateDate').val(formatDate(today));
		$('#snowpack-frm-select-date').html(formatDate(today, 'display'));
		$('#avalanche-frm-select-date').html(formatDate(today, 'display'));
		
		//Set date selector labels
		$('#from').html('From:  ' + formatDate(fromDate, 'display'));
		$('#to').html('To:  ' + formatDate(today, 'display'));
		
	
		//Prevent the to date from being earlier than the from date
		$('#fromDate').on('change', function() {
			//We subtract one at the end to make sure at least one day is always shown.  To have a greater
			//minimum days shown, change the 1 value as appropriate
			var minDays = Math.round((today - $('#fromDate').datebox('getTheDate')) / DAY_IN_MILLISECONDS) - 1;
			$('#toDate').datebox({'minDays': minDays});
			$('#toDate').datebox('applyMinMax');
			
			//If the new from date is later than the to date, set the to date to one day ahead of the new
			//from date
			if (new Date($('#fromDate').val()) >= new Date($('#toDate').val())) {
				var toDate = new Date(new Date().setDate($('#fromDate').datebox('getTheDate').getDate() + 1));
				$('#toDate').val(formatDate(toDate, 'display'));
				$('#to').html('To:  ' + $('#toDate').val());
			}
		});
	
		//Load url parameters and set map defaults
		checkForURLParams();
		
		
		$("#options").page(); //Initialize the options page so the dateboxes are initialized and usable
		$('#fromDate').datebox('setTheDate', fromDate);
		getObservationsByLayer('snowpack');
		getObservationsByLayer('avalanche');
		
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
		
		//Change Report Type listener
		//Change the symbology of the new point if the report type toggle is changed
		//Since there should only ever be one graphic in the graphics layer on the map
		//(observations are kept in their own layer) we just modify the first graphic
		//in the graphics array
		$("#changeReportSlider").on("change", function() {
			var observationType = $("#changeReportSlider").val();
			if (observationType ==='snowpack') {
				map.graphics.graphics[0].setSymbol(symbols['new-snowpack']);
			} else if (observationType ==='avalanche') {
				map.graphics.graphics[0].setSymbol(symbols['new-avalanche']);
			}
		});
		
		//Calendar Listners
		$("#fromDate").on("change", function() {
			$('#from').html('From: ' + $(this).val());
			if (map.getLayer('snowpack')) {
				toggleObservationLayer('snowpack', 'hide');
				toggleObservationLayer('snowpack', 'show');
			}
			if (map.getLayer('avalanche')) {
				toggleObservationLayer('avalanche', 'hide');
				toggleObservationLayer('avalanche', 'show');
			}
		});
		$("#toDate").on("change", function() {
			$('#to').html('To: ' + $(this).val());
			if (map.getLayer('snowpack')) {
				toggleObservationLayer('snowpack', 'hide');
				toggleObservationLayer('snowpack', 'show');
			}
			if (map.getLayer('avalanche')) {
				toggleObservationLayer('avalanche', 'hide');
				toggleObservationLayer('avalanche', 'show');
			}
		});
		
		//Hide obseravation-view-toggleButton listner
		$('#hideobservation-view-toggleButton').on('click', function() {
			$('#observation-view-toggle').hide();
			if (activeObservation){
				activeObservation.setSymbol(activeObservationSymbol);
			}
		});
		
		//Options button listener
		$('#optionsBTN').on('click', function(){
			$.mobile.changePage('#options');
		});
		
		$('#desktop-options').on('click', function(){
			$.mobile.changePage('#options');
		});
		
		
		//Info button Listner
		$('#infoBTN').on('click', function(){
			$.mobile.changePage('#info',{
				changeHash: false
			});
		});
		
		$('#desktop-info').on('click', function(){
			$.mobile.changePage('#info',{
				changeHash: false
			});
		});
		
		
		//Okay button on the info popup listner
		$('#infoDivOKBtn').on('click', function(){
			hideSplashScreen();
		});
		
		//Open Attributes button listner
		$('#goToObsAttsButton').on('click', function(){
			$.mobile.changePage('#obsAttsPage');
		});
		
		//"add observation" confirmation no button listener
		$('#hideAskObsFormDivButton').on('click', function(){
			hideReportToggle();
		});
		
		//Add stability test yes button listner
		$('#askAddStabTestDivButton').on('click', function(){
			$.mobile.changePage('#stabTest');
		});
		
		//Add stability test no button listner
		$('#hideAskAddStabTestmDivButton').on('click', function(){
			$("#askAddStabTestDiv").hide();
		});
		
		//Return to map button listener (note this is applied to a class, not id)
		$('.backToMapButton').on('click', function(){
			$.mobile.changePage('#mapPage');
		});
		
		//Info dialog ok button listener
		$('#info-dialog-ok-btn').on('click', function(){
			$.mobile.changePage('#mapPage');
		});
		
		//Add snowpack observation select list listener
		$('#addObSelect').on('change', function(){
			addObservation('snowpack', this.value);
		});
		
		//Desktop snowpack icon on click adds observation.
		//Changes cursor and on first click resets to default cursor
		$('#snowpack-icon').on('click', function(){
			addObservation('snowpack', 'Click');
			$("#map_layers").css("cursor","crosshair");
				$("#map_layers").on('click.add', function(){
					$("#map_layers").css("cursor","default");
					$("#map_layers").off('click.add');
				});
		});
		
		//Add avalanche observation select list listener
		$('#addAvyObSelect').on('change', function(){
			addObservation('avalanche', this.value);
			
		});
		
		//Desktop avalanche icon on click adds observation.
		//Changes cursor and on first click resets to default cursor
		$('#avalanche-icon').on('click', function(){
			addObservation('avalanche', 'Click');
			$("#map_layers").css("cursor","crosshair");
			$("#map_layers").on('click.add', function(){
				$("#map_layers").css("cursor","default");
				$("#map_layers").off('click.add');
			});
		});
		
		
		//Select bookmark button listner
		$('#select-region-btn').on('click', function(){
			$.mobile.changePage('#bookmarksPage',{changeHash: false});
		});
		
		//Get current location button
		$('#get-geo-location-btn').on('click', function(){
			getLocation(); 
			$.mobile.changePage('#mapPage');
		});
		
		//Activation snowpack observation select switch listner
		$('#obsFlip').on('change', function(){
			toggleObservationLayer('snowpack', this.value);
		});
		
		//Activation avalanche observation select switch listner
		$('#avyObsFlip').on('change', function(){
			toggleObservationLayer('avalanche', this.value);
		});
		
		//Select new date on calendar listener (note this is applied to a class, not id)
		$('.calButton').on('click', function(){
			showCalendar($(this));
		});
			
		//Add an observation button listener
		$('#add-observation-btn').on('click', function(){
			$.mobile.changePage('#addObsPage',{changeHash: false});
		});
		
		//Change basemap select listner
		$('#basemapSelect').on('change', function(){
			changeBasemap(this.value);
		});
		
		//Return to map from options screen button listner
		$('#back-to-map-btn').on('click', function(){
			$.mobile.changePage('#mapPage');
		});
		
		//Avalanche form select date button listener
		$('#avalanche-frm-select-date').on('click', function(){
			showCalendar($(this));
		});
		
		//Avalanche form calendar date change listner
		$('#avalanche-frm-select-dateDate').on('change', function(){
			$('avalanche-frm-select-date').html($(this).val());
		});
		
		//Snowpack form select date button listener
		$('#snowpack-frm-select-date').on('click', function(){
			showCalendar($(this));
		});
		
		//Snowpack form calendar date change listner
		$('#snowpack-frm-select-dateDate').on('change', function(){
			$('#snowpack-frm-select-date').html($(this).val());
		});
	
		//Add Stability test form no button listner
		$('#add-stability-test-no-btn').on('click', function(){
			$('#askAddStabTestDiv').hide();
		});
		
	}
	
	
	/*
	 * Initializes the forms once the document is laoded and then runs the map init.
	 * Add's a few listeners as well.
	 */
	function onDOMLoad() {
		$(document).ready(function() {
			$.mobile.showPageLoadingMsg();
			
			
			$(document).on( "pagebeforehide", function( event ) { 
				if (event.target.id === "mapPage") {
					$('#mapPage').css("opacity", "0.01");
	
				}
			} );
			
			jQuery.validator.addMethod('integer', function(value, element, param) {
	            return (value == "" || value == parseInt(value, 10));
	        }, 'Please enter a whole number!');
	
			$( "#obsForm" ).validate({
				rules: {
					"observer-email" : {
						required: true,
						email: true,
						maxlength: 75
					},
					"observer-first_name" :{
						required: true,
						maxlength: 255
					},
					"observer-last_name" : {
						required: true,
						maxlength: 255
					},
					"location-latitude" : {
						required: true,
						number: true
					},
					"location-longitude" : {
						required: true,
						number: true
					},
					"location-slope_angle" : {
						required: false,
						integer: true
					}
						
						
				}
			});
			
			$("#avyObsForm").validate();
			$("#stabTestForm").validate();
			
			
	
			// Prevent typing in dates in the date fields.  Must use calendars
			// Not sure this code is needed, but don't feel like checking right now
			var datePickers = ['#fromDate', '#toDate', '#avy_Date', '#obs_Date'];
			dojo.forEach(datePickers, function(v) {
				$(v).keydown(function() {
					return false;
				});
			});
	
		});
	
		// set validator defaults
		jQuery.validator.setDefaults({
			success : "valid"
		});
	
		// make toolbars not disappear
		$(document).delegate('[data-role=page]', 'pageinit', function() {
			$.mobile.fixedtoolbar({ tapToggle: false });
		});
	
	
		//resize map on pagechange to mapPage - to handle error...
		$(document).delegate('#mapPage', 'pageshow', function() {
			$('#mapPage').css("opacity", "1");
			map.resize();
			map.reposition();
			/*$('circle').each(function() {
				!$(this).attr('cx') ? $(this).attr('cx', 0) : null;
				!$(this).attr('cx') ? $(this).attr('cy', 0) : null;
			});*/
		});
	
		//add event handler to your form's submit event
		$('form').bind('submit', function(e) {
			//prevent the form from submitting normally
			e.preventDefault();
	
			//set observer value from email input
			var $this = $(this);
	
			var formName = $(this).attr("name");
	
			//show the default loading message while the $.post request is sent
			//I really don't feel like parsing through this right now.  If problems
			//arise then I will do it/clean it/document it
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
								case '': //fall through
								case null:
									break;
								default:
									empty = false;
							}
						}
					});
					if (empty === false) {
						formArray.forEach(function(field) {
							if (field.name === "shear_depth") {
								//don't add the N/V pair if no field.value
								if (field.value && field.value != null) {
									data += '"' + field.name + '": ' + field.value + ',';
								}
							} else if (field.name === "shear_quality") {
								if (field.value && field.value != null) {
									data += '"' + field.name + '": ' + field.value + ',';
								}
							} else {
								if (field.value && field.value != null) {
									data += '"' + field.name + '": "' + field.value + '",';
								}
							}
						});
						data += '"observation": "/api/v2/observation/' + obsID + '/"}';
	
						$.ajax({
							url : $this.attr('action'),
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
})();

