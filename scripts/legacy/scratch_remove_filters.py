import re

file_path = '/Users/miguel/Documents/Projects/PICA-UCOL/services/student-hub/src/pages/profesores/index.astro'
with open(file_path, 'r') as f:
    content = f.read()

# Remove search panel
content = re.sub(r'  <!-- Panel de búsqueda y filtros -->.*?  <!-- Grid de profesores -->', '  <!-- Grid de profesores -->', content, flags=re.DOTALL)

# Remove "Sin resultados", scripts and styles at the end
# The script section starts at "  <!-- Sin resultados -->"
content = re.sub(r'  <!-- Sin resultados -->.*?</style>\n', '', content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
print("Removed filters and scripts.")
