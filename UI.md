# UI / UX

## Minimalismo Funcional con fundamentos del Diseño Suizo y Accesibilidad como núcleo (Accessibility-Core) 
---


**Sistema Visual**  
**Lenguaje visual**  
- **Estilo seleccionado**: Minimalismo suizo funcional con alta legibilidad.  
- **Estilos descartados**: Cualquier variante de neumorphism, glassmorphism, brutalismo sin pulir, Material Design 3 sin adaptar (por su exceso de color y elevación), Bento como layout principal.  
- **Razones**: Los estilos descartados añaden ruido visual, reducen el contraste o crean patrones de lectura impredecibles.

**Sistema de espaciado**  
- **Grid base**: 4 px (módulo mínimo).  
- **Escala de espaciado**: 4, 8, 12, 16, 24, 32, 48, 64 px. Los márgenes de pantalla son 16 px en móvil y 24 px en escritorio.  
- **Columnas**:  
  - Móvil: 4 columnas fluidas.  
  - Tablet: 8 columnas.  
  - Escritorio: 12 columnas, con un ancho máximo de contenido de 1280 px centrado.  
- **Breakpoints**:  
  - `sm`: 640 px (móvil apaisado / tablet pequeño).  
  - `md`: 1024 px (tablet / escritorio pequeño).  
  - `lg`: 1280 px (escritorio estándar).  
  - `xl`: 1536 px (pantallas grandes; se mantiene ancho de contenido máximo de 1280 px).

**Tipografía**  
- **Familia principal**: Inter (sans-serif, diseñada para pantallas, excelente legibilidad y amplio soporte de pesos).  
- **Familia secundaria**: Fuente del sistema (system-ui) para datos numéricos o interfaces embebidas, manteniendo consistencia con el sistema operativo.  
- **Escala tipográfica (basada en 16 px)**:
  - `text-xs`: 12 px (metadatos, badges).
  - `text-sm`: 14 px (texto secundario).
  - `text-base`: 16 px (cuerpo, controles de formulario).
  - `text-lg`: 18 px (títulos de tarjeta).
  - `text-xl`: 20 px (encabezados de sección).
  - `text-2xl`: 24 px (títulos de pantalla).
  - `text-3xl`: 30 px (Inicio, encabezado principal).
- **Alturas de línea**: 1.2 para títulos, 1.5 para cuerpo, garantizando espacio vertical suficiente.

**Sistema de color**  
Definido con validación de contraste WCAG 2.2 AA (normal: ≥4.5:1, texto grande: ≥3:1). La paleta respeta la lista cromática institucional y la corriente del diseño suizo (máxima legibilidad, mínima contaminación visual, jerarquía clara).

- **Primario (confianza, estructura):** Verde obscuro `#527630` (Pantone 364).  
  Uso: navegación activa, encabezados, indicador de selección.  
  Contraste sobre blanco **5.26 : 1** (AA).

- **Secundario (acciones, interactividad):** Azul `#006096` (Pantone 647).  
  Uso: botones primarios, enlaces, indicadores de progreso.  
  Contraste sobre blanco **6.74 : 1** (AA).

- **Fondo:** `#FAFAFA` para pantalla, `#FFFFFF` para tarjetas (contraste con texto primario **17.8 : 1**).

- **Texto primario:** `#1A1A1A` (casi negro). Contraste sobre blanco **17.8 : 1**.

- **Texto secundario:** `#4E4D4D` (Pantone 425, gris obscuro). Contraste sobre blanco **8.32 : 1**.

- **Estados:**  
  - Error: `#770F00` (Pantone 1815). Contraste sobre blanco **11.35 : 1**.  
  - Éxito: `#527630` (verde obscuro, mismo primario). Contraste **5.26 : 1**.  
  - Advertencia: `#FBB034` (Pantone 137, Naranja) solo para iconos, siempre con etiqueta textual en color de texto secundario.

- **Bordes sutiles:** `#B4B4B4` (Pantone 421, Gris claro). Separa sin añadir peso visual.

- **Enfoque (focus):** anillo de 2 px `#006096` con desplazamiento, muy visible (contraste 6.74 : 1).

*Justificación*: Se emplean los verdes institucionales autorizados (Pantone 364 como primario estructural; Pantone 7737 `#64B32E` puede usarse como acento complementario). El azul secundario garantiza una interactividad evidente y accesible. Los grises de la paleta corporativa aportan una jerarquía tipográfica sutil, y el alto contraste de todos los estados refuerza la funcionalidad sin distracciones, fiel al rigor del diseño suizo.
**Design System**  
Todos los componentes se definen con variantes, estados (default, hover, focus, active, disabled) y criterios de accesibilidad. No se utilizan sombras; la jerarquía se logra mediante tipografía, espaciado y bordes de 1 px.

