const https = require('https');
const fs = require('fs');

const query = `
[out:json][timeout:25];
// fetch area "Colima" to search
area[name="Colima"]->.searchArea;
// gather results
(
  way["building"="university"](19.208, -103.806, 19.215, -103.801);
  way["amenity"="parking"](19.208, -103.806, 19.215, -103.801);
  way["highway"="pedestrian"](19.208, -103.806, 19.215, -103.801);
);
// print results
out body;
>;
out skel qt;
`;

const options = {
  hostname: 'overpass-api.de',
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'PICA-UCOL-Agent/1.0'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    // We need to convert OSM JSON to GeoJSON. It's easier if we just use osmtogeojson, but since we don't have it,
    // let's just save the OSM JSON or we can use a service that returns GeoJSON.
    fs.writeFileSync('/tmp/osm_data.json', data);
    console.log('OSM Data downloaded successfully.');
  });
});

req.on('error', (e) => { console.error(e); });
req.write('data=' + encodeURIComponent(query));
req.end();
