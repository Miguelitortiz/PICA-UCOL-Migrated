import re

file_path = '/Users/miguel/Documents/Projects/PICA-UCOL/services/student-hub/src/pages/index.astro'
with open(file_path, 'r') as f:
    content = f.read()

# Find section
section_match = re.search(r'    <!-- ─────────────────────────────────────\n         COLUMNA PRINCIPAL: TABLA DE HORARIO.*?    </section>\n', content, re.DOTALL)
# Find aside
aside_match = re.search(r'    <!-- ─────────────────────────────────────\n         SIDEBAR INFORMATIVO.*?    </aside>\n', content, re.DOTALL)

if section_match and aside_match:
    section_str = section_match.group(0)
    aside_str = aside_match.group(0)
    
    # Replace the section with a placeholder
    content = content.replace(section_str, '___SECTION___')
    # Replace the aside with the section
    content = content.replace(aside_str, section_str)
    # Replace the placeholder with the aside
    content = content.replace('___SECTION___', aside_str)
    
    # Also update CSS
    content = content.replace('grid-template-columns: 1fr 260px;', 'grid-template-columns: 260px 1fr;')
    
    with open(file_path, 'w') as f:
        f.write(content)
    print("Swapped successfully")
else:
    print("Could not find section or aside")