- **Botones**  
  - *Primario*: Fondo teal `#0D7377`, texto blanco, borde redondeado de 8 px. Altura 44 px (mínimo táctil).  
  - *Secundario*: Borde teal, fondo transparente.  
  - *Texto*: Solo texto con subrayado en hover.  
  - *Icono*: Circular o cuadrado, con tooltip accesible.  
  - Estados: focus visible con anillo, disabled con opacidad 0.38.  

- **Inputs**  
  - Texto, select, date picker (nativo cuando sea posible).  
  - Borde inferior de 1 px `#BDBDBD`, altura 44 px, label flotante o superior.  
  - Error: borde inferior `#C62828` y mensaje descriptivo.  

- **Cards (tarjetas de contenido)**  
  - Sin sombra; fondo blanco con borde `#E0E0E0` y padding 16 px.  
  - Para widgets de Inicio: ancho flexible en grid, máximo 3 columnas en escritorio.  
  - En móvil ocupan el ancho completo con separación vertical de 16 px.  

- **Tabs**  
  - Estilo subrayado: texto + indicador inferior de 2 px color primario.  
  - Scroll horizontal en móvil si hay varios tabs.  
  - Accesibilidad: rol `tablist`, `tab`, `tabpanel`.  

- **Calendario**  
  - Vista de mes simplificada, con números de día en celda de 44x44 px.  
  - Día actual resaltado con círculo de borde teal.  
  - Días con eventos: punto inferior del color de la categoría.  
  - Navegación entre meses con botones de flecha grandes.  

- **Tablas (para calificaciones y horarios semanales)**  
  - Estructura simple, líneas horizontales `#E0E0E0`.  
  - Encabezados fijos en scroll (sticky).  
  - Zebra stripe opcional con `#F5F5F5`.  

- **Navegación**  
  - Barra inferior (móvil): altura 56 px, iconos + texto pequeño (10 px), estado activo en primario.  
  - Panel lateral (escritorio): ancho 240 px (expandido) o 64 px (colapsado solo iconos).  
  - Item activo: fondo `#EBF0F5`, texto primario.  

**Accesibilidad transversal**  
- Área interactiva mínima 44x44 px.  
- Todo contenido dinámico usa `aria-live` educado.  
- Navegación por teclado completa con tabindex lógico.  
- Contraste verificado automáticamente en el pipeline de CI.  
- Soporte para `prefers-reduced-motion`: elimina todas las animaciones no esenciales.

---

**Especificación Técnica**  
Se recomienda la siguiente arquitectura frontend:

- **Framework**: React 18+ con Next.js (App Router) para renderizado híbrido (SSR/SSG) que garantiza carga instantánea de la shell y SEO si fuese necesario. La mayor parte de la plataforma funcionará como SPA tras la carga inicial.  
- **Estilado**: Tailwind CSS configurado con design tokens a través de variables CSS y el plugin `tailwindcss-theme-swapper` o directamente con clases utilitarias extendidas desde un archivo de tokens.  
- **Tokens centralizados** (ejemplo en Style Dictionary o archivo JSON que exporta a CSS y Tailwind):
  ```json
  {
    "color": {
      "primary": "#1B3A5C",
      "secondary": "#0D7377",
      "background": "#FAFAFA",
      "surface": "#FFFFFF",
      "text-primary": "#1A1A1A",
      "text-secondary": "#4F4F4F",
      "border": "#E0E0E0",
      "error": "#C62828",
      "success": "#2E7D32"
    },
    "spacing": {
      "xs": "4px",
      "sm": "8px",
      "md": "16px",
      "lg": "24px",
      "xl": "32px",
      "2xl": "48px"
    },
    "typography": {
      "fontFamily": "Inter, system-ui, sans-serif",
      "scale": {
        "xs": "0.75rem",
        "sm": "0.875rem",
        "base": "1rem",
        "lg": "1.125rem",
        "xl": "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.875rem"
      },
      "lineHeight": {
        "tight": 1.2,
        "normal": 1.5
      }
    },
    "elevation": {
      "none": "none",
      "focus-ring": "0 0 0 2px #0D7377"
    },
    "motion": {
      "duration": "150ms",
      "easing": "ease-out"
    }
  }
  ```
- **Variables CSS**: Generadas a partir de los tokens e inyectadas en `:root`, permitiendo temas (ej. dark mode controlado con clase `.dark`).  
- **Componentes**: Implementados como componentes React con tipado estricto (TypeScript). Se utilizará Headless UI o Radix UI para patrones accesibles (tabs, dialogs, disclosure) sin estilos predefinidos, aplicando luego nuestras clases de diseño.  
- **Motion**: Transiciones limitadas a opacidad y transformaciones sutiles (`fade`, `slide-up` para modales) con `prefers-reduced-motion` respetado.  
- **Persistencia de caché y estado**: React Query (TanStack Query) para datos del servidor con stale-while-revalidate, garantizando que el horario y las tareas se vean incluso sin conexión.

