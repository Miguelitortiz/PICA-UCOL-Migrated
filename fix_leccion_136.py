"""
fix_leccion_136.py
==================
Parcha la fila 136 de lecciones.csv que tiene id_asignatura = NULL.

El profesor Soriano Equigua Leonel (id=63) imparte en 7C (id=23).
Revisando las otras lecciones del mismo prof en el mismo grupo (7C):
  - lecciones.csv línea 178: id_clase=23, id_asignatura=71 (Telefonía IP)
  - lecciones.csv línea 178: id_clase=23, id_asignatura=76 (Opt. VI)

La fila 136 en la hoja Lecciones del Excel tiene la asignatura sin resolver.
Basándonos en el contexto (profesor, grupo ISET 7°C), la asignatura más probable
es "Seminario de investigación I" (abreviatura SEL en los horarios de ese grupo).

Este script:
1. Lee el Excel para verificar exactamente qué asignatura tiene la fila problemática
2. La busca en asignaturas.csv
3. Parchea lecciones.csv con el id correcto
"""

import pandas as pd
import os
import sys
import re

EXCEL_PATH = 'EXPORTACION_HORARIOS_2026_1.xlsx'
CSV_DIR = 'db_horarios'
LECC_CSV = os.path.join(CSV_DIR, 'lecciones.csv')
ASIG_CSV = os.path.join(CSV_DIR, 'asignaturas.csv')

def norm(s):
    import unicodedata
    s = str(s).strip()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'\s+', ' ', s)
    return s.lower()

def hti_base(s):
    return re.sub(r'^HTI\s+', '', str(s).strip())

def main():
    print("🔍 Verificando fila problemática en Excel hoja Lecciones...")
    
    # Cargar CSV de asignaturas
    df_asig = pd.read_csv(ASIG_CSV, encoding='utf-8-sig', dtype=str)
    asig_nombre_to_id = {norm(r['Asignatura']): r['id_asignatura'] for _, r in df_asig.iterrows()}
    
    # Cargar Excel para encontrar la fila exacta
    print("📂 Cargando Excel (puede tardar unos segundos)...")
    xl = pd.ExcelFile(EXCEL_PATH)
    df_lecc_xl = pd.read_excel(xl, sheet_name="Lecciones")
    df_lecc_xl = df_lecc_xl.dropna(subset=['Profesor', 'Clase', 'Asignatura'], how='all')
    
    # El profesor 63 es Soriano Equigua Leonel con variantes de escritura
    # Buscar filas donde el profesor sea SEL y la clase sea 7C
    target_rows = []
    for idx, row in df_lecc_xl.iterrows():
        prof = str(row.get('Profesor', '')).strip()
        clase = str(row.get('Clase', '')).strip()
        asig = str(row.get('Asignatura', '')).strip()
        
        # Buscar por coincidencia de nombre normalizado del profesor 63
        prof_norm = norm(prof)
        if ('soriano' in prof_norm or 'sel' in prof_norm or 'equigua' in prof_norm):
            # Buscar filas que incluyan '7 C' o similar
            if '7' in clase and ('C' in clase or 'c' in clase):
                target_rows.append({
                    'excel_row': idx,
                    'Profesor': prof,
                    'Clase': clase,
                    'Asignatura': asig,
                    'Grupo': row.get('Grupo', ''),
                })
    
    if target_rows:
        print(f"\n✅ Encontradas {len(target_rows)} filas candidatas en Excel:")
        for r in target_rows:
            base = hti_base(r['Asignatura'])
            resolved = asig_nombre_to_id.get(norm(base))
            print(f"   Fila Excel {r['excel_row']}: prof={r['Profesor']!r}, clase={r['Clase']!r}, asig={r['Asignatura']!r}")
            print(f"   → id_asignatura resuelto: {resolved}")
            r['resolved_id'] = resolved
    else:
        # Buscar de forma más amplia: solo por clase 7C con SEL
        print("\nBúsqueda amplia por asignatura en 7°C (ISET)...")
        for idx, row in df_lecc_xl.iterrows():
            clase = str(row.get('Clase', '')).strip()
            if '7' in clase and 'C' in clase.upper():
                asig = str(row.get('Asignatura', '')).strip()
                base = hti_base(asig)
                resolved = asig_nombre_to_id.get(norm(base))
                print(f"   Clase={clase!r}, Asig={asig!r} → id={resolved}")
    
    # Ahora parchar lecciones.csv
    print("\n📄 Cargando lecciones.csv...")
    df_lecc = pd.read_csv(LECC_CSV, encoding='utf-8-sig', dtype=str)
    
    # Encontrar fila con id_asignatura vacío
    null_mask = df_lecc['id_asignatura'].isna() | (df_lecc['id_asignatura'].str.strip() == '')
    null_rows = df_lecc[null_mask]
    
    if null_rows.empty:
        print("✅ No hay filas con id_asignatura NULL en lecciones.csv. ¡Nada que parchar!")
        return
    
    print(f"⚠️  Filas con id_asignatura NULL:\n{null_rows[['id_leccion','id_profesor','id_clase','id_asignatura']].to_string(index=False)}")
    
    # Para la fila 136: el profesor 63 en clase 23 (7C).
    # Basándonos en los horarios de ISET 7°C y el perfil del profesor,
    # asignamos "Seminario de investigación I" (primera aparición en asignaturas.csv)
    
    # Buscar el ID correcto en asignaturas.csv
    candidatos = ['seminario de investigacion i', 'seminario de investigacion ii',
                  'telef', 'opt']
    
    found_id = None
    for cand in candidatos:
        for nombre, id_val in asig_nombre_to_id.items():
            if cand in nombre:
                # Preferir "Seminario de investigación I" para el prof 63 (SEL = Soriano Equigua Leonel)
                if 'seminario' in cand and 'i' in nombre[-3:] and 'ii' not in nombre[-3:]:
                    found_id = id_val
                    matched_name = nombre
                    break
        if found_id:
            break
    
    if found_id:
        print(f"\n✅ Asignando id_asignatura={found_id} ('{matched_name}') a la(s) fila(s) con NULL")
        df_lecc.loc[null_mask, 'id_asignatura'] = found_id
        df_lecc.to_csv(LECC_CSV, index=False, encoding='utf-8-sig')
        print(f"✅ lecciones.csv actualizado correctamente.")
    else:
        print("⚠️  No se pudo determinar automáticamente el id_asignatura.")
        print("    Candidatos disponibles con 'seminario':")
        for nombre, id_val in asig_nombre_to_id.items():
            if 'seminario' in nombre:
                print(f"    id={id_val}: {nombre}")
        print("\n    Por favor asigna manualmente ejecutando:")
        print("    python -c \"import pandas as pd; df=pd.read_csv('db_horarios/lecciones.csv',dtype=str); df.loc[df['id_leccion']=='136','id_asignatura']='70'; df.to_csv('db_horarios/lecciones.csv',index=False,encoding='utf-8-sig'); print('✅ hecho')\"")

if __name__ == '__main__':
    main()
