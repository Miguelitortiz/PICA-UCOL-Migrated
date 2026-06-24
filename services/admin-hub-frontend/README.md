# CV-UI — Extractor y Editor Curricular para EduVitae

Este proyecto es una aplicación web local que actúa como interfaz administrativa para cargar currículums en PDF (formato oficial de la Universidad de Colima), extraer su información mediante `cv_scraper.py`, editar los datos en una interfaz amigable e integrarlos al claustro docente principal de **EduVitae** mediante `format_cv.py`.

Comparte la misma paleta de colores, tipografías globales y diseño editorial que la web principal de **EduVitae**.

---

## 🚀 Cómo Iniciar el Proyecto

Debido a que el entorno de desarrollo se ejecuta en un contenedor **Distrobox** (`dev-main`) en Fedora Kinoite:

### 1. Iniciar el Servidor de Desarrollo
Para arrancar el servidor en tiempo real con recarga automática, ejecuta desde la raíz de este proyecto:
```bash
distrobox enter dev-main -- npm run dev
```

El servidor web estará disponible en: **`http://localhost:6768/`**

*(Nota: Se ha configurado en el puerto `6768` para evitar conflictos con la web principal de EduVitae, que corre en el puerto `6767`)*.

### 2. Construir para Producción
Para compilar y empaquetar el servidor de producción:
```bash
distrobox enter dev-main -- npm run build
```

---

## 📁 Estructura del Proyecto

```
/
├── cv_extractor/         # Scripts y utilidades de Python
│   ├── cv_scraper.py     # Script extractor de PDF a JSON
│   ├── format_cv.py      # Formateador de JSON para EduVitae
│   └── cv_extracted.json # JSON intermedio de intercambio
├── src/
│   ├── lib/
│   │   └── pythonHelper.ts # Detector del venv de Python y ejecutor
│   ├── layouts/
│   │   └── Layout.astro    # Layout general de la aplicación
│   ├── pages/
│   │   ├── api/
│   │   │   ├── extract.ts  # Endpoint de subida de PDF y extracción
│   │   │   └── save.ts     # Endpoint de guardado y formateo final
│   │   └── index.astro     # Interfaz principal (Drag & Drop + Editor)
│   └── styles/
│       └── global.css      # Estilos globales y Tailwind CSS v4
├── astro.config.mjs      # Configuración de Astro (modo SSR con adaptador de Node.js)
└── package.json          # Dependencias y scripts de ejecución
```

---

## ⚙️ Integración con Python y EduVitae
El backend en Node.js detecta automáticamente si el entorno virtual de EduVitae está disponible en la raíz del proyecto (`../venv`).

Al presionar **Listo (Exportar)** en el editor:
1. Los cambios del formulario se guardan en `/cv_extractor/cv_extracted.json`.
2. Se ejecuta `format_cv.py` mandando el archivo resultante directamente a `../App/src/content/profesores/`.