---

**Riesgos Detectados**  
1. **Frialdad emocional**: Un diseño extremadamente funcional puede percibirse como institucional y distante. Mitigación: incorporar un saludo personalizado “Buenos días, [nombre]” y una ilustración minimalista en el estado vacío de tareas (línea, monocromática).  
2. **Sobrecarga en Inicio**: Si se agregan widgets sin control, el dashboard puede perder su propósito. Se establece un máximo de 3 widgets en Inicio; cualquier ampliación deberá pasar por un comité de UX.  
3. **Dificultad de personalización sin perder consistencia**: Permitir que el usuario reordene widgets podría romper el diseño. Se mantiene un orden fijo basado en pruebas de usabilidad, con posibilidad de ocultar widgets no deseados.  
4. **Rendimiento con muchos datos cacheados**: En conexiones lentas, la hidratación del estado inicial podría bloquear la interacción. Se usará carga progresiva y streaming de Next.js.  
5. **Evolución futura**: Si se añaden funcionalidades complejas (videollamadas, foros), el patrón minimalista deberá ampliarse con submódulos, no transformarse en un dashboard. Se documentará la guía de extensión del sistema de diseño.

---

**Alternativas Consideradas**  
- **Material Design 3 puro**: Descartado por sus colores dinámicos generados automáticamente (Material You) que crean combinaciones impredecibles y una sensación de “app genérica”.  
- **Interfaz gamificada con avatares y niveles**: Aumenta el engagement a costa de la eficiencia; los estudiantes buscan datos concretos, no entretenimiento.  
- **Panel de control estilo analytics**: Aunque los datos de progreso son relevantes, la metáfora de dashboard empresarial resulta ajena al contexto estudiantil y promueve una lectura analítica que consume más tiempo.  
- **Bento layout como metáfora principal**: Interesante para descubrir contenido, pero ralentiza la localización de información fija. Podría considerarse para un futuro módulo de “Descubrir recursos”, no para el núcleo de la plataforma.  

Todas fueron evaluadas y rechazadas por aumentar la carga cognitiva o violar los principios de claridad establecidos.

---

**Evaluación Final**  
| Criterio          | Puntuación (0–10) | Comentario |
|-------------------|-------------------|------------|
| UX                | 9                 | Flujos optimizados al máximo. Falta validación con usuarios reales para el ajuste fino de jerarquías. |
| Accesibilidad     | 9                 | Cumple WCAG 2.2 AA; la implementación técnica de componentes accesibles es sólida. Se requiere auditoría final con lectores de pantalla. |
| Escalabilidad     | 9                 | El sistema de tokens y los componentes atómicos permiten crecer sin deuda visual. |
| Mantenibilidad    | 9                 | Centralización en tokens y coherencia entre diseño y código. Documentación pendiente del design system. |
| Rendimiento       | 9                 | Diseño ligero, sin imágenes pesadas ni animaciones costosas. Next.js y estrategias de caché garantizan rapidez. |
| Claridad visual   | 10                | Jerarquía tipográfica, espaciado generoso y ausencia de ornamento: el contenido habla por sí mismo. |

---

**Checklist para Implementación**  
- [ ] Configurar proyecto Next.js con TypeScript, Tailwind y variables CSS a partir de tokens.  
- [ ] Implementar componentes base del design system: Button, Input, Card, Tabs, Calendar, Table, Navigation (BottomBar, Sidebar).  
- [ ] Validar contraste de todos los pares de color con herramienta automática (axe-core).  
- [ ] Integrar Headless UI/Radix para comportamiento accesible en tabs, dialogs y disclosure.  
- [ ] Desarrollar pantalla de Inicio con los tres widgets y carga optimista.  
- [ ] Crear flujo de Horario con vista semanal y diaria, probando la respuesta táctil y de teclado.  
- [ ] Implementar sección de Tareas con filtros y cambio de estado (pendiente/completada).  
- [ ] Desarrollar módulo de Calificaciones respetando privacidad (sin mostrar datos en pantalla de bloqueo).  
- [ ] Construir sistema de notificaciones con agrupación y badge.  
- [ ] Realizar pruebas de usabilidad con al menos 15 estudiantes de distintos niveles, recogiendo tiempos de tarea y errores.  
- [ ] Ajustar jerarquía de Inicio según hallazgos de usabilidad (test A/B si es necesario).  
- [ ] Auditoría de accesibilidad con VoiceOver, NVDA y navegación por teclado.  
- [ ] Documentar el design system en Storybook con descripciones de uso y tokens.  
- [ ] Configurar CI para verificar contraste y presencia de atributos ARIA.  
- [ ] Planificar estrategia de cacheo y sincronización offline para horarios y tareas.  
- [ ] Lanzamiento gradual (beta) con recopilación de métricas de rendimiento y satisfacción (SUS).