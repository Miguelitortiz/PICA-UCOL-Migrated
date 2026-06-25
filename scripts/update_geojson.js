const fs = require('fs');
const path = require('path');

const geojsonPath = path.join(__dirname, '../services/student-hub/public/campus.geojson');
const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

// Mapping from OSM way ID to the new name of the classroom/lab
const mapping = {
  'way/1154065675': 'Aula 1',
  'way/1154065676': 'Aula 2',
  'way/1154065677': 'Aula 3',
  'way/1154065679': 'Aula 4',
  'way/1154065680': 'Aula 5',
  'way/1154065681': 'Aula 6',
  'way/1154065678': 'Aula 7',
  'way/1154065683': 'Aula 8',
  'way/1157965063': 'Aula 9',
  'way/1157965064': 'Aula 10',
  'way/1154065682': 'Laboratorio de Cómputo',
  'way/1157965065': 'Laboratorio de Electrónica'
};

let renamedCount = 0;
data.features.forEach(f => {
  if (mapping[f.id]) {
    const oldName = f.properties.name || 'Unnamed';
    f.properties.name = mapping[f.id];
    console.log(`Renamed ${f.id}: "${oldName}" -> "${f.properties.name}"`);
    renamedCount++;
  }
});

if (renamedCount > 0) {
  fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Successfully updated ${renamedCount} features in campus.geojson.`);
} else {
  console.log('No features were renamed. Check if OSM IDs match.');
}
