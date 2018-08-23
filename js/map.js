/**
 * Returns an array of moments ranging from 1/1/1911 through 1/1/1956.
 */
function dates() {
  var startDateString = "1911-01-01";
  var endDateString = "1956-01-01";
  var startDate = moment(startDateString, "YYYY-M-DD");
  var endDate = moment(endDateString, "YYYY-M-DD").endOf("month");

  var allMonthsInPeriod = [];

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
    renderCounts(year, count)
  });
}

function onTorqueLoad(map, torqueLayer) {
  const sql = cartodb.SQL({ user: 'ehrmanso' });
  sql.execute("select date_part('year', date_rec) as year, date_part('month', date_rec) as month, count(*) from centroids_all_2_5_2018 group by year, month order by year, month")
    .done(function(data) {
      var counts = calculateCumulativeCounts(data);
      createCountRenderer(counts, torqueLayer);
    })
}

function createTorqueLayer(map){
  return cartodb.createLayer(map, {
    type: "torque",
    table_name: 'centroids_all_2_5_2018',  // TODO update
    user_name: "ehrmanso",
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

#centroids_all_2_5_2018{
  comp-op: lighter;
  marker-fill-opacity: 0.9;
  marker-line-color: #FFF;
  marker-line-width: 0;
  marker-line-opacity: 0.2;
  marker-type: ellipse;
  marker-width: 1.5;
  marker-fill: #0F3B82;
}
#centroids_all_2_5_2018[frame-offset=1] {
 marker-width:3.5;
 marker-fill-opacity:0.45;
}
#centroids_all_2_5_2018[frame-offset=2] {
 marker-width:5.5;
 marker-fill-opacity:0.225;
}
`})
}


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

function createPolygonLayer(map, torqueLayer) {
  return cartodb.createLayer(map, 'https://mulchy.carto.com/api/v2/viz/dbd730fa-b01b-4a22-b540-c818b8537df4/viz.json') // TODO update
}

function createLayers(map){
  let torqueLayer = createTorqueLayer(map)
  let polygonLayer = createPolygonLayer(map, torqueLayer)

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
 * Loads the map, gets the count data, configures the map display
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

  L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png').addTo(map)

  createLayers(map, logError)

  window.invalidateMapSize = function() {
    map.invalidateSize()
  }
}

$(main)
