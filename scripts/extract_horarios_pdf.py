#!/usr/bin/env python3
"""
Extract weekly schedules from a PDF timetable into CSV.

This script is tuned for the horario PDF layout used in this repository:
- one page per group
- a grid with day rows and time-slot columns
- text embedded in the PDF, so we can use PyMuPDF text blocks directly

It is intentionally conservative: it reads text blocks, assigns them to the
table geometry, and duplicates merged-class text across the time slots that the
block spans.

Usage:
    python3 scripts/extract_horarios_pdf.py \
        "/path/to/prueba_horarios (1).pdf" \
        "horarios_completos_extracted.csv"
"""

from __future__ import annotations

import csv
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import fitz  # PyMuPDF


DAY_NAMES = ["Lu", "Ma", "Mi", "Ju", "Vi"]
DAY_FULL = {
    "Lu": "Lunes",
    "Ma": "Martes",
    "Mi": "Miércoles",
    "Ju": "Jueves",
    "Vi": "Viernes",
}

# Table geometry taken from the PDF vector lines.
X_BOUNDS = [12.2, 88.9, 132.1, 175.3, 218.4, 261.6, 304.8, 348.0, 391.2, 434.3, 477.5, 520.7, 563.9, 607.0, 650.2, 693.4, 736.6, 779.8]
Y_BOUNDS = [61.2, 113.2, 206.8, 300.5, 394.1, 487.7, 581.4]

# Slot columns excluding the recess columns. Each tuple is (label, start_x, end_x).
TIME_SLOTS = [
    ("07:00 - 07:50", 88.9, 132.1),
    ("07:50 - 08:40", 132.1, 175.3),
    ("08:40 - 09:10", 175.3, 218.4),  # recess
    ("09:10 - 10:00", 218.4, 261.6),
    ("10:00 - 10:50", 261.6, 304.8),
    ("10:50 - 11:40", 304.8, 348.0),
    ("11:40 - 12:30", 348.0, 391.2),
    ("12:30 - 13:20", 391.2, 434.3),
    ("13:20 - 14:10", 434.3, 477.5),
    ("14:10 - 15:00", 477.5, 520.7),
    ("15:00 - 15:30", 520.7, 563.9),  # recess
    ("15:30 - 16:20", 563.9, 607.0),
    ("16:20 - 17:10", 607.0, 650.2),
    ("17:10 - 18:00", 650.2, 693.4),
    ("18:00 - 18:50", 693.4, 736.6),
    ("18:50 - 19:40", 736.6, 779.8),
]

ACTIVE_SLOT_INDICES = [0, 1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15]

# Numeric standardization requested by the user: 7:00 - 7:50 => Hora 1, etc.
HOUR_LABELS = {
    "07:00 - 07:50": "1",
    "07:50 - 08:40": "2",
    "09:10 - 10:00": "3",
    "10:00 - 10:50": "4",
    "10:50 - 11:40": "5",
    "11:40 - 12:30": "6",
    "12:30 - 13:20": "7",
    "13:20 - 14:10": "8",
    "14:10 - 15:00": "9",
    "15:30 - 16:20": "10",
    "16:20 - 17:10": "11",
    "17:10 - 18:00": "12",
    "18:00 - 18:50": "13",
    "18:50 - 19:40": "14",
}


@dataclass
class Block:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2.0

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2.0


def normalize_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text.replace("\u00ad", "")).strip()
    text = re.sub(r"\s+([.,;:])", r"\1", text)
    return text


def join_texts(values: Iterable[str]) -> str:
    parts = [normalize_text(v) for v in values if normalize_text(v)]
    if not parts:
        return ""
    # Deduplicate while preserving order.
    out = []
    seen = set()
    for part in parts:
        if part not in seen:
            out.append(part)
            seen.add(part)
    return " / ".join(out)


def load_blocks(page: fitz.Page) -> list[Block]:
    blocks: list[Block] = []
    for raw in page.get_text("blocks"):
        x0, y0, x1, y1, text = raw[:5]
        text = normalize_text(text)
        if not text:
            continue
        # Skip footer/header noise; the page title and footer are outside the schedule grid.
        if "Horario generado" in text or "aSc Horarios" in text:
            continue
        blocks.append(Block(x0, y0, x1, y1, text))
    return blocks


def page_group_name(page: fitz.Page) -> str:
    # Group title appears centered near the top.
    text = normalize_text(page.get_text("text").splitlines()[-1] if page.get_text("text").splitlines() else "")
    # Prefer the visible group title if present.
    m = re.search(r"\b(\d+\s*[A-Z])\b", text)
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip()

    # Fallback: scan words near the top.
    words = page.get_text("words")
    top_words = [w[4] for w in words if w[1] < 100]
    for i in range(len(top_words) - 1):
        if re.fullmatch(r"\d+", top_words[i]) and re.fullmatch(r"[A-Z]", top_words[i + 1]):
            return f"{top_words[i]} {top_words[i + 1]}"
    return ""


