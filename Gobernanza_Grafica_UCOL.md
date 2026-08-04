# Manual Técnico de Identidad Gráfica y UX/UI
## Universidad de Colima (UCOL) - Gobernanza Visual para Aplicaciones

Este documento establece la gobernanza visual y técnica para todas las aplicaciones y plataformas desarrolladas por las distintas dependencias de la universidad. Su propósito es garantizar una identidad gráfica unificada, accesible y funcional en todo el ecosistema digital de la institución.

---

## 1. Filosofía de Diseño

El sistema adopta un **Minimalismo Funcional con fundamentos del Diseño Suizo y Accesibilidad como núcleo (Accessibility-Core)**.

- **Estilos Descartes**: Neumorphism, glassmorphism, brutalismo sin pulir, o Material Design 3 puro sin adaptar (por su exceso de color y elevación).
- **Justificación**: Se prioriza la legibilidad, la claridad y la reducción del ruido visual para evitar la fatiga cognitiva del usuario.

---

## 2. Sistema Visual y de Espaciado

### 2.1. Grid y Espaciado
- **Módulo base**: 4 px (todas las medidas deben ser múltiplos de 4).
- **Escala permitida**: 4, 8, 12, 16, 24, 32, 48, 64 px.
- **Márgenes de pantalla**: 16 px (Móvil) / 24 px (Escritorio).
- **Columnas**:
  - **Móvil**: 4 columnas fluidas.
  - **Tablet**: 8 columnas.
  - **Escritorio**: 12 columnas (ancho máximo de contenido 1280 px centrado).
- **Breakpoints**:
  - `sm`: 640 px
  - `md`: 1024 px
  - `lg`: 1280 px
  - `xl`: 1536 px (el contenido se mantiene a 1280 px máximo).

### 2.2. Jerarquía de Contenidos
Ningún contenedor usa sombras para definir jerarquías. La separación visual se logra exclusivamente mediante:
- Bordes sutiles de 1 px (`#E0E0E0` o `#B4B4B4`).
- Espaciado vertical (16–24 px).
- Contraste tipográfico.

---

## 3. Tipografía

- **Principal**: **Inter** (sans-serif), por su excelente legibilidad en pantallas.
- **Secundaria**: Fuente del sistema (`system-ui`) para datos numéricos o interfaces embebidas.

**Escala (Basada en 16 px):**
- `text-xs` (12 px): Metadatos, badges.
- `text-sm` (14 px): Texto secundario.
- `text-base` (16 px): Cuerpo, controles de formulario. (Tamaño mínimo recomendado).
- `text-lg` (18 px): Títulos de tarjetas.
- `text-xl` (20 px): Encabezados de sección.
- `text-2xl` (24 px): Títulos de pantalla.
- `text-3xl` (30 px): Encabezado principal (Inicio).

**Interlineado (Line-height):**
- Títulos: `1.2` (Tight)
- Cuerpo de texto: `1.5` (Normal)

---

## 4. Sistema de Color

Definido bajo estándares **WCAG 2.2 AA** (Contraste ≥4.5:1 para texto normal y ≥3:1 para texto grande).

| Uso | Color | HEX | Pantone | Contraste vs Blanco |
| :--- | :--- | :--- | :--- | :--- |
| **Primario** (Estructura, Nav) | Verde Obscuro | `#527630` | 364 | 5.26 : 1 |
| **Secundario** (Interactividad) | Azul / Teal | `#006096` | 647 | 6.74 : 1 |
| **Fondo (Pantalla)** | Gris muy claro | `#FAFAFA` | - | N/A |
| **Fondo (Tarjetas)** | Gris muy claro | `#FAFAFA` | - | N/A |
| **Texto Primario** | Casi Negro | `#1A1A1A` | - | 17.8 : 1 |
| **Texto Secundario** | Gris Obscuro | `#4E4D4D` | 425 | 8.32 : 1 |
| **Bordes** | Gris Claro | `#B4B4B4` | 421 | N/A |
| **Enfoque (Focus)** | Anillo 2px | `#006096` | 647 | 6.74 : 1 |

