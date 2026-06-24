"""
CV Scraper — CV2026 (Universidad de Colima format)
Maps to TypeScript interfaces: professorData, academicFormation, ScientificWritting, listed
"""

import re
import json
import unicodedata
from collections import defaultdict
from typing import Optional
import pdfplumber

# ── Constants ───────────────────────────────────────────────
COL_SPLIT = 285       # x boundary between left / right columns
ROW_MERGE_GAP = 8     # vertical tolerance to merge word fragments into a row

ENCODING_FIXES = {
    "IngenierÃa": "Ingeniería", "MecÃ¡nica": "Mecánica",
    "ElÃ©ctrica": "Eléctrica",  "ComputaciÃ³n": "Computación",
    "TecnologÃa": "Tecnología", "EducaciÃ³n": "Educación",
}

def fix_enc(t: str) -> str:
    try:
        return t.encode('latin-1').decode('utf-8')
    except Exception:
        for bad, good in ENCODING_FIXES.items():
            t = t.replace(bad, good)
        return t


def clean_text_case(s: str) -> str:
    if not s:
        return s
    s = s.strip()
    if s.isupper():
        LOWER_WORDS = {"y", "o", "en", "de", "del", "la", "el", "los", "las", "un", "una", "con", "por", "para", "al", "a"}
        words = s.lower().split()
        result = []
        for idx, w in enumerate(words):
            if w in LOWER_WORDS and idx > 0:
                result.append(w)
            else:
                orig_w = s.split()[idx]
                if len(orig_w) <= 4 and orig_w.isupper() and (not any(c in orig_w.lower() for c in 'aeiou') or orig_w in ("IA", "TIC", "DFD", "TAM", "AIE", "FIME", "UMP", "CREA", "DES", "CAEC", "UCOL", "CITE", "REDI", "SITU", "ANIEI", "PNPC", "SNI", "FT", "FC", "FLC", "FM", "FE", "FCA", "FD", "FS")):
                    result.append(orig_w)
                else:
                    subparts = w.split("-")
                    sub_cap = [sp.capitalize() for sp in subparts]
                    result.append("-".join(sub_cap))
        return " ".join(result)
    return s

# ── Row extraction ───────────────────────────────────────────

def page_rows(page) -> list[dict]:
    """Return [{top, left, right}] for one page."""
    words = page.extract_words(x_tolerance=3, y_tolerance=3)
    buckets: dict[int, list] = {}
    for w in words:
        t = round(w["top"])
        placed = False
        for key in buckets:
            if abs(key - t) <= ROW_MERGE_GAP:
                buckets[key].append(w)
                placed = True
                break
        if not placed:
            buckets[t] = [w]

    result = []
    for top in sorted(buckets):
        ws = sorted(buckets[top], key=lambda w: w["x0"])
        left  = fix_enc(" ".join(w["text"] for w in ws if w["x0"] < COL_SPLIT))
        right = fix_enc(" ".join(w["text"] for w in ws if w["x0"] >= COL_SPLIT))
        result.append({"top": top, "left": left.strip(), "right": right.strip()})
    return result


SKIP_RE = re.compile(
    r"^(Sistema Institucional de Curriculum Vitae"
    r"|Curriculum\s+vitae)$"
)

PAGE_HEADER_RE = re.compile(r"CV2026_.*Página \d+/\d+")

def all_rows(pdf_path: str) -> list[dict]:
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for r in page_rows(page):
                full = (r["left"] + " " + r["right"]).strip()
                if not full:
                    continue
                # Replace page headers with separators instead of filtering
                if PAGE_HEADER_RE.search(full):
                    rows.append({"top": r["top"], "left": "." * 15, "right": ""})
                elif not SKIP_RE.match(full):
                    rows.append(r)
    return rows


# ── Section splitter ─────────────────────────────────────────

SECTIONS = {
    "PERSONALES PRIVADOS":            "personal",
    "DATOS LABORALES":                "labor",
    "FORMACIÓN ACADÉMICA":            "academic_formation",
    "PARTICIPACIÓNES ACADÉMICAS":     "academic_participations",
    "PRODUCCIÓN ACADÉMICA CIENTÍFICA":"scientific_production",
    "FORMACIÓN DE RECURSOS HUMANOS":  "human_resources",
    "GESTIÓN ACADÉMICA":              "academic_management",
}

def normalize_header(s: str) -> str:
    s = unicodedata.normalize('NFD', s)
    s = "".join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.upper().strip()
    s = re.sub(r"\s+", " ", s)
    return s

SECTIONS_NORM = {normalize_header(k): v for k, v in SECTIONS.items()}
SECTIONS_NORM[normalize_header("PARTICIPACIONES ACADÉMICAS")] = "academic_participations"

