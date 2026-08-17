"""
auditoria_importacion.py
========================
Auditoría exhaustiva de la importación desde EXPORTACION_HORARIOS_2026_1.xlsx
hacia los CSVs en db_horarios/.

Detecta:
  1. Profesores que aparecen en el Excel pero NO en profesores.csv
  2. Clases/grupos del Excel que NO aparecen en clases.csv
  3. Lecciones con id_profesor NULL (profesor no resuelto)
  4. Lecciones con id_asignatura NULL (asignatura no resuelta)
  5. Lecciones con id_clase NULL (clase no resuelta)
  6. Asignaturas duplicadas o con nombres inconsistentes (ej. variantes HTI)
  7. Filas de la hoja Lecciones del Excel que el scrapper no procesó
  8. Registros en horarios_detalle con id_asignatura NULL
  9. Abreviaturas duplicadas en asignaturas
 10. Nombres de profesor con espacios dobles / discrepancias de normalización
"""

import pandas as pd
import re
import os
import sys

EXCEL_PATH = 'EXPORTACION_HORARIOS_2026_1.xlsx'
CSV_DIR = 'db_horarios'

SEP = "=" * 70

def h(title):
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)

def warn(msg):
    print(f"  ⚠️  {msg}")

def ok(msg):
    print(f"  ✅  {msg}")

def info(msg):
    print(f"  ℹ️  {msg}")

# ─────────────────────────────────────────────────────────
# Cargar CSVs generados
# ─────────────────────────────────────────────────────────
def load_csv(name):
    path = os.path.join(CSV_DIR, name)
    if not os.path.exists(path):
        print(f"  ❌ No existe {path}")
        return pd.DataFrame()
    return pd.read_csv(path, encoding='utf-8-sig', dtype=str)

# ─────────────────────────────────────────────────────────
# Normalización
# ─────────────────────────────────────────────────────────
def norm(s):
    """Normaliza cadena: minúsculas, sin acentos, sin espacios múltiples."""
    import unicodedata
    s = str(s).strip()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'\s+', ' ', s)
    return s.lower()

def clean_spaces(s):
    """Devuelve la cadena con espacios internos normalizados."""
    return re.sub(r'\s+', ' ', str(s).strip())

def hti_base(s):
    """Quita el prefijo HTI / HTI  de una asignatura."""
    return re.sub(r'^HTI\s+', '', str(s).strip())