**Colores de Estado:**
- **Error**: `#770F00` (Pantone 1815) - Contraste 11.35 : 1
- **Éxito**: `#527630` (Pantone 364) - Contraste 5.26 : 1
- **Advertencia**: `#FBB034` (Pantone 137, solo para íconos con etiqueta textual en texto secundario)

---

## 5. Componentes y Sistema de Diseño (Design System)

Todos los componentes deben definir sus estados: `default`, `hover`, `focus`, `active`, `disabled`.
**Regla de Oro**: Cero sombras.

- **Botones**
  - **Primario**: Fondo Teal (`#0D7377`), texto blanco, borde redondeado de 8 px. Altura mínima: 44 px.
  - **Secundario**: Borde Teal, fondo transparente.
  - **Texto**: Solo texto, con subrayado al hacer `hover`.
  - **Estados**: `focus` visible con anillo exterior; `disabled` con opacidad al 38%.
- **Inputs de Formulario**
  - Borde inferior de 1 px (`#BDBDBD`), altura de 44 px.
  - Error: Borde inferior rojo (`#C62828`) acompañado de mensaje descriptivo de texto.
- **Tarjetas (Cards)**
  - , borde de 1 px (`#E0E0E0`), padding interno de 16 px. Sin sombra.
- **Navegación**
  - **Móvil**: Barra inferior (56 px altura). Íconos + Texto (10 px). Estado activo usa el color Primario.
  - **Escritorio**: Barra superior u orientada al lateral (Sidebar de 240 px o colapsado de 64 px). Item activo usa fondo `#EBF0F5` y texto Primario.
- **Tablas**
  - Estructura limpia con líneas divisorias horizontales (`#E0E0E0`).
  - Scroll con encabezados fijos (`sticky`). Cebra opcional (`#F5F5F5`).

---

## 6. Principios de UX Priorizados

1. **Eficiencia**: La información crítica debe ser visible en menos de 3 segundos.
2. **Ley de Fitts**: Área interactiva mínima de 44x44 px en todos los controles tocables.
3. **Flujos Cortos**: Máximo 2 toques/clics para acceder a la funcionalidad principal (ej. consultar el próximo examen = 1 clic).
4. **Foco Único**: Cada pantalla debe tener una sola acción principal evidente.
5. **Legibilidad**: Texto legible sin requerir zoom adicional (Base 16px en móvil).
6. **Estados de Carga**: Uso de esqueletos (skeleton) y carga optimista.
7. **Feedback Inmediato**: Retroalimentación clara y rápida en envíos de formularios o acciones destructivas.
8. **Orientación Predecible**: El usuario debe saber siempre en dónde está situado dentro de la app.
9. **Consistencia Total**: Las vistas similares deben comportarse de forma idéntica en toda la app.

---

## 7. Accesibilidad Transversal (a11y)

- Soporte absoluto para navegación por teclado (tabindex lógico).
- Contraste validado automáticamente en pipeline CI/CD.
- El contenido dinámico debe anunciarse mediante atributos `aria-live`.
- Respeto por `prefers-reduced-motion`: eliminación de animaciones no esenciales para usuarios sensibles al movimiento.

---

## 8. Especificación Técnica y Arquitectura

Para los desarrollos en la UCOL se recomienda el siguiente Stack Tecnológico Base:

1. **Framework Frontend**: React (Next.js con App Router). Se recomienda renderizado híbrido para carga rápida inicial (SSR/SSG).
2. **Estilado**: Tailwind CSS configurado con Design Tokens de la institución a través de variables CSS.
3. **Componentes sin estilo previo (Headless)**: Uso de librerías como Headless UI o Radix UI para garantizar los atributos de accesibilidad en elementos complejos (modales, popovers, tabs) aplicando nuestras reglas visuales (clases de Tailwind).
4. **Gestión de Datos y Caché**: React Query (TanStack Query) aplicando patrón *stale-while-revalidate*. Permite la visualización de datos críticos (horarios, tareas) incluso en condiciones de nula o baja conectividad.

*Este documento actúa como la única fuente de verdad (Single Source of Truth) para la gobernanza gráfica institucional.*