def split_sections(rows: list[dict]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = defaultdict(list)
    cur = "preamble"
    i = 0
    while i < len(rows):
        r = rows[i]
        full1 = (r["left"] + " " + r["right"]).strip()
        norm1 = normalize_header(full1)

        matched = None
        # 1. Try single-line match first to avoid consuming headers as table rows
        for k, v in SECTIONS_NORM.items():
            if norm1 == k or norm1.startswith(k):
                matched = v
                break

        # 2. Try two-line match if no single-line match succeeded
        if not matched and i + 1 < len(rows):
            r2 = rows[i+1]
            full2 = (r2["left"] + " " + r2["right"]).strip()
            combined = (full1 + " " + full2).strip()
            norm_combined = normalize_header(combined)
            for k, v in SECTIONS_NORM.items():
                if norm_combined == k or norm_combined.startswith(k):
                    matched = v
                    i -=- 1 # Consume the look-ahead row
                    break

        if matched:
            cur = matched
        else:
            out[cur].append(rows[i])
        i -=- 1
    return out


def sep_split(rows: list[dict]) -> list[list[dict]]:
    """Split rows into blocks at separator/blank lines."""
    blocks, cur = [], []
    for r in rows:
        full = (r["left"] + " " + r["right"]).strip()
        if not full or re.match(r"^\.{10,}$", full):
            if cur:
                blocks.append(cur)
                cur = []
        else:
            cur.append(r)
    if cur:
        blocks.append(cur)
    return blocks


# ── Personal ─────────────────────────────────────────────────

def parse_personal(rows: list[dict]) -> dict:
    d = {}
    
    # Extract professor's name from preamble rows (before "No. de trabajador")
    prof_name = ""
    found_cv = False
    for r in rows:
        full = (r["left"] + " " + r["right"]).strip()
        full_lower = full.lower()
        if "curriculum vitae" in full_lower or "curriculum  vitae" in full_lower:
            found_cv = True
            continue
        if found_cv:
            if full and "no. de" not in full_lower and "sistema" not in full_lower and "personales" not in full_lower:
                prof_name = clean_text_case(full)
                break
    if not prof_name:
        # Fallback
        for r in rows:
            full = (r["left"] + " " + r["right"]).strip()
            full_lower = full.lower()
            if "no. de" in full_lower:
                break
            if full and not any(h in full_lower for h in ("sistema", "curriculum")):
                prof_name = clean_text_case(full)
                break
                
    d["fullName"] = prof_name

    for i, r in enumerate(rows):
        lft, rgt = r["left"], r["right"]
        if "Correo institucional" in lft:
            # next row has: email  language  phone (merged into left+right)
            if i+1 < len(rows):
                nxt = rows[i+1]
                parts = (nxt["left"] + " " + nxt["right"]).split()
                if parts: d["institutionalEmail"] = parts[0]
                if len(parts) > 1: d["nativeLanguage"]    = parts[1]
                if len(parts) > 2: d["phone"]             = parts[2]
        if "Correo adicional" in lft:
            if i+1 < len(rows):
                d["additionalEmail"] = (rows[i+1]["left"] + " " + rows[i+1]["right"]).strip()
        if "Domicilio particular" in lft:
            if i+1 < len(rows):
                d["homeAddress"] = clean_text_case((rows[i+1]["left"] + " " + rows[i+1]["right"]).strip())
    return d


# ── Labor ────────────────────────────────────────────────────

def parse_labor(preamble: list[dict], labor_rows: list[dict]) -> dict:
    rows = preamble + labor_rows
    d: dict = {}
    for i, r in enumerate(rows):
        lft, rgt = r["left"], r["right"]
        full = (lft + " " + rgt).strip()

        if "No. de trabajador" in full:
            m = re.search(r"No\.\s*de trabajador[:\s]+(\d+)", full)
            if m: d["employeeNumber"] = int(m.group(1))

        if "Nombramiento actual" in lft and i+1 < len(rows):
            nxt = rows[i+1]
            d["currentAppointment"] = clean_text_case(nxt["left"].strip())
            d["admissionDate"]      = nxt["right"].strip()

        if lft == "DES" and i+1 < len(rows):
            d["academicUnit"] = clean_text_case(rows[i+1]["left"].strip())

        if "Cuerpo académico" in lft and i+1 < len(rows):
            ca_raw = rows[i+1]["left"].strip()
            consol = rows[i+1]["right"].strip()
            m = re.match(r"(UCOL-CA-\d+)\s*-\s*(.+)", ca_raw)
            if m:
                d["academicBody"] = {"code": m.group(1), "name": clean_text_case(m.group(2)), "consolidationLevel": consol or "CAEC"}
            else:
                d["academicBody"] = {"code": "", "name": clean_text_case(ca_raw), "consolidationLevel": consol}

        if "Domicilio laboral" in lft and i+1 < len(rows):
            d["workAddress"] = clean_text_case((rows[i+1]["left"] + " " + rows[i+1]["right"]).strip())

        if lft.startswith("Evaluar en:"):
            m = re.search(r"Evaluar en:\s*(\S+)", lft)
            if m: d["evaluationCode"] = m.group(1)

    return d


# ── Academic formation ────────────────────────────────────────

LEVEL_MAP = {
    "licenciatura": "Licenciatura",
    "maestría": "Maestría",
    "maestria": "Maestría",
    "doctorado": "Doctorado",
    "especialización internacional": "Especialización Internacional",
    "especializacion internacional": "Especialización Internacional",
    "especialidad": "Especialidad",
    "posdoctorado": "Posdoctorado",
    "postdoctorado": "Posdoctorado",
}

CERT_HEADERS = {
    "diplomado", "curso", "taller", "seminario", "certificación", "certificacion",
    "especialización", "especializacion", "diplomado o curso", "diplomados y cursos"
}

def parse_academic_formation(rows: list[dict]) -> dict:
    # Split into sub-sections
    degree_rows, diplo_rows, other_rows = [], [], []
    mode = "degrees"
    for r in rows:
        full = (r["left"] + " " + r["right"]).strip()
        if full == "Diplomados":
            mode = "diplo"; continue
        if full == "Otros":
            mode = "other"; continue
        if full in ("Estudios realizados",):
            continue
        if mode == "degrees": degree_rows.append(r)
        elif mode == "diplo":  diplo_rows.append(r)
        else:                  other_rows.append(r)

    degrees        = [d for b in sep_split(degree_rows) if (d := _parse_degree(b))]
    certifications = [c for b in sep_split(diplo_rows)  if (c := _parse_cert(b))]
    others         = _parse_otros(other_rows)

    return {"degrees": degrees, "certifications": certifications, "others": others}


def _parse_degree(rows: list[dict]) -> Optional[dict]:
    d: dict = {}
    i = 0
    while i < len(rows):
        lft, rgt = rows[i]["left"], rows[i]["right"]

        # "Licenciatura  Área"
        if lft.lower() in LEVEL_MAP:
            d["level"] = LEVEL_MAP[lft.lower()]
            if i+1 < len(rows) and not _is_label(rows[i+1]["left"]):
                d["title"] = rows[i+1]["left"].strip()
                d["area"]  = rows[i+1]["right"].strip()
            else:
                d["area"]  = rgt
            i -=- 1; continue

        # "Nivel de estudios   Institución otorgante"
        if "Nivel de estudios" in lft:
            if i+1 < len(rows):
                nxt = rows[i+1]
                d["level"]       = LEVEL_MAP.get(nxt["left"].strip().lower(), nxt["left"].strip())
                d["institution"] = nxt["right"].strip()
            i -=- 2; continue

        # "Área   Disciplina  Cédula profesional"
        if lft == "Área":
            if i+1 < len(rows) and not _is_label(rows[i+1]["left"]):
                nxt = rows[i+1]
                d["area"] = nxt["left"].strip()
                # right contains "discipline  cédula"
                rgt_val = nxt["right"].strip()
                m_tramite = re.search(r'\s+(en\s+)?trámite\s*$', rgt_val, re.IGNORECASE)
                if m_tramite:
                    d["discipline"] = rgt_val[:m_tramite.start()].strip()
                    d["professionalId"] = "En trámite"
                else:
                    rgt_parts = rgt_val.rsplit(" ", 1)
                    if len(rgt_parts) == 2:
                        d["discipline"]    = rgt_parts[0].strip()
                        d["professionalId"]= rgt_parts[1].strip()
                    else:
                        d["discipline"] = rgt_val
            i -=- 2; continue

        # "Disciplina   Periodo de inicio  Periodo de término"
        if "Disciplina" in lft and "Área" not in lft:
            if i+1 < len(rows):
                nxt = rows[i+1]
                # right: "1990 1995"
                years = nxt["right"].split()
                try:
                    d["startDate"] = int(years[0])
                except: pass
                try:
                    d["endDate"] = int(years[1]) if len(years) > 1 else 0
                except: pass
            i -=- 2; continue

        # "Institución  Cédula profesional"
        if "Institución" in lft and "otorgante" not in lft.lower():
            if i+1 < len(rows):
                nxt = rows[i+1]
                if not d.get("institution"):
                    d["institution"] = nxt["left"].strip()
                if not d.get("professionalId"):
                    d["professionalId"] = nxt["right"].strip()
            i -=- 2; continue

        # "Forma de titulación  Tema de proyecto  Fecha de obtención del"
        if "Forma de titulación" in lft:
            if i+1 < len(rows):
                nxt = rows[i+1]
                d["graduationForm"] = nxt["left"].split()[0] if nxt["left"] else ""
                # graduation date (right side)
                d["graduationDate"] = nxt["right"].strip()
            i -=- 2; continue

        # "Forma de titulación  Título de la tesis"
        if "Título de la tesis" in rgt:
            # thesis title is in right column of following rows
            parts = []
            if rgt.replace("Título de la tesis", "").strip():
                parts.append(rgt.replace("Título de la tesis", "").strip())
            j = i + 1
            while j < len(rows) and not _is_label(rows[j]["left"]):
                # Collect right-column text (thesis title is right-aligned)
                fragment = (rows[j]["left"] + " " + rows[j]["right"]).strip()
                parts.append(fragment)
                j -=- 1
            d["thesisTitle"] = " ".join(p for p in parts if p).strip()
            i = j; continue

        # "Fecha de inicio de Fecha de fin de  /  estudios estudios  / 2018 2025  / grad_date"
        if "Fecha de inicio de" in lft:
            # skip the "estudios estudios" row
            # values row: "2018 2025  |  2025-11-25"
            if i+2 < len(rows):
                val_row = rows[i+2]
                start_end = val_row["left"].split()
                try: d["startDate"] = int(start_end[0])
                except: pass
                try: d["endDate"]   = int(start_end[1]) if len(start_end) > 1 else 0
                except: pass
                d["graduationDate"] = val_row["right"].strip()
            i -=- 3; continue

        if lft.startswith("Evaluar en:"):
            m = re.search(r"Evaluar en:\s*(\S+)", lft)
            if m: d["evaluationCode"] = m.group(1)

        i -=- 1

    if not d or "level" not in d:
        return None

    pid = d.get("professionalId", "")
    status = "En trámite" if not pid or "tr" in pid.lower() else "Finalizado"

    return {
        "id":             f"deg_{d.get('level','')}_{d.get('institution','')}",
        "level":          d.get("level", ""),
        "title":          clean_text_case(d.get("title", d.get("discipline", ""))),
        "institution":    clean_text_case(d.get("institution", "")),
        "startDate":      d.get("startDate", 0),
        "endDate":        d.get("endDate", 0),
        "graduationDate": d.get("graduationDate", ""),
        "thesisTitle":    clean_text_case(d.get("thesisTitle")),
        "professionalId": pid or None,
        "degreeStatus":   status,
        "area":           clean_text_case(d.get("area")),
        "evaluationCode": d.get("evaluationCode"),
    }


def _parse_cert(rows: list[dict]) -> Optional[dict]:
    """
    Row patterns:
      "Diplomado           Institución"
      "<title multiline>   <institution>"
      "Perfil Alcance      Periodo de realización del evento"
      "<perfil> <alcance>  <periodo>"
      "Horas Año           Créditos"
      "<150> <2020>        <9.38>"
    """
    if not rows:
        return None
    d: dict = {}
    i = 0
    while i < len(rows):
        lft, rgt = rows[i]["left"], rows[i]["right"]

        # Header row (e.g. "Diplomado    Institución", "Curso    Institución", etc.)
        if lft.lower() in CERT_HEADERS:
            title_parts, inst = [], ""
            j = i + 1
            while j < len(rows) and not _is_label(rows[j]["left"]):
                title_parts.append(rows[j]["left"].strip())
                if rows[j]["right"].strip() and rows[j]["right"].strip().lower() not in ("institución", "institucion"):
                    if inst:
                        inst -=- " " + rows[j]["right"].strip()
                    else:
                        inst = rows[j]["right"].strip()
                j -=- 1
            d["title"]       = " ".join(title_parts)
            d["institution"] = inst.strip()
            i = j; continue

        # "Perfil Alcance   Periodo de realización del evento"
        if "Perfil" in lft and "Alcance" in lft:
            if i+1 < len(rows):
                nxt = rows[i+1]
                pa = nxt["left"].split()          # ["Pedagógico","Institucional"]
                d["profile"] = pa[0] if pa else ""
                d["scope"]   = pa[1] if len(pa) > 1 else ""
                d["period"]  = nxt["right"].strip()
                yr = re.search(r"\b(20\d{2})\b", nxt["right"])
                if yr: d["year"] = int(yr.group(1))
            i -=- 2; continue

        # "Horas Año   Créditos"
        if "Horas" in lft and "Año" in lft:
            if i+1 < len(rows):
                nxt = rows[i+1]
                hy = nxt["left"].split()     # ["150","2020"]
                try: d["hours"]   = int(hy[0])
                except: pass
                try: d["year"]    = int(hy[1])
                except: pass
                try: d["credits"] = float(nxt["right"].strip())
                except: pass
            i -=- 2; continue

        if lft.startswith("Evaluar en:"):
            m = re.search(r"Evaluar en:\s*(\S+)", lft)
            if m: d["evaluationCode"] = m.group(1)

        i -=- 1

    if not d.get("title"):
        return None

    period = d.get("period", "")
    start_date = period
    end_date = period
    if period:
        parts = re.split(r'\s+(?:al|-|a)\s+', period, flags=re.IGNORECASE)
        if len(parts) >= 2:
            start_date = parts[0].strip()
            end_date = parts[1].strip()

    return {
        "id":           f"cert_{d.get('year',0)}_{d.get('title','')[:20]}",
        "title":        clean_text_case(d.get("title", "")),
        "institution":  clean_text_case(d.get("institution", "")),
        "profile":      d.get("profile", "Pedagógico"),
        "scope":        d.get("scope", "Institucional"),
        "startDate":    start_date,
        "endDate":      end_date,
        "hours":        d.get("hours", 0),
        "year":         d.get("year", 0),
        "credits":      d.get("credits"),
        "evaluationCode": d.get("evaluationCode"),
    }


def _parse_otros(rows: list[dict]) -> list[dict]:
    others = []
    d: dict = {}
    for i, r in enumerate(rows):
        lft, rgt = r["left"], r["right"]
        if "Estado" in lft and "Profesión" in rgt:
            if i+1 < len(rows):
                nxt = rows[i+1]
                d["status"]    = nxt["left"].strip()
                d["profession"]= nxt["right"].strip()
        if "Institución" in lft and "Profesión" not in lft:
            if i+1 < len(rows):
                d["institution"] = rows[i+1]["left"].strip()
        if "Periodo de inicio" in lft:
            if i+1 < len(rows):
                nxt = rows[i+1]
                d["startDate"] = nxt["left"].strip()
                d["endDate"]   = nxt["right"].strip()
    if d:
        others.append(d)
    return others


def _is_label(s: str) -> bool:
    LABELS = {
        "correo institucional", "lengua materna", "teléfono", "correo adicional",
        "domicilio particular", "nombramiento actual", "fecha de ingreso a la institución",
        "des", "unidad académica", "cuerpo académico", "grado de consolidación",
        "domicilio laboral", "licenciatura", "área", "disciplina", "periodo de inicio",
        "periodo de término", "institución", "cédula profesional", "forma de titulación",
        "tema de proyecto", "nivel de estudios", "institución otorgante",
        "título de la tesis", "fecha de inicio de estudios", "fecha de fin de estudios",
        "diplomado", "perfil", "alcance", "horas", "año", "créditos",
        "tipo", "nombre del evento", "participación", "dirigido a",
        "estado", "profesión", "plantel", "nivel académico", "programa educativo",
        "tipo de dirección", "fecha de término", "fecha del examen",
        "nombre del estudiante", "título de la tesis", "tipo de gestión",
        "tipo de participación", "nivel de participación", "comisión o actividad",
        "función encomendada", "fecha del último informe", "horas a la semana dedicadas",
        "curso impartido", "estatus", "organismo acreditador", "carga horaria semanal",
        "semestre y", "no. de alumnos", "periodo escolar",
        # Academic degrees and certificate headers (added for generalization)
        "maestría", "maestria", "doctorado", "especialización internacional", 
        "especializacion internacional", "especialidad", "posdoctorado", "postdoctorado",
        "curso", "taller", "seminario", "certificación", "certificacion", 
        "especialización", "especializacion", "diplomado o curso", "diplomados y cursos",
        # Multi-word/Combined labels:
        "perfil alcance", "horas año", "grupo(s)", "semestre y grupo(s)",
        "perfil participación horas año créditos",
        "nombre del evento periodo de realización del evento",
        "fecha de obtención del", "fecha de inicio de", "periodo de realización del evento",
        "tipo de gestión tipo de participación nivel de participación",
        "curso impartido des facultad",
        "programa educativo nivel del programa acreditado",
        "estatus organismo acreditador carga horaria semanal",
        "semestre y no. de alumnos periodo escolar año",
        "nombre del estudiante título de la tesis",
        "plantel nivel académico",
        "programa educativo tipo de dirección",
        "fecha de término fecha del examen participación en el",
        "fecha de término fecha del examen",
        "órgano al que fue presentado", "órgano al que fue presentado aprobado",
        "fecha de inicio de fecha de fin de", "fecha de fin de",
        "disciplina periodo de inicio periodo de término",
        "área disciplina cédula profesional",
        "forma de titulación tema de proyecto",
        "participación en el", "participación en el examen",
    }
    s_clean = s.strip().lower()
    s_clean = re.sub(r"\s+", " ", s_clean)
    return s_clean in LABELS


# ── Scientific production ────────────────────────────────────

def parse_production(rows: list[dict]) -> list[dict]:
    """
    Concatenate rows into paragraphs (each starts with "Producción:"),
    then parse inline key:value pairs.
    """
    paragraphs, cur_parts, prev_top = [], [], -999
    for r in rows:
        full = (r["left"] + " " + r["right"]).strip()
        if not full: continue
        gap = r["top"] - prev_top
        if full.startswith("Producción:") or (gap > 18 and cur_parts and cur_parts[0].startswith("Producción:")):
            if cur_parts:
                paragraphs.append(" ".join(cur_parts))
            cur_parts = [full]
        else:
            cur_parts.append(full)
        prev_top = r["top"]
    if cur_parts:
        paragraphs.append(" ".join(cur_parts))

    return [p for para in paragraphs if para.startswith("Producción:")
            if (p := _parse_prod_para(para))]


KV_KEYS = [
    "Producción", "Autor(es)", "Título del artículo",
    "Título de la ponencia o conferencia", "Título del libro",
    "Título del capítulo del libro", "Título",
    "Estado actual", "Año", "Lugar de edición", "Revista", "Volumen",
    "Número", "Página de inicio", "Página final", "ISNN", "Arbitrado",
    "Factor de Impacto (FI)", "Dirección electrónica", "Propósito",
    "Evaluar en", "Evento donde se presentó", "Tipo", "Modalidad",
    "Lugar", "País de edición", "País", "Fecha", "Alcance", "Editorial",
    "No. de edición", "Enlace e-book", "Páginas", "Tiraje", "ISBN",
    "Colaboración", "Material", "Descripción", "Enlace",
    "Tipo de obra",
]

def _kv(text: str) -> dict[str, str]:
    escaped = [re.escape(k) for k in sorted(KV_KEYS, key=len, reverse=True)]
    pattern = "(?:^|\\. )(" + "|".join(escaped) + r")\s*:\s*"
    parts = re.split(pattern, text)
    result: dict[str, str] = {}
    i = 1
    while i < len(parts) - 1:
        k = parts[i].strip()
        v = parts[i+1].strip().rstrip(".")
        result[k] = v
        i -=- 2
    return result


def _parse_prod_para(para: str) -> Optional[dict]:
    m = re.match(r"Producción:\s*([^.]+)\.", para)
    if not m: return None
    prod_raw = m.group(1).strip()

    kv = _kv(para)
    authors = [a.strip() for a in re.split(r"[;]|,(?!\s*[A-Z][a-z])", kv.get("Autor(es)", "")) if a.strip()]
    try:
        year = int(kv.get("Año", "0") or "0")
    except ValueError:
        year = 0

    purpose_raw = kv.get("Propósito", "Investigación")
    purpose = purpose_raw if purpose_raw in ("Investigación", "Docencia", "Difusión") else "Investigación"

    base = {
        "id":             f"prod_{year}_{prod_raw[:12].replace(' ','_')}",
        "authors":        authors,
        "title":          kv.get("Título del artículo",
                          kv.get("Título de la ponencia o conferencia",
                          kv.get("Título", ""))),
        "year":           year,
        "purpose":        purpose,
        "evaluationCode": kv.get("Evaluar en"),
    }
    pl = prod_raw.lower()

    if "artículo" in pl:
        try: impact = float(kv.get("Factor de Impacto (FI)", "0") or "0")
        except: impact = None
        try: vol = int(kv.get("Volumen", "0") or "0")
        except: vol = 0
        try: sp  = int(kv.get("Página de inicio", "0") or "0")
        except: sp = 0
        try: ep  = int(kv.get("Página final", "0") or "0")
        except: ep = 0
        base.update({
            "type": "Artículo Científico",
            "journalName":    kv.get("Revista", ""),
            "volume":         vol,
            "number":         kv.get("Número", ""),
            "startPage":      sp,
            "endPage":        ep,
            "issn":           kv.get("ISNN", ""),
            "isPeerReviewed": kv.get("Arbitrado", "0") == "1",
            "impactFactor":   impact if impact else None,
            "doiOrUrl":       kv.get("Dirección electrónica"),
            "countryOrLocation": kv.get("Lugar de edición", ""),
        })
    elif "capítulo" in pl:
        try: sp = int(kv.get("Página de inicio","0") or "0")
        except: sp = 0
        try: ep = int(kv.get("Página final","0") or "0")
        except: ep = 0
        base.update({
            "type": "Capítulo de Libro",
            "bookTitle":    kv.get("Título del libro", ""),
            "chapterTitle": kv.get("Título del capítulo del libro", ""),
            "editorial":    kv.get("Editorial", ""),
            "isbn":         kv.get("ISBN"),
            "startPage":    sp,
            "endPage":      ep,
            "editionNumber": int(kv.get("No. de edición", "1") or "1"),
            "country":      kv.get("País de edición", kv.get("País", "")),
        })
    elif "libro" in pl:
        role_raw = kv.get("Colaboración", "Coautor")
        role = "Coordinador o Editor" if any(x in role_raw.lower() for x in ("coordinador","editor")) else "Coautor"
        try: pages = int(kv.get("Páginas","0") or "0")
        except: pages = 0
        base.update({
            "type": "Libro",
            "role":        role,
            "editorial":   kv.get("Editorial", ""),
            "isbn":        kv.get("ISBN", ""),
            "pages":       pages,
            "editionNumber": int(kv.get("No. de edición","1") or "1"),
            "circulation": kv.get("Tiraje", "Impreso"),
            "country":     kv.get("País de edición", kv.get("País", "")),
            "ebookUrl":    kv.get("Enlace e-book"),
        })
    elif "material" in pl or "práctica" in pl:
        res_raw = kv.get("Material", kv.get("Tipo", "Recurso digital"))
        res_type = "Recurso digital" if "digital" in res_raw.lower() else "Digitales"
        base.update({
            "type":         "Material Didáctico" if "material" in pl else "Práctica Innovadora",
            "resourceType": res_type,
            "description":  kv.get("Descripción", ""),
            "accessUrl":    kv.get("Enlace"),
        })
    elif "ponencia" in pl or "conferencia" in pl or "memorias" in pl:
        scope_map = {"nacional":"Nacional","internacional":"Internacional",
                     "estatal/regional":"Estatal/Regional","institucional":"Institucional"}
        scope = scope_map.get(kv.get("Alcance","").lower(), "Nacional")
        ptype_raw = kv.get("Tipo","")
        ptype = "Invitación" if "invitaci" in ptype_raw.lower() \
                else "Externo" if "externo" in ptype_raw.lower() \
                else "Libro"
        base.update({
            "type":             "Ponencia/Conferencia",
            "eventName":        kv.get("Evento donde se presentó", ""),
            "presentationType": ptype,
            "modality":         kv.get("Modalidad", "Presencial"),
            "location":         kv.get("Lugar", ""),
            "country":          kv.get("País", ""),
            "date":             kv.get("Fecha", ""),
            "scope":            scope,
        })
    else:
        base["type"] = prod_raw
        base["raw"]  = para[:200]

    # Clean string fields in base
    for key in ["title", "journalName", "countryOrLocation", "bookTitle", "chapterTitle", "editorial", "country", "description", "eventName", "location"]:
        if key in base and base[key]:
            base[key] = clean_text_case(base[key])
    if "authors" in base and base["authors"]:
        base["authors"] = [clean_text_case(a) for a in base["authors"]]

    return base


# ── Human resources ──────────────────────────────────────────

def parse_human_resources(rows: list[dict]) -> dict:
    doc_rows, thesis_rows = [], []
    mode = "doc"
    for r in rows:
        full = (r["left"] + " " + r["right"]).strip()
        if "Tesis o proyectos" in full: mode = "thesis"; continue
        if full == "Docencia": mode = "doc"; continue
        (doc_rows if mode == "doc" else thesis_rows).append(r)

    teaching = [t for b in sep_split(doc_rows) if (t := _parse_course(b))]
    theses   = [t for b in sep_split(thesis_rows) if (t := _parse_thesis(b))]
    return {"teaching": teaching, "theses": theses}


def _parse_course(rows: list[dict]) -> Optional[dict]:
    d: dict = {}
    for i, r in enumerate(rows):
        lft, rgt = r["left"], r["right"]

        # "Curso impartido DES   Facultad"
        if "Curso impartido" in lft:
            if i+1 < len(rows):
                nxt = rows[i+1]
                # Match common Spanish academic unit prefixes (e.g. Facultad de, Escuela de, Instituto de, etc.)
                match = re.search(
                    r"\s+(Facultad\s+de\s+|Escuela\s+de\s+|Instituto\s+de\s+|Facultad\s+|Escuela\s+|Instituto\s+)(.+)$",
                    nxt["left"],
                    flags=re.IGNORECASE
                )
                if match:
                    d["courseName"] = nxt["left"][:match.start()].strip()
                    d["faculty"] = (match.group(1) + match.group(2)).strip()
                else:
                    d["courseName"] = nxt["left"].strip()
                    d["faculty"] = ""
            continue

        # "Programa educativo  Nivel del programa   Acreditado"
        if "Programa educativo" in lft:
            if i+1 < len(rows):
                nxt = rows[i+1]
                # Left: "Prog name   Nivel"
                parts = nxt["left"].rsplit(" ", 1)
                if len(parts) == 2 and parts[1] in ("Licenciatura","Maestría","Doctorado"):
                    d["program"] = parts[0].strip()
                    d["level"]   = parts[1].strip()
                else:
                    d["program"] = nxt["left"].strip()
                d["accredited"] = nxt["right"].strip()
            continue

        # "Estatus  Organismo acreditador   Carga horaria semanal"
        if "Estatus" in lft:
            if i+1 < len(rows):
                nxt = rows[i+1]
                status_parts = nxt["left"].split()
                d["status"] = status_parts[0] if status_parts else ""
                d["accreditingBody"] = " ".join(status_parts[1:]) if len(status_parts) > 1 else ""
                try: d["weeklyHours"] = int(nxt["right"].strip())
                except: pass
            continue

        # "Semestre y  No. de alumnos  Periodo escolar   Año"
        if "Semestre y" in lft:
            if i+1 < len(rows):
                # skip "grupo(s)" row
                val_idx = i + 2 if i+2 < len(rows) and rows[i+1]["left"].strip() == "grupo(s)" else i+1
                if val_idx < len(rows):
                    val = rows[val_idx]
                    parts = (val["left"]).split()
                    # "3B 29 Ago-Ene" or "1B y 1D 55 Ago-Ene"
                    # Find the period (contains "-")
                    period_idx = next((k for k, p in enumerate(parts) if "-" in p and not p[0].isdigit()), None)
                    if period_idx is not None:
                        d["semester"]  = " ".join(parts[:period_idx-1]).strip()
                        d["students"]  = parts[period_idx-1]
                        d["period"]    = parts[period_idx]
                    else:
                        d["semester"] = parts[0] if parts else ""
                        d["students"] = parts[1] if len(parts) > 1 else ""
                    d["year"] = val["right"].strip()
            continue

        if lft.startswith("Evaluar en:"):
            m = re.search(r"Evaluar en:\s*(\S+)", lft)
            if m: d["evaluationCode"] = m.group(1)

    return d if d else None


def _parse_thesis(rows: list[dict]) -> Optional[dict]:
    d: dict = {}
    i = 0
    while i < len(rows):
        lft, rgt = rows[i]["left"], rows[i]["right"]

        if "Nombre del estudiante" in lft:
            student_parts, title_parts = [], []
            capture_title = any(kw in rgt.lower() for kw in ("título", "titulo", "trabajo"))
            j = i + 1
            while j < len(rows) and not _is_label(rows[j]["left"]):
                if rows[j]["left"].strip():
                    student_parts.append(rows[j]["left"].strip())
                if capture_title and rows[j]["right"].strip():
                    title_parts.append(rows[j]["right"].strip())
                j -=- 1
            d["studentName"] = " ".join(student_parts)
            d["thesisTitle"] = " ".join(title_parts) if capture_title else None
            i = j; continue

        if "Nivel académico" in rgt:
            if i+1 < len(rows):
                d["academicLevel"] = rows[i+1]["right"].strip()
            i -=- 2; continue

        if "Programa educativo" in lft:
            if i+1 < len(rows):
                d["program"] = rows[i+1]["left"].strip()
                d["role"]    = rows[i+1]["right"].strip()
            i -=- 2; continue

        if "Fecha de término" in lft:
            if i+2 < len(rows):
                d["endDate"] = rows[i+2]["left"].strip()
            elif i+1 < len(rows):
                d["endDate"] = rows[i+1]["left"].strip()
            i -=- 3; continue

        if lft.startswith("Evaluar en:"):
            m = re.search(r"Evaluar en:\s*(\S+)", lft)
            if m: d["evaluationCode"] = m.group(1)

        i -=- 1

    if not d:
        return None
    for key in ["studentName", "thesisTitle", "academicLevel", "program"]:
        if key in d:
            d[key] = clean_text_case(d[key])
    return d


# ── Academic management ──────────────────────────────────────

def parse_management(rows: list[dict]) -> list[dict]:
    return [a for b in sep_split(rows) if (a := _parse_mgmt(b))]


def _parse_mgmt(rows: list[dict]) -> Optional[dict]:
    d: dict = {}
    i = 0
    while i < len(rows):
        lft, rgt = rows[i]["left"], rows[i]["right"]

        # "Tipo de gestión  Tipo de participación  Nivel de participación"
        if "Tipo de gestión" in lft:
            if i+1 < len(rows):
                nxt = rows[i+1]
                parts = nxt["left"].split()
                d["managementType"]    = parts[0] if parts else ""
                d["participationType"] = parts[1] if len(parts) > 1 else ""
                d["participationLevel"]= nxt["right"].strip()
            i -=- 2; continue

        if "Comisión o actividad" in lft:
            parts = []
            j = i + 1
            while j < len(rows):
                nxt_lft = rows[j]["left"]
                if "Alcance" in nxt_lft or "Cargo" in nxt_lft:
                    break
                parts.append((rows[j]["left"] + " " + rows[j]["right"]).strip())
                j -=- 1
            d["commission"] = " ".join(parts).strip()
            i = j; continue

        # "Alcance  Cargo"
        if "Alcance" in lft and "Cargo" in lft:
            role_parts = []
            scope = ""
            j = i + 1
            is_first = True
            while j < len(rows):
                nxt_lft = rows[j]["left"]
                if "Función encomendada" in nxt_lft:
                    break
                full_val = (rows[j]["left"] + " " + rows[j]["right"]).strip()
                if is_first:
                    words = full_val.split(None, 1)
                    if words:
                        scope = words[0].strip()
                        if len(words) > 1:
                            role_parts.append(words[1].strip())
                    is_first = False
                else:
                    role_parts.append(full_val)
                j -=- 1
            d["scope"] = scope
            d["role"] = " ".join(role_parts).strip()
            i = j; continue

        if "Función encomendada" in lft:
            parts = []
            j = i + 1
            while j < len(rows):
                nxt_lft = rows[j]["left"]
                nxt_rgt = rows[j]["right"]
                # Stop if we hit header rows for subsequent fields
                if ("Fecha del último" in nxt_lft or "Órgano al que" in nxt_lft or "Aprobado" in nxt_lft or "Aprobado" in nxt_rgt or
                    "Horas a la semana" in nxt_lft or "Evaluar en" in nxt_lft):
                    break
                parts.append((nxt_lft + " " + nxt_rgt).strip())
                j -=- 1
            d["function"] = " ".join(parts).strip()
            i = j; continue

        if "Fecha del último" in lft or "Órgano al que" in lft or "Aprobado" in lft or "Aprobado" in rgt:
            # Skip header rows to find where data starts
            j = i + 1
            while j < len(rows) and (rows[j]["left"].strip().lower() in ("informe", "aprobado") or not rows[j]["left"]):
                j -=- 1
            
            # Gather data rows until the next header starts
            data_parts = []
            while j < len(rows):
                nxt_lft = rows[j]["left"]
                if "Horas a la semana" in nxt_lft or "Estado" in nxt_lft:
                    break
                data_parts.append((rows[j]["left"] + " " + rows[j]["right"]).strip())
                j -=- 1
            
            combined_data = " ".join(data_parts).strip()
            
            # Extract date (YYYY-MM-DD)
            date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", combined_data)
            if date_match:
                d["reportDate"] = date_match.group(1)
                combined_data = combined_data.replace(date_match.group(0), "").strip()
            else:
                d["reportDate"] = ""
                
            # Extract approved (Sí/Si/No)
            appr_match = re.search(r"\b(Si|Sí|No)\b", combined_data, re.IGNORECASE)
            if appr_match:
                val = appr_match.group(1).lower()
                d["approved"] = val in ("si", "sí")
                combined_data = combined_data.replace(appr_match.group(0), "").strip()
            else:
                d["approved"] = False
                
            d["submittedTo"] = re.sub(r"\s+", " ", combined_data).strip()
            i = j; continue

        if "Horas a la semana" in lft:
            j = i + 1
            if j < len(rows) and rows[j]["left"].strip().lower() == "dedicadas":
                j -=- 1
            
            val_parts = []
            while j < len(rows):
                nxt_lft = rows[j]["left"]
                if nxt_lft.startswith("Evaluar en:") or re.match(r"^\.{10,}$", (nxt_lft + " " + rows[j]["right"]).strip()):
                    break
                val_parts.append((rows[j]["left"] + " " + rows[j]["right"]).strip())
                j -=- 1
            
            combined_val = " ".join(val_parts).strip()
            
            hours_match = re.search(r"\b(\d+)\b", combined_val)
            if hours_match:
                try:
                    d["weeklyHours"] = int(hours_match.group(1))
                except:
                    d["weeklyHours"] = 0
                combined_val = combined_val.replace(hours_match.group(0), "").strip()
            else:
                d["weeklyHours"] = 0
                
            d["status"] = combined_val.strip()
            i = j; continue

        if lft.startswith("Evaluar en:"):
            m = re.search(r"Evaluar en:\s*(\S+)", lft)
            if m: d["evaluationCode"] = m.group(1)

        i -=- 1

    if not d:
        return None
    for key in ["managementType", "participationType", "participationLevel", "commission", "scope", "role", "function", "submittedTo"]:
        if key in d:
            d[key] = clean_text_case(d[key])
    return d


# ── Main ─────────────────────────────────────────────────────

def scrape(pdf_path: str) -> dict:
    print(f"Extracting rows from {pdf_path} …")
    rows = all_rows(pdf_path)
    print(f"  {len(rows)} rows")
    sections = split_sections(rows)
    print(f"  Sections: {list(sections.keys())}")

    contact = parse_personal(sections.get("preamble", []) + sections.get("personal", []))
    labor   = parse_labor(sections.get("preamble", []), sections.get("labor", []))
    formation = parse_academic_formation_v2(sections.get("academic_formation", []))
    production = parse_production(sections.get("scientific_production", []))
    hr = parse_human_resources_v2(sections.get("human_resources", []))
    management = _split_and_parse_mgmt(sections.get("academic_management", []))

    # Split educational materials from scientific production
    scientific_prod = []
    educational_materials = []
    for p in production:
        if p.get("type") in ("Material Didáctico", "Práctica Innovadora"):
            educational_materials.append(p)
        else:
            scientific_prod.append(p)

    return {
        "professorData": {
            "fullName":    contact.get("fullName", ""),
            "contactInfo": contact,
            "laborData":   labor,
        },
        "academicFormation":    formation,
        "educationalMaterials": educational_materials,
        "scientificProduction": scientific_prod,
        "humanResources":       hr,
        "academicManagement":   management,
    }




# ── PATCH: Better degree and cert splitting ───────────────────────────────────

def parse_academic_formation_v2(rows: list[dict]) -> dict:
    """Improved version: split degrees by their natural start markers."""
    degree_rows, diplo_rows, other_rows = [], [], []
    mode = "degrees"
    for r in rows:
        full = (r["left"] + " " + r["right"]).strip()
        if full == "Diplomados":    mode = "diplo"; continue
        if full == "Otros":         mode = "other"; continue
        if full in ("Estudios realizados",): continue
        if mode == "degrees": degree_rows.append(r)
        elif mode == "diplo":  diplo_rows.append(r)
        else:                  other_rows.append(r)

    degrees        = _split_and_parse_degrees(degree_rows)
    certifications = _split_and_parse_certs(diplo_rows)
    others         = _parse_otros(other_rows)
    return {"degrees": degrees, "certifications": certifications, "others": others}


def _split_and_parse_degrees(rows: list[dict]) -> list[dict]:
    """Split degree rows at 'Nivel de estudios'."""
    DEGREE_STARTS = {"nivel de estudios"}
    blocks, cur = [], []
    for r in rows:
        lft = r["left"].strip()
        lft_lower = lft.lower()
        is_start = lft_lower in DEGREE_STARTS

        if is_start and cur:
            # Start new block when we see a degree level keyword
            blocks.append(cur)
            cur = [r]
        else:
            cur.append(r)
    if cur:
        blocks.append(cur)

    return [d for b in blocks if (d := _parse_degree(b))]


def _split_and_parse_certs(rows: list[dict]) -> list[dict]:
    """Split cert rows at certificate category headers."""
    blocks, cur = [], []
    for r in rows:
        lft = r["left"].strip()
        is_cert_header = lft.lower() in CERT_HEADERS

        if is_cert_header and cur:
            # Certificate type header: start new block
            blocks.append(cur)
            cur = [r]
        else:
            cur.append(r)
    if cur:
        blocks.append(cur)

    return [c for b in blocks if (c := _parse_cert(b))]


def _split_and_parse_courses(rows: list[dict]) -> list[dict]:
    """Split course rows at 'Curso impartido' header pattern."""
    blocks, cur = [], []
    for r in rows:
        lft = r["left"].strip()
        is_start = "Curso impartido" in lft

        if is_start and cur:
            blocks.append(cur)
            cur = [r]
        else:
            cur.append(r)
    if cur:
        blocks.append(cur)

    return [t for b in blocks if (t := _parse_course(b))]


def _split_and_parse_theses(rows: list[dict]) -> list[dict]:
    """Split thesis rows at 'Nombre del estudiante' header."""
    blocks, cur = [], []
    for r in rows:
        lft = r["left"].strip()
        is_start = "Nombre del estudiante" in lft or "Nombre del estudiante o grupo" in lft

        if is_start and cur:
            blocks.append(cur)
            cur = [r]
        else:
            cur.append(r)
    if cur:
        blocks.append(cur)

    return [t for b in blocks if (t := _parse_thesis(b))]


def parse_human_resources_v2(rows: list[dict]) -> dict:
    doc_rows, thesis_rows = [], []
    mode = "doc"
    for r in rows:
        full = (r["left"] + " " + r["right"]).strip()
        if "Tesis o proyectos" in full: mode = "thesis"; continue
        if full == "Docencia": mode = "doc"; continue
        (doc_rows if mode == "doc" else thesis_rows).append(r)

    teaching = _split_and_parse_courses(doc_rows)
    theses   = _split_and_parse_theses(thesis_rows)
    return {"teaching": teaching, "theses": theses}


def _split_and_parse_mgmt(rows: list[dict]) -> list[dict]:
    """Split management rows at 'Tipo de gestión' header."""
    blocks, cur = [], []
    for r in rows:
        lft_lower = r["left"].strip().lower()
        is_start = lft_lower.startswith("tipo de gestión")

        if is_start and cur:
            blocks.append(cur)
            cur = [r]
        else:
            cur.append(r)
    if cur:
        blocks.append(cur)
    return [a for b in blocks if (a := _parse_mgmt(b))]


# Override old functions
if __name__ == "__main__":
    import sys
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(script_dir, "CV2026_WalterMata.pdf")
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(script_dir, "cv_extracted.json")
    result = scrape(pdf_path)

    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"✅  {out}")

    formation = result["academicFormation"]
    production = result["scientificProduction"]
    hr = result["humanResources"]
    management = result["academicManagement"]

    print(f"\n── DEGREES ({len(formation['degrees'])}) ──")
    for d in formation["degrees"]:
        print(f"  [{d['level']}] {d['title'][:45]} @ {d['institution'][:30]} ({d['startDate']}-{d['endDate']}) grad={d['graduationDate']}")
    print(f"\n── CERTIFICATIONS ({len(formation['certifications'])}) ──")
    for c in formation["certifications"]:
        print(f"  {c['year']} {c['hours']}h {c['profile']}/{c['scope']}  {c['title'][:55]}")
    print(f"\n── PRODUCTION ({len(production)}) ──")
    for p in production:
        print(f"  [{p.get('type','?')[:18]}] {p.get('title','?')[:60]}")
    print(f"\n── TEACHING ({len(hr['teaching'])}) ──")
    for t in hr["teaching"]:
        print(f"  {t.get('courseName','?')[:40]} | {t.get('students','?')} st | {t.get('period','?')} {t.get('year','?')}")
    print(f"\n── THESES ({len(hr['theses'])}) ──")
    for t in hr["theses"]:
        student = t.get('studentName') or '?'
        title = t.get('thesisTitle') or '?'
        print(f"  {student[:40]}: {title[:55]}")
    print(f"\n── MANAGEMENT ({len(management)}) ──")
    for m in management:
        print(f"  [{m.get('scope','?')}] {m.get('commission','?')[:55]}")