def extract_schedule_rows(page: fitz.Page) -> list[dict[str, str]]:
    blocks = load_blocks(page)
    group = page_group_name(page)
    cells: dict[tuple[str, str], list[Block]] = {}

    for block in blocks:
        if len(block.text) <= 1:
            continue
        if block.x0 < 80 and block.y0 < 120:
            continue

        # Day is determined by the block's vertical center.
        day_code = ""
        for day_idx, candidate in enumerate(DAY_NAMES):
            row_y0 = Y_BOUNDS[1 + day_idx]
            row_y1 = Y_BOUNDS[2 + day_idx] if 2 + day_idx < len(Y_BOUNDS) else Y_BOUNDS[-1]
            if row_y0 <= block.cy <= row_y1:
                day_code = candidate
                break
        if not day_code:
            continue

        # Assign the block to the slot that contains its center point.
        best_slot = None
        for idx in ACTIVE_SLOT_INDICES:
            time_label, x0, x1 = TIME_SLOTS[idx]
            if x0 <= block.cx <= x1:
                best_slot = time_label
                break
        if not best_slot:
            continue

        cells.setdefault((day_code, best_slot), []).append(block)

    rows: list[dict[str, str]] = []
    for day_code in DAY_NAMES:
        for idx in ACTIVE_SLOT_INDICES:
            time_label, _, _ = TIME_SLOTS[idx]
            hour_label = HOUR_LABELS.get(time_label, time_label)
            blocks_in_cell = cells.get((day_code, time_label), [])
            if blocks_in_cell:
                blocks_in_cell = sorted(blocks_in_cell, key=lambda b: (b.y0, b.x0))
                lines = [normalize_text(b.text) for b in blocks_in_cell if normalize_text(b.text)]
                text = " / ".join(dict.fromkeys(lines))
            else:
                text = ""

            if not text:
                continue

            # Standardize the time to the canonical slot label, even if the PDF text
            # is split across lines or repeated in several text blocks.
            materia_parts: list[str] = []
            docente_parts: list[str] = []
            for piece in [p.strip() for p in text.split(" / ") if p.strip()]:
                if re.search(r"\b(Lunes|Martes|Miércoles|Jueves|Viernes)\b", piece):
                    continue
                if re.search(r"\b(Prof\.?|Profa\.?|Profesor|Profesora|Docente)\b", piece, re.I):
                    docente_parts.append(piece)
                    continue
                # If the fragment looks like a full name, treat it as teacher data.
                if re.fullmatch(r"[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+)+", piece):
                    docente_parts.append(piece)
                else:
                    materia_parts.append(piece)

            materia = " / ".join(dict.fromkeys(materia_parts)).strip()
            docente = " / ".join(dict.fromkeys(docente_parts)).strip()
            if not materia:
                materia = text

            rows.append(
                {
                    "Grupo": group,
                    "Día": DAY_FULL[day_code],
                    "Horario": hour_label,  # canonical numeric slot
                    "Materia": materia,
                    "Docente": docente,
                    "Observaciones": "",
                }
            )

            # If the same class visibly spans two consecutive slots in the PDF,
            # duplicate it into the next numeric hour as well.
            if len(blocks_in_cell) == 1:
                block = blocks_in_cell[0]
                next_idx = idx + 1
                if next_idx < len(TIME_SLOTS):
                    next_time_label, _, _ = TIME_SLOTS[next_idx]
                    next_hour_label = HOUR_LABELS.get(next_time_label, next_time_label)
                    if next_time_label not in {"08:40 - 09:10", "15:00 - 15:30"}:
                        next_cell_blocks = cells.get((day_code, next_time_label), [])
                        if not next_cell_blocks:
                            span_width = block.x1 - block.x0
                            if span_width > 40:
                                rows.append(
                                    {
                                        "Grupo": group,
                                        "Día": DAY_FULL[day_code],
                                        "Horario": next_hour_label,
                                        "Materia": materia,
                                        "Docente": docente,
                                        "Observaciones": "",
                                    }
                                )

    return rows


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "Usage: python3 scripts/extract_horarios_pdf.py INPUT_PDF OUTPUT_CSV",
            file=sys.stderr,
        )
        return 1

    input_pdf = Path(sys.argv[1]).expanduser().resolve()
    output_csv = Path(sys.argv[2]).expanduser().resolve()

    if not input_pdf.exists():
        print(f"Input PDF not found: {input_pdf}", file=sys.stderr)
        return 1

    doc = fitz.open(str(input_pdf))
    all_rows: list[dict[str, str]] = []
    for page in doc:
        all_rows.extend(extract_schedule_rows(page))

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f, fieldnames=["Grupo", "Día", "Horario", "Materia", "Docente", "Observaciones"]
        )
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"Wrote {len(all_rows)} rows to {output_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
