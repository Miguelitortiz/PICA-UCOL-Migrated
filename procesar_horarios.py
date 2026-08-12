import pandas as pd
import argparse
import os

def process_schedule(input_file, output_prefix):
    print("Cargando el archivo Excel (esto puede tomar unos segundos)...")
    xl = pd.ExcelFile(input_file)
    
    records = []
    
    for sheet in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name=sheet)
        
        # Check if it's a schedule sheet by looking for "Día" and "Lección"
        # Usually they are in the second row (index 1) in Unnamed: 1 and Unnamed: 2
        is_schedule_sheet = False
        dia_col = None
        leccion_col = None
        
        # Find the row and columns that contain "Día" and "Lección"
        for i, row in df.head(5).iterrows():
            row_vals = row.astype(str).str.strip().str.lower()
            if 'día' in row_vals.values and 'lección' in row_vals.values:
                is_schedule_sheet = True
                # Find column indices
                dia_col = row_vals[row_vals == 'día'].index[0]
                leccion_col = row_vals[row_vals == 'lección'].index[0]
                start_row = i + 1
                break
                
        if not is_schedule_sheet:
            continue
            
        materia = sheet
        
        # Iterate through the schedule rows
        for idx in range(start_row, len(df)):
            row = df.iloc[idx]
            dia = row[dia_col]
            leccion = row[leccion_col]
            
            if pd.isna(dia) or pd.isna(leccion):
                continue
                
            # Iterate through the rest of the columns to find classes
            class_cols = [c for c in df.columns if c not in [dia_col, leccion_col] and c != df.columns[0]]
            for col in class_cols:
                clase = row[col]
                if pd.notna(clase) and str(clase).strip() != "":
                    # Limpiar el nombre de la clase
                    clase = str(clase).strip()
                    records.append({
                        'Clase': clase,
                        'Dia': dia,
                        'Leccion': leccion,
                        'Materia': materia
                    })
                    
    if not records:
        print("No se encontraron registros de horario.")
        return
        
    df_records = pd.DataFrame(records)
    
    # 1. Guardar formato lista
    lista_file = f"{output_prefix}_lista.csv"
    df_records.to_csv(lista_file, index=False, encoding='utf-8-sig')
    print(f"Generado formato lista: {lista_file}")
    
    # 2. Generar matriz para cada Clase
    # Las filas serán la Lección, las columnas los Días
    # Guardaremos todo en un solo CSV
    matriz_file = f"{output_prefix}_matriz.csv"
    
    df_pivot = df_records.pivot_table(index=['Clase', 'Leccion'], 
                                      columns='Dia', 
                                      values='Materia', 
                                      aggfunc=lambda x: ' / '.join(set(x)), 
                                      fill_value='')
    
    # Ordenar los días si es posible
    dias_orden = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    dias_existentes = [d for d in dias_orden if d in df_pivot.columns]
    dias_existentes += [d for d in df_pivot.columns if d not in dias_orden]
    df_pivot = df_pivot[dias_existentes]
    
    df_pivot.to_csv(matriz_file, encoding='utf-8-sig')
    print(f"Generado formato matriz: {matriz_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Procesar horario de Excel a CSV por clase.')
    parser.add_argument('--input', type=str, default='EXPORTACION_HORARIOS_2026_1.xlsx', help='Ruta del archivo Excel de entrada')
    parser.add_argument('--output', type=str, default='horario_por_clase', help='Prefijo del archivo CSV de salida')
    
    args = parser.parse_args()
    process_schedule(args.input, args.output)