# ─────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────
def main():
    print("\n🔍 AUDITORÍA DE IMPORTACIÓN — PICA-UCOL 2026-1")
    print(f"   Excel fuente : {EXCEL_PATH}")
    print(f"   CSV destino  : {CSV_DIR}/\n")

    if not os.path.exists(EXCEL_PATH):
        print(f"❌ No se encontró {EXCEL_PATH}. Ejecuta desde la raíz del proyecto.")
        sys.exit(1)

    print("📂 Cargando Excel (puede tardar ~30 s)...")
    xl = pd.ExcelFile(EXCEL_PATH)
    print(f"   Hojas disponibles: {xl.sheet_names}\n")

    # ── Cargar CSVs ──────────────────────────────────────
    df_prof_csv   = load_csv('profesores.csv')
    df_clases_csv = load_csv('clases.csv')
    df_asig_csv   = load_csv('asignaturas.csv')
    df_lecc_csv   = load_csv('lecciones.csv')
    df_hora_csv   = load_csv('horarios_detalle.csv')

    # ─────────────────────────────────────────────────────
    # 0. Resumen de volumetría
    # ─────────────────────────────────────────────────────
    h("0. VOLUMETRÍA DE CSVs GENERADOS")
    for name, df in [('profesores.csv', df_prof_csv), ('clases.csv', df_clases_csv),
                     ('asignaturas.csv', df_asig_csv), ('lecciones.csv', df_lecc_csv),
                     ('horarios_detalle.csv', df_hora_csv)]:
        info(f"{name}: {len(df)} filas")

    # ─────────────────────────────────────────────────────
    # 1. Profesores del Excel vs CSV
    # ─────────────────────────────────────────────────────
    h("1. PROFESORES: Excel vs profesores.csv")
    df_prof_xl = pd.read_excel(xl, sheet_name="Profesores")
    df_prof_xl = df_prof_xl.loc[:, ~df_prof_xl.columns.str.contains('^Unnamed')]
    df_prof_xl = df_prof_xl.dropna(subset=['Nombre'])
    
    def norm_name(s):
        return re.sub(r'\s+', ' ', str(s).strip())

    excel_profs     = set(df_prof_xl['Nombre'].apply(norm_name).unique())
    csv_profs       = set(df_prof_csv['Nombre'].apply(norm_name).unique()) if not df_prof_csv.empty else set()
    # Para el reporte de "extras", comparar por nombre normalizado
    csv_profs_raw   = set(df_prof_csv['Nombre'].astype(str).str.strip().unique()) if not df_prof_csv.empty else set()

    missing_in_csv = excel_profs - csv_profs
    extra_in_csv   = csv_profs - excel_profs


    if missing_in_csv:
        warn(f"{len(missing_in_csv)} profesores del Excel NO están en profesores.csv:")
        for p in sorted(missing_in_csv):
            print(f"       • {repr(p)}")
    else:
        ok("Todos los profesores del Excel están en profesores.csv")

    if extra_in_csv:
        warn(f"{len(extra_in_csv)} registros en profesores.csv NO aparecen en el Excel:")
        for p in sorted(extra_in_csv):
            print(f"       • {repr(p)}")

    # Detectar nombres con doble espacio en el Excel
    doble_espacio = [n for n in excel_profs if '  ' in n]
    if doble_espacio:
        warn(f"{len(doble_espacio)} nombres con DOBLE ESPACIO en Excel (posible bug de scrapping):")
        for p in sorted(doble_espacio):
            print(f"       • {repr(p)}")

    # ─────────────────────────────────────────────────────
    # 2. Clases/Grupos del Excel vs CSV
    # ─────────────────────────────────────────────────────
    h("2. CLASES/GRUPOS: Excel vs clases.csv")
    df_clases_xl = pd.read_excel(xl, sheet_name="Clases")
    df_clases_xl = df_clases_xl.loc[:, ~df_clases_xl.columns.str.contains('^Unnamed')]
    df_clases_xl = df_clases_xl.dropna(subset=['Nombre de la clase'])

    excel_clases = set(df_clases_xl['Nombre de la clase'].astype(str).str.strip().unique())
    csv_clases   = set(df_clases_csv['Nombre de la clase'].astype(str).str.strip().unique()) if not df_clases_csv.empty else set()

    missing_clases = excel_clases - csv_clases
    if missing_clases:
        warn(f"{len(missing_clases)} clases del Excel NO están en clases.csv:")
        for c in sorted(missing_clases):
            print(f"       • {repr(c)}")
    else:
        ok("Todas las clases del Excel están en clases.csv")

    # ─────────────────────────────────────────────────────
    # 3. Asignaturas: duplicados y variantes HTI
    # ─────────────────────────────────────────────────────
    h("3. ASIGNATURAS: duplicados, variantes HTI, abreviaturas")
    if not df_asig_csv.empty:
        # Abreviaturas duplicadas
        dup_abrev = df_asig_csv[df_asig_csv.duplicated(subset=['Abreviatura'], keep=False)]
        if not dup_abrev.empty:
            warn(f"{len(dup_abrev)} filas con ABREVIATURA DUPLICADA en asignaturas.csv:")
            print(dup_abrev[['id_asignatura', 'Asignatura', 'Abreviatura']].to_string(index=False))

        # Nombres duplicados (variantes)
        dup_nombre = df_asig_csv[df_asig_csv.duplicated(subset=['Asignatura'], keep=False)]
        if not dup_nombre.empty:
            warn(f"{len(dup_nombre)} filas con NOMBRE DUPLICADO en asignaturas.csv:")
            print(dup_nombre[['id_asignatura', 'Asignatura', 'Abreviatura']].to_string(index=False))

        # Asignaturas cuya abreviatura todavía empieza con H (potencial HTI residual)
        hti_residual = df_asig_csv[df_asig_csv['Abreviatura'].str.upper().str.startswith('H')]
        info(f"Asignaturas con abreviatura que empieza con 'H' (HTI): {len(hti_residual)}")

        # Verificar columna Abreviatura del Excel vs CSV
        df_asig_xl = pd.read_excel(xl, sheet_name="Asignaturas")
        df_asig_xl = df_asig_xl.loc[:, ~df_asig_xl.columns.str.contains('^Unnamed')]
        df_asig_xl = df_asig_xl.dropna(subset=['Asignatura'])
        excel_asig_names = set(df_asig_xl['Asignatura'].astype(str).str.strip().unique())
        
        # Asignaturas del Excel no normalizadas en CSV
        excel_bases = set(hti_base(a) for a in excel_asig_names)
        csv_names   = set(df_asig_csv['Asignatura'].astype(str).str.strip().unique())
        missing_asig = excel_bases - csv_names
        if missing_asig:
            warn(f"{len(missing_asig)} asignaturas del Excel NO representadas en asignaturas.csv:")
            for a in sorted(missing_asig):
                print(f"       • {repr(a)}")
        else:
            ok("Todas las asignaturas del Excel están representadas en asignaturas.csv")

    # ─────────────────────────────────────────────────────
    # 4. Lecciones: NULLs
    # ─────────────────────────────────────────────────────
    h("4. LECCIONES: valores NULL/vacíos")
    if not df_lecc_csv.empty:
        total = len(df_lecc_csv)
        
        null_prof = df_lecc_csv['id_profesor'].isna() | (df_lecc_csv['id_profesor'].str.strip() == '')
        null_clase = df_lecc_csv['id_clase'].isna()   | (df_lecc_csv['id_clase'].str.strip() == '')
        null_asig  = df_lecc_csv['id_asignatura'].isna() | (df_lecc_csv['id_asignatura'].str.strip() == '')

        pct_prof  = null_prof.sum()  / total * 100
        pct_clase = null_clase.sum() / total * 100
        pct_asig  = null_asig.sum()  / total * 100

        info(f"Total lecciones: {total}")
        if null_prof.sum() > 0:
            warn(f"id_profesor  NULL: {null_prof.sum()} ({pct_prof:.1f}%)")
            bad_lecc = df_lecc_csv[null_prof][['id_leccion', 'id_clase', 'id_asignatura']].head(20)
            print(bad_lecc.to_string(index=False))
        else:
            ok("Sin lecciones con id_profesor NULL")

        if null_clase.sum() > 0:
            warn(f"id_clase     NULL: {null_clase.sum()} ({pct_clase:.1f}%)")
        else:
            ok("Sin lecciones con id_clase NULL")

        if null_asig.sum() > 0:
            warn(f"id_asignatura NULL: {null_asig.sum()} ({pct_asig:.1f}%)")
            bad_asig = df_lecc_csv[null_asig][['id_leccion', 'id_profesor', 'id_clase', 'id_asignatura']].head(20)
            print(bad_asig.to_string(index=False))
        else:
            ok("Sin lecciones con id_asignatura NULL")

    # ─────────────────────────────────────────────────────
    # 5. Horarios detalle: NULLs
    # ─────────────────────────────────────────────────────
    h("5. HORARIOS_DETALLE: valores NULL/vacíos")
    if not df_hora_csv.empty:
        total_h = len(df_hora_csv)
        null_asig_h = df_hora_csv['id_asignatura'].isna() | (df_hora_csv['id_asignatura'].str.strip() == '')
        null_clase_h = df_hora_csv['id_clase'].isna()      | (df_hora_csv['id_clase'].str.strip() == '')
        
        info(f"Total horarios_detalle: {total_h}")
        if null_asig_h.sum() > 0:
            warn(f"id_asignatura NULL: {null_asig_h.sum()} ({null_asig_h.sum()/total_h*100:.1f}%)")
            print(df_hora_csv[null_asig_h][['id_horario', 'id_clase', 'dia', 'periodo']].head(20).to_string(index=False))
        else:
            ok("Sin horarios con id_asignatura NULL")

        if null_clase_h.sum() > 0:
            warn(f"id_clase NULL: {null_clase_h.sum()}")
        else:
            ok("Sin horarios con id_clase NULL")

    # ─────────────────────────────────────────────────────
    # 6. Lecciones del Excel vs CSV (filas sin procesar)
    # ─────────────────────────────────────────────────────
    h("6. LECCIONES: filas del Excel vs filas en CSV")
    df_lecc_xl = pd.read_excel(xl, sheet_name="Lecciones")
    df_lecc_xl = df_lecc_xl.dropna(subset=['Profesor', 'Clase', 'Asignatura'], how='all')
    info(f"Filas en Excel hoja 'Lecciones'  : {len(df_lecc_xl)}")
    info(f"Registros en lecciones.csv        : {len(df_lecc_csv)}")
    # (pueden diferir por el producto cartesiano prof × clase)

    # ─────────────────────────────────────────────────────
    # 7. Profesores referenciados en Lecciones del Excel
    #    pero no resueltos en CSV
    # ─────────────────────────────────────────────────────
    h("7. PROFESORES no resueltos en lecciones del Excel")
    
    # Map nombre → id en CSV
    prof_name_to_id = {}
    if not df_prof_csv.empty:
        for _, row in df_prof_csv.iterrows():
            prof_name_to_id[norm(row['Nombre'])] = row['id_profesor']

    unresolved_profs = set()
    time_map = {
        "01:00:00": "1 A", "03:00:00": "3 A", "05:00:00": "5 A",
        "07:00:00": "7 A", "09:00:00": "9 A", "11:00:00": "11 A"
    }

    for _, row in df_lecc_xl.iterrows():
        prof_str = str(row.get('Profesor', '')).strip()
        if not prof_str or prof_str.lower() == 'nan':
            continue
        for p in [x.strip() for x in prof_str.split(',')]:
            if p and norm(p) not in prof_name_to_id:
                unresolved_profs.add(p)

    if unresolved_profs:
        warn(f"{len(unresolved_profs)} nombres de profesor en Excel hoja 'Lecciones' NO resueltos a ID:")
        for p in sorted(unresolved_profs):
            # Sugerir candidato cercano
            candidates = [n for n in prof_name_to_id.keys() if norm(p)[:6] in n or n[:6] in norm(p)]
            cand_str = f"  → posible: {candidates[:2]}" if candidates else ""
            print(f"       • {repr(p)}{cand_str}")
    else:
        ok("Todos los profesores de Lecciones están resueltos")

    # ─────────────────────────────────────────────────────
    # 8. Asignaturas referenciadas en Lecciones del Excel
    #    pero no resueltas en CSV
    # ─────────────────────────────────────────────────────
    h("8. ASIGNATURAS no resueltas en lecciones del Excel")

    asig_abrev_to_id = {}
    asig_name_to_id  = {}
    if not df_asig_csv.empty:
        for _, row in df_asig_csv.iterrows():
            asig_abrev_to_id[norm(row['Abreviatura'])] = row['id_asignatura']
            asig_name_to_id[norm(row['Asignatura'])]    = row['id_asignatura']

    def resolve_asig(asig_str):
        base = hti_base(asig_str)
        nb = norm(base)
        if nb in asig_name_to_id:
            return asig_name_to_id[nb]
        if nb in asig_abrev_to_id:
            return asig_abrev_to_id[nb]
        return None

    unresolved_asigs = set()
    for _, row in df_lecc_xl.iterrows():
        asig_str = str(row.get('Asignatura', '')).strip()
        if not asig_str or asig_str.lower() == 'nan':
            continue
        if resolve_asig(asig_str) is None:
            unresolved_asigs.add(asig_str)

    if unresolved_asigs:
        warn(f"{len(unresolved_asigs)} asignaturas en Excel hoja 'Lecciones' NO resueltas a ID:")
        for a in sorted(unresolved_asigs):
            print(f"       • {repr(a)}")
    else:
        ok("Todas las asignaturas de Lecciones están resueltas")

    # ─────────────────────────────────────────────────────
    # 9. Hojas de asignaturas no mapeadas a id_asignatura
    # ─────────────────────────────────────────────────────
    h("9. HOJAS DE HORARIO no mapeadas a ninguna asignatura")
    skip_sheets = {"Profesores libres 2", "Profesores libres", "Leyenda de profesores",
                   "Aulas libres", "Lecciones", "Clases", "Aulas", "Asignaturas",
                   "Profesores", "Contratos Clases", "Contrato"}

    def find_id_asignatura(sheet_name):
        sn = sheet_name.strip()
        base = re.sub(r'^HTI\s+', '', sn).strip()
        nb = norm(base)
        if nb in asig_name_to_id:  return asig_name_to_id[nb]
        if nb in asig_abrev_to_id: return asig_abrev_to_id[nb]
        # Búsqueda parcial
        for name_key, id_val in asig_name_to_id.items():
            bc = nb.rstrip('.')
            if name_key.startswith(bc) or bc.startswith(name_key[:20]):
                return id_val
        return None

    unmapped_sheets = []
    for sheet in xl.sheet_names:
        if sheet in skip_sheets:
            continue
        # Verificar si es hoja de horario (tiene columnas Día y Lección)
        df_s = pd.read_excel(xl, sheet_name=sheet, nrows=6)
        is_sched = False
        for _, r in df_s.iterrows():
            rv = r.astype(str).str.strip().str.lower()
            if 'día' in rv.values and 'lección' in rv.values:
                is_sched = True
                break
        if not is_sched:
            continue
        id_a = find_id_asignatura(sheet)
        if id_a is None:
            unmapped_sheets.append(sheet)

    if unmapped_sheets:
        warn(f"{len(unmapped_sheets)} hojas de horario NO mapeadas a ninguna asignatura:")
        for s in unmapped_sheets:
            print(f"       • {repr(s)}")
    else:
        ok("Todas las hojas de horario mapeadas correctamente")

    # ─────────────────────────────────────────────────────
    # 10. Resumen final
    # ─────────────────────────────────────────────────────
    h("10. RESUMEN FINAL")
    issues = [
        f"Profesores faltantes en CSV: {len(missing_in_csv)}",
        f"Clases faltantes en CSV: {len(missing_clases)}",
        f"Asignaturas faltantes en CSV: {len(missing_asig) if not df_asig_csv.empty else 'N/A'}",
        f"Lecciones sin id_profesor: {null_prof.sum() if not df_lecc_csv.empty else 'N/A'}",
        f"Lecciones sin id_asignatura: {null_asig.sum() if not df_lecc_csv.empty else 'N/A'}",
        f"Profesores de Lecciones no resueltos: {len(unresolved_profs)}",
        f"Asignaturas de Lecciones no resueltas: {len(unresolved_asigs)}",
        f"Hojas de horario no mapeadas: {len(unmapped_sheets)}",
    ]
    for issue in issues:
        print(f"  • {issue}")

    print(f"\n{'=' * 70}")
    print("  Auditoría completada. Revisa los ⚠️  arriba para correcciones.")
    print(f"{'=' * 70}\n")

if __name__ == '__main__':
    main()
