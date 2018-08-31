(function(){

  // TODO update these constants once a new carto account exists
  const cartoUsername = 'ehrmanso';
  const polygonLayerUrl = 'https://mulchy.carto.com/api/v2/viz/dbd730fa-b01b-4a22-b540-c818b8537df4/viz.json';
  const torqueLayerName = 'centroids_all_2_5_2018'
  const mapBoxAccessToken = 'pk.eyJ1Ijoia2V2aW5lc29sYmVyZyIsImEiOiJjaXR1aGcwZTMwMDFsMnlxdnZocmRxdmtjIn0.1fP2qelpZyI_p6h0pzsEWg'
  const tilesUrl = `https://api.mapbox.com/styles/v1/kevinesolberg/citvsawem00312io4xsuivy4z/tiles/{z}/{x}/{y}?access_token=${mapBoxAccessToken}`;

  // Kind of a hack, the start and end dates are hard coded here instead of retrieved dynamically from the carto API. Update these if the date range changes when you find more covenants.
  const startDateString = "1911-01-01";
  const endDateString = "1956-01-01";

  /**
   * Returns an array of moments ranging from 1/1/1911 through 1/1/1956.
   */
  function dates() { 
    let startDate = moment(startDateString, "YYYY-M-DD");
    let endDate = moment(endDateString, "YYYY-M-DD").endOf("month");
  
    const allMonthsInPeriod = [];

    while (startDate.isBefore(endDate)) {
      allMonthsInPeriod.push(startDate.clone());
      startDate = startDate.add(1, "month");
    };

    return allMonthsInPeriod
  }


  /**
   * Expects a data object with a rows property.
   * Rows should be an array of objects with year, month, count properties, where count is the number of covenants created in that month
   *
   * Returns an object with string keys in the format 'YYYY-MM' and *cummulative* number of covenants as of that month as values. Fills in any missing months.
   */
  function calculateCumulativeCounts(data) {
    var counts = {}
    data.rows.forEach(function(row) {
      if (row.year && row.month) {
        yearMonthString = moment([row.year, row.month, 1]).format('YYYY-MM')
        counts[yearMonthString] = row.count
      }
    })

    total = 0
    countsAllMonths = {}

    dates().forEach(function(date) {
      var dateString = date.format('YYYY-MM');
      var newCovenantsThisMonth = counts[dateString]

      if (newCovenantsThisMonth) {
        total += newCovenantsThisMonth;
      }
      countsAllMonths[dateString] = total
    })

    return countsAllMonths
  }

  function renderCounts(year, count) {
    $('#counts .year').text(year);
    $('#counts .count').text(count);
  }

  function createCountRenderer(counts, torqueLayer) {
    torqueLayer.on('change:time', function(event) {
      var time = moment(event.time);
      var count = counts[time.format('YYYY-MM')]
      var year = time.format('YYYY')
      if (time.isValid()) {
        renderCounts(year, count)
      }
    });
  }

  /**
   * Requests count data from carto API, sets up count renderer
   */
  function onTorqueLoad(map, torqueLayer) {
    const sql = cartodb.SQL({ user: cartoUsername,
                              protocol: 'https'
                            });
    sql.execute("select date_part('year', date_rec) as year, date_part('month', date_rec) as month, count(*) from centroids_all_2_5_2018 group by year, month order by year, month")
      .done(function(data) {
        var counts = calculateCumulativeCounts(data);
        createCountRenderer(counts, torqueLayer);
      })
  }

  /**
   * Loads the torque layer data from carto and configures it's display, does not add to map
   * Returns the torque layer
   */
  function createTorqueLayer(map){
    return cartodb.createLayer(map, {
      type: "torque",
      table_name: torqueLayerName,
      user_name: cartoUsername,
      tile_style: `
/** torque visualization */

Map {
-torque-frame-count:256;
-torque-animation-duration:30;
-torque-time-attribute:"date_rec";
-torque-aggregation-function:"count(cartodb_id)";
-torque-resolution:1;
-torque-data-aggregation:cumulative;
}

#${torqueLayerName}{
  comp-op: lighter;
  marker-fill-opacity: 0.9;
  marker-line-color: #FFF;
  marker-line-width: 0;
  marker-line-opacity: 0.2;
  marker-type: ellipse;
  marker-width: 1.5;
  marker-fill: #0F3B82;
}
#${torqueLayerName}[frame-offset=1] {
 marker-width:3.5;
 marker-fill-opacity:0.45;
}
#${torqueLayerName}[frame-offset=2] {
 marker-width:5.5;
 marker-fill-opacity:0.225;
}
`}, {https:true})
  }


  /**
   * Renders a popup at a specific latlng on the map with the given data. Called on feature click
   */
  function showPopup(map, latlng, data) {
    var popup = new L.popup({
      maxWidth: 200,
      maxHeight: 300
    });

    popup.setLatLng(latlng)
    popup.setContent(`
<div>Date Executed: ${data.date_ex}</div>
<div>Grantor: ${data.grantor}</div>
<div>Grantee: ${data.grantee}</div>
<div>City: ${data.city}</div>
<div>Addition: ${data.addition}</div>
<div>Lot: ${data.lot}</div>
<div>Block: ${data.block}</div>
<div>Racial Restriction: ${data.racial_res}</div>
`)
    map.openPopup(popup);
  }

  /**
   * Enables interation on the polygon layer. Sets up event listeners for feature{Click|Over|Out}
   */
  function onPolygonLoad(map, torqueLayer, polygonLayer) {
    sublayer = polygonLayer.getSubLayer(2);
    sublayer.setInteraction(true);
    sublayer.setInteractivity('date_ex,racial_res,addition,lot,block,city,grantor,grantee');

    sublayer.on('featureOver', function(e, latlng, pos, data, layerNumber) {
      const deedDate = moment(data.date_ex).startOf('month')
      const now = moment(torqueLayer.getTime())
      if (!now.isBefore(deedDate)) {
        $("#map").css({'cursor': 'pointer'});
      }
    });

    sublayer.on('featureOut', function(e, latlng, pos, data, layerNumber) {
      $("#map").css({'cursor': 'default'});
    });

    sublayer.on('featureClick', function(e, latlng, pos, data, layerNumber) {
      const deedDate = moment(data.date_ex).startOf('month')
      const now = moment(torqueLayer.getTime())

      if (!now.isBefore(deedDate)) {
        showPopup(map, latlng, data)
      }
    });
  }

  function createPolygonLayer(map) {
    return cartodb.createLayer(map, polygonLayerUrl) 
  }

  /**
   * Creates both the torque and polygon layer. Addes them both to the passed in map.
   * Waits until both layers have finished loading, and then calls onPolygonLoad with the loaded torque layer. This enables the polygon event listeners to refer to the loaded torque layer to get the current animation time.
   */
  function createLayers(map){
    let torqueLayer = createTorqueLayer(map)
    let polygonLayer = createPolygonLayer(map)

    let loadedTorqueLayer;
    let loadedPolyLayer;

    polygonLayer.addTo(map)
      .on('done', function(layer) {
        loadedPolyLayer = layer;
        if (loadedTorqueLayer) {
          onPolygonLoad(map, loadedTorqueLayer, loadedPolyLayer)
        }
      })
      .on('error', logError);

    torqueLayer.addTo(map)
      .on('done', function(layer) {
        onTorqueLoad(map, layer)
        loadedTorqueLayer = layer
        if (loadedPolyLayer) {
          onPolygonLoad(map, loadedTorqueLayer, loadedPolyLayer)
        }
      })
      .on('error', logError);
  }

  function logError(error) {
    console.log(error)
  }

  /**
   * Loads the map, configures the map display
   */
  function main() {
    const width = $( window ).width();
    let zoom = 12
    if (width <= 400) {
      zoom = 11
    }
    const map = new L.Map('map', {
      center: [44.9457,-93.2750],
      zoom: zoom
    });

    map.scrollWheelZoom.disable()

    L.tileLayer(tilesUrl).addTo(map)

    createLayers(map)

    window.invalidateMapSize = function() {
      map.invalidateSize()
    }
  }

  $(main)
})();
