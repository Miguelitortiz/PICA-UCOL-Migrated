import { fetchFromService } from './api-client.js';

export async function cargarProfesores() {
  try {
    const rows = await fetchFromService('professors', '/professors');
    return rows.map(row => {
      const profile = row.profile_data || {};
      profile.id = row.id;
      profile.slug = row.slug;
      profile.fullName = row.full_name;
      profile.institutionalEmail = row.email;
      profile.delegation_id = row.delegation_id;
      
      const careerIdsFromAssignments = row.group_assignments ? row.group_assignments.map(a => a.career_id).filter(Boolean) : [];
      const combinedCareers = new Set(careerIdsFromAssignments);
      if (profile.auto_career_ids) {
        profile.auto_career_ids.forEach(cid => combinedCareers.add(cid));
      }
      profile.career_ids = Array.from(combinedCareers);
      
      return profile;
    });
  } catch (err) {
    console.error('Error loading teachers from professors-service:', err);
    return [];
  }
}

export async function cargarProfesor(slug) {
  try {
    const rows = await fetchFromService('professors', '/professors');
    const prof = rows.find(p => p.slug === slug);
    if (prof) {
      const profile = prof.profile_data || {};
      profile.id = prof.id;
      profile.slug = prof.slug;
      profile.fullName = profile.fullName || prof.full_name;
      profile.institutionalEmail = profile.institutionalEmail || prof.email;
      profile.department = profile.department || null;
      profile.admissionYear = profile.admissionYear || null;
      return profile;
    }
    return null;
  } catch (err) {
    console.error(`Error loading teacher with slug "${slug}" from professors-service:`, err);
    return null;
  }
}
