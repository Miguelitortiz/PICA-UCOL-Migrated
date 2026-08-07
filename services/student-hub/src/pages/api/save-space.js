import fs from 'fs';
import path from 'path';

export const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, name, spaces } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const paths = [
      path.join(process.cwd(), 'services/student-hub/public/campus.geojson'),
      path.join(process.cwd(), 'services/student-hub/dist/client/campus.geojson'),
      path.join(process.cwd(), 'public/campus.geojson'),
      path.join(process.cwd(), 'dist/client/campus.geojson')
    ];

    let geojsonPathToRead = null;
    for (const p of paths) {
      if (fs.existsSync(p)) {
        geojsonPathToRead = p;
        break;
      }
    }

    if (!geojsonPathToRead) {
      return new Response(JSON.stringify({ error: 'campus.geojson not found in search paths' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const geojsonData = JSON.parse(fs.readFileSync(geojsonPathToRead, 'utf-8'));

    const feature = geojsonData.features.find(f => f.id === id || (f.properties && f.properties.id === id));
    if (!feature) {
      return new Response(JSON.stringify({ error: 'Feature not found in GeoJSON' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!feature.properties) {
      feature.properties = {};
    }

    feature.properties.name = name || "";
    feature.properties.spaces = spaces || [];

    const updatedContent = JSON.stringify(geojsonData, null, 2);
    let writtenTo = [];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        fs.writeFileSync(p, updatedContent);
        writtenTo.push(p);
      }
    }

    return new Response(JSON.stringify({ success: true, writtenTo }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error saving GeoJSON feature:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
