var map;
var markers = [];

// Function called by api when data is retrieved 
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        mapTypeControl: false,
        center: {lat: 48.862725, lng: 2.287592000000018},
        zoom: 6
    });
    
    new AutocompleteDirectionsHandler(map);
}

/**
* constructor
*/
function AutocompleteDirectionsHandler(map) {
    this.map = map;
    this.originPlaceId = null;
    this.destinationPlaceId = null;
    this.travelMode = 'WALKING';
    var originInput = document.getElementById('origin-input');
    var destinationInput = document.getElementById('destination-input');
    var modeSelector = document.getElementById('mode-selector');
    this.directionsService = new google.maps.DirectionsService;
    this.directionsDisplay = new google.maps.DirectionsRenderer;
    this.directionsDisplay.setMap(map);

    var originAutocomplete = new google.maps.places.Autocomplete(originInput, {placeIdOnly: true});
    var destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, {placeIdOnly: true});

    this.setupClickListener('changemode-walking', 'WALKING');
    this.setupClickListener('changemode-transit', 'TRANSIT');
    this.setupClickListener('changemode-driving', 'DRIVING');

    this.setupPlaceChangedListener(originAutocomplete, 'ORIG');
    this.setupPlaceChangedListener(destinationAutocomplete, 'DEST');

    this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(originInput);
    this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(destinationInput);
    this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(modeSelector);
}

// Sets a listener on a radio button to change the filter type on Places
// Autocomplete.
AutocompleteDirectionsHandler.prototype.setupClickListener = function(id, mode) {
    var radioButton = document.getElementById(id);
    var me = this;
    radioButton.addEventListener('click', function() {
        me.travelMode = mode;
        me.route();
    });
};

AutocompleteDirectionsHandler.prototype.setupPlaceChangedListener = function(autocomplete, mode) {
    var me = this;
    autocomplete.bindTo('bounds', this.map);
    autocomplete.addListener('place_changed', function() {
        var place = autocomplete.getPlace();
        if (!place.place_id) {
        window.alert("Please select an option from the dropdown list.");
        return;
        }
        if (mode === 'ORIG') {
        me.originPlaceId = place.place_id;
        } else {
        me.destinationPlaceId = place.place_id;
        }
        me.route();
    });
};

// Create marker and color picto according to air quality scale of breezometer
function addMarker(latitude, longitude, airQualityScore) {
    if (airQualityScore >=  0 && airQualityScore <= 29) {
        var image = 'http://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_red.png';
    } else if (airQualityScore >= 30 && airQualityScore <= 49) {
        var image = 'http://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_yellow.png';
    }
    else if (airQualityScore >= 50 && airQualityScore <= 59) {
        var image = 'http://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_orange.png';
    }
    else if (airQualityScore >= 60 && airQualityScore <= 100) {
        var image = 'http://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_green.png';
    }

    var marker = new google.maps.Marker({
            position: {lat: latitude, lng: longitude},
            map: map,
            icon: image
    });
    markers.push(marker);
}

// Sets the map with all markers from the array.
function setMapOnAll(map) {
    for (var i = 0; i < markers.length; i++) {
        markers[i].setMap(map);
    }
}

// Show or remove marker if we change means of transport
function setMarkers() {
    setMapOnAll(map);
    setMapOnAll(null);
    markers = [];
}

AutocompleteDirectionsHandler.prototype.route = function() {
    if (!this.originPlaceId || !this.destinationPlaceId) {
        return;
    }
    var me = this;

    this.directionsService.route({
        origin: {'placeId': this.originPlaceId},
        destination: {'placeId': this.destinationPlaceId},
        travelMode: this.travelMode
    }, function(response, status) {
        if (status === 'OK') {
        me.directionsDisplay.setDirections(response);
        var distance = response.routes[0].legs[0].distance.text;
        var duration = response.routes[0].legs[0].duration.text;
        var infoPathDiv = document.getElementById('info-itinerary');
        infoPathDiv.innerHTML = "<p><b>Distance : </b>" + distance + "</p><p><b>Durée :</b> " + duration + "</p>";

        // Save latitude and longitude of random points of the path between the 2 cities
        var i = 0;
        var coordsPath = [];
        while (i < response.routes[0].overview_path.length) {
            coordsPath.push({
            'latitude': response.routes[0].overview_path[i].lat(),
            'longitude': response.routes[0].overview_path[i].lng()
            });
            i = i + 25;
        }            

    // Create city marker for the nearest city found according to previous latitude and longitude points
    //  var nearbyCities = [];
        var airQualityRoute = [];
        i = 0;
        while (i < coordsPath.length) {

        // API Call to get name of cities around the path
    /*    $.ajax({
            type: "GET",
            dataType: 'json',
            url: "http://api.geonames.org/findNearbyPlaceNameJSON?lat="+coordsPath[i].latitude+"&lng="+coordsPath[i].longitude+"&username=anicet",
            async: false,
            success: function (response) {
            nearbyCities.push(response.geonames[0].name);
            }
        });*/

            // Call to breezometer api to get air quality datas and add markers 
            $.ajax({
            type: "GET",
            dataType: 'json',
            url: "https://api.breezometer.com/baqi/?lat="+coordsPath[i].latitude+"&lon="+coordsPath[i].longitude+"&key=a176e11ad8414475986a7aa9144405fe",
            async: false,
            success: function (response) {
                airQualityRoute.push(response.breezometer_aqi);
                addMarker(coordsPath[i].latitude, coordsPath[i].longitude, response.breezometer_aqi);
            }
            });     
            i++;
        }
        
        // Calc average air quality score
        var reducer = (accumulator, currentValue) => accumulator + currentValue;
        var averageAirQualityRoute = Math.round(airQualityRoute.reduce(reducer) / airQualityRoute.length);

        // Add infos in the info-itinerary div
        infoPathDiv.innerHTML += "<p><b>Qualité moyenne de l\'air du trajet : </b>"+averageAirQualityRoute+" (breezometer scale)</p>";
        } else {
        window.alert('Directions request failed due to ' + status);
        }
    });
};