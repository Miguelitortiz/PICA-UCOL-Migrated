import { fetchFromService } from './api-client.js';

export async function cargarDelegaciones() {
  try {
    return await fetchFromService('reference', '/delegations');
  } catch (err) {
    console.error('Error loading delegations:', err);
    return [];
  }
}

export async function cargarCarreras() {
  try {
    return await fetchFromService('reference', '/careers');
  } catch (err) {
    console.error('Error loading careers:', err);
    return [];
  }
}

export async function cargarFacultades() {
  try {
    return await fetchFromService('reference', '/faculties');
  } catch (err) {
    console.error('Error loading faculties:', err);
    return [];
  }
}

export async function cargarFacultadesDeDelegacion(delegationId) {
  const faculties = await cargarFacultades();
  return faculties.filter(f => f.delegation_id === delegationId);
}

export async function cargarFacultadPorSlug(slug) {
  const faculties = await cargarFacultades();
  return faculties.find(f => f.slug === slug) || null;
}

export async function cargarCarrerasDeFacultad(faculty) {
  const allCareers = await cargarCarreras();
  const careerIds = faculty.career_ids || [];
  return allCareers.filter(c => careerIds.includes(c.id));
}

export async function cargarDelegacionPorSlug(slug) {
  const delegations = await cargarDelegaciones();
  return delegations.find(d => d.slug === slug) || null;
}

export async function cargarCarreraPorSlug(slug) {
  const careers = await cargarCarreras();
  return careers.find(c => c.slug === slug) || null;
}

export async function cargarCarrerasDeDelegacion(delegationId) {
  const careers = await cargarCarreras();
  return careers.filter(c => c.delegation_id === delegationId);
}

export async function cargarTodosLosGrupos() {
  try {
    const groups = await fetchFromService('academic', '/groups');
    const careers = await cargarCarreras();
    return groups.map(g => {
      const career = careers.find(c => c.id === g.career_id);
      return {
        ...g,
        careerName: career ? career.name : "Desconocida"
      };
    });
  } catch (err) {
    console.error('Error loading all groups:', err);
    return [];
  }
}

export async function cargarGruposDeCarrera(careerId) {
  try {
    return await fetchFromService('academic', `/groups?career_id=${careerId}`);
  } catch (err) {
    console.error(`Error loading groups for career ${careerId}:`, err);
    return [];
  }
}

export async function cargarGrupoConProfesores(g_slug) {
  try {
    const groups = await fetchFromService('academic', '/groups');
    const grp = groups.find(g => g.slug === g_slug);
    if (!grp) return null;

    const professors = await fetchFromService('professors', '/professors');
    const tutor = professors.find(p => p.id === grp.tutor_id);
    const careers = await cargarCarreras();
    const career = careers.find(c => c.id === grp.career_id);

    const groupProfs = professors
      .filter(p => p.group_assignments && p.group_assignments.some(a => a.class_group_id === grp.id))
      .map(p => {
        const assignment = p.group_assignments.find(a => a.class_group_id === grp.id);
        return {
          slug: p.slug,
          fullName: p.full_name,
          email: p.email,
          subject_taught: assignment ? assignment.subject_taught : ''
        };
      });

    return {
      id: grp.id,
      slug: grp.slug,
      name: grp.name,
      career_id: grp.career_id,
      careerName: career ? career.name : "Carrera Desconocida",
      academic_period: grp.academic_period,
      shift: grp.shift,
      semester: grp.semester || null,
      tutor_id: grp.tutor_id,
      tutor_name: tutor ? tutor.full_name : (grp.tutor_name || null),
      tutor_email: tutor ? tutor.email : null,
      tutor_slug: tutor ? tutor.slug : null,
      tutor_phone: tutor?.profile_data?.contactInfo?.phone || null,
      tutor_office: tutor?.profile_data?.contactInfo?.office || null,
      tutor_office_hours: tutor?.profile_data?.contactInfo?.officeHours || null,
      classroom: grp.classroom || null,
      classrooms_by_day: grp.classrooms_by_day || null,
      professors: groupProfs
    };
  } catch (err) {
    console.error(`Error loading group for slug "${g_slug}":`, err);
    return null;
  }
}

export async function cargarHorarioDeGrupo(groupId) {
  try {
    const allSchedules = await fetchFromService('academic', '/schedules');
    const schedules = allSchedules.filter(s => s.class_group_id === groupId);

    const professors = await fetchFromService('professors', '/professors');

    return schedules.map(s => {
      const prof = professors.find(p => p.id === s.professor_id);
      return {
        ...s,
        professor_name: prof ? prof.full_name : null,
        professor_email: prof ? prof.email : null,
        professor_slug: prof ? prof.slug : null,
        professor_phone: prof?.profile_data?.contactInfo?.phone || null,
        professor_office: prof?.profile_data?.contactInfo?.office || null,
        professor_office_hours: prof?.profile_data?.contactInfo?.officeHours || null,
        professor_image: prof?.profile_data?.image || null
      };
    });
  } catch (err) {
    console.error(`Error loading schedules for group ${groupId}:`, err);
    return [];
  }
}

export async function cargarExamenesDeGrupo(groupId) {
  try {
    const exams = await fetchFromService('academic', '/exams');
    return exams.filter(e => e.class_group_id === groupId);
  } catch (err) {
    console.error(`Error loading exams for group ${groupId}:`, err);
    return [];
  }
}

function normSubjectName(name) {
  if (!name) return '';
  return name.toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export async function cargarSyllabusPorSlug(slug, groupId = null) {
  try {
    const allSyllabus = await fetchFromService('academic', '/syllabus');
    const ss = allSyllabus.find(s => s.slug === slug);
    if (!ss) return null;

    const professors = await fetchFromService('professors', '/professors');
    let prof = professors.find(p => p.id === ss.created_by);

    if (!prof) {
      try {
        const allSchedules = await fetchFromService('academic', '/schedules');
        const normSS = normSubjectName(ss.subject_name);
        const matches = allSchedules.filter(s =>
          normSubjectName(s.subject_name) === normSS && s.professor_id
        );
        if (groupId) {
          const groupMatch = matches.find(s => s.class_group_id === groupId);
          if (groupMatch) {
            prof = professors.find(p => p.id === groupMatch.professor_id);
          }
        }
        if (!prof && matches.length > 0) {
          prof = professors.find(p => p.id === matches[0].professor_id);
        }
      } catch (_) {}
    }

    return {
      ...ss,
      creatorName: prof ? prof.full_name : null,
      creatorEmail: prof ? prof.email : null,
      creatorSlug: prof ? prof.slug : null,
      profile_data: prof ? prof.profile_data : null
    };
  } catch (err) {
    console.error(`Error loading syllabus by slug "${slug}":`, err);
    return null;
  }
}

export async function cargarSyllabusDeCarrera(careerId) {
  try {
    const allSyllabus = await fetchFromService('academic', '/syllabus');
    const syllabusList = allSyllabus.filter(s => s.career_id === careerId);

    const professors = await fetchFromService('professors', '/professors');

    return syllabusList.map(s => {
      const prof = professors.find(p => p.id === s.created_by);
      return {
        ...s,
        creatorName: prof ? prof.full_name : null
      };
    });
  } catch (err) {
    console.error(`Error loading syllabus for career ${careerId}:`, err);
    return [];
  }
}
