import pandas as pd
import argparse
import os

def normalizar_horarios(input_file, output_dir):
    print("Cargando el archivo Excel (esto puede tomar unos segundos)...")
    xl = pd.ExcelFile(input_file)
    
    os.makedirs(output_dir, exist_ok=True)

    # 1. Profesores
    print("Procesando Profesores...")
    df_prof = pd.read_excel(xl, sheet_name="Profesores")
    df_prof = df_prof.loc[:, ~df_prof.columns.str.contains('^Unnamed')]
    df_prof = df_prof.dropna(subset=['Nombre'])
    df_prof = df_prof[['Nombre', 'Abreviatura']].drop_duplicates().reset_index(drop=True)
    df_prof['id_profesor'] = df_prof.index + 1
    df_prof = df_prof[['id_profesor', 'Nombre', 'Abreviatura']]
    
    # 2. Clases
    print("Procesando Clases...")
    df_clases = pd.read_excel(xl, sheet_name="Clases")
    df_clases = df_clases.loc[:, ~df_clases.columns.str.contains('^Unnamed')]
    df_clases = df_clases.dropna(subset=['Nombre de la clase'])
    df_clases = df_clases[['Nombre de la clase', 'Abreviatura']].drop_duplicates().reset_index(drop=True)
    df_clases['id_clase'] = df_clases.index + 1
    df_clases = df_clases[['id_clase', 'Nombre de la clase', 'Abreviatura']]

    # 3. Asignaturas (Normalizando HTI)
    print("Procesando Asignaturas...")
    df_asig_raw = pd.read_excel(xl, sheet_name="Asignaturas")
    df_asig_raw = df_asig_raw.loc[:, ~df_asig_raw.columns.str.contains('^Unnamed')]
    df_asig_raw = df_asig_raw.dropna(subset=['Asignatura'])
    
    # Crear una lista de asignaturas base sin prefijo HTI
    df_asig_raw['Asignatura_Base'] = df_asig_raw['Asignatura'].astype(str).str.strip().str.replace(r'^HTI\s+', '', regex=True)
    df_asig_raw['Abreviatura_Base'] = df_asig_raw['Abreviatura'].astype(str).str.strip().str.replace(r'^HTI\s+', '', regex=True)
    
    df_asig = df_asig_raw[['Asignatura_Base', 'Abreviatura_Base']].drop_duplicates().reset_index(drop=True)
    df_asig = df_asig.rename(columns={'Asignatura_Base': 'Asignatura', 'Abreviatura_Base': 'Abreviatura'})
    df_asig['id_asignatura'] = df_asig.index + 1
    df_asig = df_asig[['id_asignatura', 'Asignatura', 'Abreviatura']]

    # 4. Aulas
    print("Procesando Aulas...")
    df_aulas = pd.read_excel(xl, sheet_name="Aulas")
    df_aulas = df_aulas.loc[:, ~df_aulas.columns.str.contains('^Unnamed')]
    df_aulas = df_aulas.dropna(subset=['Título'])
    df_aulas = df_aulas[['Título', 'Abreviatura']].drop_duplicates().reset_index(drop=True)
    df_aulas['id_aula'] = df_aulas.index + 1
    df_aulas = df_aulas[['id_aula', 'Título', 'Abreviatura']]

    # Exportar catálogos
    df_prof.to_csv(os.path.join(output_dir, 'profesores.csv'), index=False, encoding='utf-8-sig')
    df_clases.to_csv(os.path.join(output_dir, 'clases.csv'), index=False, encoding='utf-8-sig')
    df_asig.to_csv(os.path.join(output_dir, 'asignaturas.csv'), index=False, encoding='utf-8-sig')
    df_aulas.to_csv(os.path.join(output_dir, 'aulas.csv'), index=False, encoding='utf-8-sig')

    # Diccionarios para cruces rápidos
    dict_prof = dict(zip(df_prof['Nombre'].astype(str).str.strip(), df_prof['id_profesor']))
    dict_clase = dict(zip(df_clases['Nombre de la clase'].astype(str).str.strip(), df_clases['id_clase']))
    
    # Para asignaturas, construimos el diccionario apuntando al ID de la asignatura base
    dict_asig_abrev = dict(zip(df_asig['Abreviatura'], df_asig['id_asignatura']))
    dict_asig_nombre = dict(zip(df_asig['Asignatura'], df_asig['id_asignatura']))
    
    def get_id_asignatura(nombre_o_abrev):
        base = nombre_o_abrev.replace('HTI ', '').replace('HTI', '').strip()
        return dict_asig_abrev.get(base, dict_asig_nombre.get(base, None))

    # 5. Lecciones
    print("Procesando Lecciones...")
    df_lecc = pd.read_excel(xl, sheet_name="Lecciones")
    df_lecc = df_lecc.dropna(subset=['Profesor', 'Clase', 'Asignatura'], how='all')
    
    # Función auxiliar para arreglar el bug de Excel que convierte "3 A" a hora "03:00:00"
    def fix_clase_name(c_str):
        c_str = c_str.strip()
        time_map = {
            "01:00:00": "1 A", "03:00:00": "3 A", "05:00:00": "5 A",
            "07:00:00": "7 A", "09:00:00": "9 A", "11:00:00": "11 A"
        }
        return time_map.get(c_str, c_str)
    
    lecciones_records = []
    for idx, row in df_lecc.iterrows():
        prof_str = str(row.get('Profesor', '')).strip()
        clase_str = str(row.get('Clase', '')).strip()
        asig_str = str(row.get('Asignatura', '')).strip()
        
        if not prof_str and not clase_str and not asig_str: continue
        
        # Un registro de Lección puede tener múltiples profesores o clases separados por comas
        profesores = [p.strip() for p in prof_str.split(',')] if prof_str else ['']
        clases = [fix_clase_name(c.strip()) for c in clase_str.split(',')] if clase_str else ['']
        
        id_a = get_id_asignatura(asig_str)
        es_hti = 1 if asig_str.startswith('HTI') else 0
        
        grupo = row.get('Grupo', '')
        duracion = row.get('Duración', '')
        sesiones_semana = row.get('Sesiones/semana', '')
        
        # Producto cartesiano para normalizar a 3FN (1 registro por combinación prof-clase)
        for prof in profesores:
            for clase in clases:
                id_p = dict_prof.get(prof, None)
                id_c = dict_clase.get(clase, None)
                
                lecciones_records.append({
                    'id_profesor': id_p,
                    'id_clase': id_c,
                    'id_asignatura': id_a,
                    'es_hti': es_hti,
                    'grupo': grupo,
                    'duracion': duracion,
                    'sesiones_semana': sesiones_semana
                })
        
    df_lecciones = pd.DataFrame(lecciones_records)
    df_lecciones = df_lecciones.dropna(subset=['id_clase', 'id_asignatura'], how='all').reset_index(drop=True)
    df_lecciones['id_leccion'] = df_lecciones.index + 1
    
    # Convertir IDs a Int64 para evitar el sufijo .0
    for col in ['id_profesor', 'id_clase', 'id_asignatura', 'es_hti']:
        if col in df_lecciones.columns:
            df_lecciones[col] = df_lecciones[col].astype('Int64')
    
    cols = ['id_leccion', 'id_profesor', 'id_clase', 'id_asignatura', 'es_hti', 'grupo', 'duracion', 'sesiones_semana']
    df_lecciones = df_lecciones[[c for c in cols if c in df_lecciones.columns]]
    df_lecciones.to_csv(os.path.join(output_dir, 'lecciones.csv'), index=False, encoding='utf-8-sig')
    
    # 6. Horarios Detalle
    print("Procesando Horarios Detalle (desde hojas de asignaturas)...")
    horarios_records = []
    
    def find_id_asignatura_sheet(sheet_name):
        sn = sheet_name.strip()
        is_hti = 1 if sn.startswith('HTI') else 0
        base_name = sn.replace('HTI ', '').replace('HTI', '').strip()
        
        id_a = dict_asig_nombre.get(base_name) or dict_asig_abrev.get(base_name)
        if id_a is not None:
            return id_a, is_hti
            
        for nombre, id_a_val in dict_asig_nombre.items():
            sn_clean = base_name.rstrip('.')
            if nombre.startswith(sn_clean) or sn_clean.startswith(nombre[:20]):
                return id_a_val, is_hti
                
        return None, is_hti

    for sheet in xl.sheet_names:
        if sheet in ["Profesores libres 2", "Profesores libres", "Leyenda de profesores", "Aulas libres", 
                     "Lecciones", "Clases", "Aulas", "Asignaturas", "Profesores", "Contratos Clases", "Contrato"]:
            continue
            
        df_sheet = pd.read_excel(xl, sheet_name=sheet)
        
        is_schedule = False
        dia_col, leccion_col = None, None
        start_row = 0
        
        for i, row in df_sheet.head(5).iterrows():
            row_vals = row.astype(str).str.strip().str.lower()
            if 'día' in row_vals.values and 'lección' in row_vals.values:
                is_schedule = True
                dia_col = row_vals[row_vals == 'día'].index[0]
                leccion_col = row_vals[row_vals == 'lección'].index[0]
                start_row = i + 1
                break
                
        if not is_schedule:
            continue
            
        id_asig, es_hti = find_id_asignatura_sheet(sheet)
        
        for idx in range(start_row, len(df_sheet)):
            row = df_sheet.iloc[idx]
            dia = row[dia_col]
            leccion = row[leccion_col]
            
            if pd.isna(dia) or pd.isna(leccion):
                continue
                
            class_cols = [c for c in df_sheet.columns if c not in [dia_col, leccion_col] and c != df_sheet.columns[0]]
            for col in class_cols:
                clase_str = row[col]
                if pd.notna(clase_str) and str(clase_str).strip() != "":
                    id_clase = dict_clase.get(str(clase_str).strip(), None)
                    horarios_records.append({
                        'id_clase': id_clase,
                        'id_asignatura': id_asig,
                        'es_hti': es_hti,
                        'dia': dia,
                        'periodo': leccion
                    })

    df_horarios = pd.DataFrame(horarios_records)
    if not df_horarios.empty:
        df_horarios = df_horarios.dropna(subset=['id_clase']).reset_index(drop=True)
        # Convertir a Int64 para evitar floats
        for col in ['id_clase', 'id_asignatura', 'es_hti']:
            if col in df_horarios.columns:
                df_horarios[col] = df_horarios[col].astype('Int64')
                
        df_horarios['id_horario'] = df_horarios.index + 1
        df_horarios = df_horarios[['id_horario', 'id_clase', 'id_asignatura', 'es_hti', 'dia', 'periodo']]
        df_horarios.to_csv(os.path.join(output_dir, 'horarios_detalle.csv'), index=False, encoding='utf-8-sig')
        print(f"Total registros horarios_detalle: {len(df_horarios)}")
    else:
        print("No se encontraron registros de horarios_detalle.")
        
    print(f"Normalización completada. Archivos guardados en '{output_dir}/'")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Normalizar horario de Excel a CSV 3FN.')
    parser.add_argument('--input', type=str, default='EXPORTACION_HORARIOS_2026_1.xlsx', help='Archivo de entrada')
    parser.add_argument('--outdir', type=str, default='db_horarios', help='Directorio de salida para los CSVs')
    
    args = parser.parse_args()
    normalizar_horarios(args.input, args.outdir)
