export interface Professor {
  id: number;
  slug: string;
  full_name: string;
  email: string;
  delegation_id?: number;
  profile_data?: any;
}

export interface ClassGroup {
  id: number;
  slug: string;
  career_id?: number;
  name: string;
  academic_period: string;
  shift: string;
  tutor_id?: number;
  semester: number;
  group_letter: string;
}

export interface Schedule {
  id: number;
  class_group_id: number;
  subject_name: string;
  professor_id?: number;
  classroom_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  is_laboratory?: boolean;
}

export interface ExamDate {
  id: number;
  class_group_id: number;
  subject_name: string;
  exam_name: string;
  exam_date: string;
  exam_time: string;
}

export interface SubjectSyllabus {
  id: number;
  slug: string;
  subject_name: string;
  career_id?: number;
  program_description?: string;
  evaluation_criteria?: any;
  resources?: any;
  created_by?: number;
}

export type AdminRole = 'Jefe de Carrera' | 'Coordinador de Facultad' | 'Administrador de Dirección' | 'Administrador General';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: AdminRole;
  professor_id?: number;
  career_id?: number;
  faculty_id?: number;
  faculty_ids?: number[];
  is_active: boolean;
}
