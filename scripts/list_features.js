const fs = require('fs');
const path = require('path');

const geojsonPath = path.join(__dirname, '../services/student-hub/public/campus.geojson');
const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

console.log(`Total features: ${data.features.length}`);
data.features.forEach((f, idx) => {
  console.log(`Index: ${idx} | ID: ${f.id} | Name: ${f.properties.name || 'Unnamed'} | Building: ${f.properties.building || 'N/A'} | Amenity: ${f.properties.amenity || 'N/A'}`);
});
