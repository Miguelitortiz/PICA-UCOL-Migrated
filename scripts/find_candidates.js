const fs = require('fs');
const path = require('path');

const geojsonPath = path.join(__dirname, '../services/student-hub/public/campus.geojson');
const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

// Filter features that could be classrooms (named Aulas, Talleres, or Unnamed university buildings)
const candidates = data.features.filter(f => {
  const name = f.properties.name || '';
  const building = f.properties.building || '';
  return name.includes('Aulas') || name.includes('Talleres') || name.includes('Cómputo') || (building === 'university' && !f.properties.name);
});

console.log(`Found ${candidates.length} candidate features for mapping classrooms:`);
candidates.forEach((f, idx) => {
  console.log(`Index: ${idx} | ID: ${f.id} | Name: ${f.properties.name || 'Unnamed'} | Building: ${f.properties.building}`);
});
