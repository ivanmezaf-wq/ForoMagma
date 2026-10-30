# ⚡ ForoMagma — Plataforma Colaborativa de Ingeniería, Kanban & Vigilancia Tecnológica (Tesis Baterías Ion-Litio)

**ForoMagma** es un ecosistema web colaborativo en tiempo real, diseñado bajo una estética editorial técnica (*estilo TaganAzul*) con soporte de **Modo Oscuro**, creado para gestionar integralmente el proyecto de tesis en **Ingeniería Electrónica** enfocado en **Baterías de Ion de Litio, Segunda Vida, Sistemas de Gestión de Baterías (BMS), Estado de Salud (SoH), Estado de Carga (SoC) y Carga Rápida** desde Santa Marta, Colombia.

---

## 🔗 Enlaces Oficiales del Proyecto

| Recurso | Enlace Directo | Descripción |
| :--- | :--- | :--- |
| **🌐 Aplicación Web en Producción (GitHub Pages)** | [https://ivanmezaf-wq.github.io/ForoMagma/](https://ivanmezaf-wq.github.io/ForoMagma/) | Plataforma interactiva accesible desde cualquier PC o móvil. |
| **💻 Repositorio Oficial en GitHub** | [https://github.com/ivanmezaf-wq/ForoMagma](https://github.com/ivanmezaf-wq/ForoMagma) | Código fuente, scripts en Python, base bibliográfica y control de versiones. |
| **🔥 Consola de Google Firebase** | [https://console.firebase.google.com/project/foromagma-7365e](https://console.firebase.google.com/project/foromagma-7365e) | Base de datos Cloud Firestore y Storage (`foromagma-7365e`, Plan Spark 100% gratuito). |
| **🏛️ Descubridor Tayrona (Unimagdalena)** | [https://descubridor.unimagdalena.edu.co/](https://descubridor.unimagdalena.edu.co/) | Motor de búsqueda de la Biblioteca Germán Bula Meyer (Santa Marta). |
| **📚 Repositorio Institucional Unimagdalena** | [https://repositorio.unimagdalena.edu.co/handle/123456789/2](https://repositorio.unimagdalena.edu.co/handle/123456789/2) | Tesis de grado de la Facultad de Ingeniería (Protocolo OAI-PMH). |
| **🔬 OpenAlex REST API** | [https://api.openalex.org/works](https://api.openalex.org/works) | API científica abierta para búsqueda y sincronización automática (2010–2026). |
| **📖 Crossref REST API** | [https://api.crossref.org/works](https://api.crossref.org/works) | Agencia oficial registradora de DOIs científicos mundiales. |
| **📄 arXiv API** | [http://export.arxiv.org/api/query](http://export.arxiv.org/api/query) | Repositorio de preprints de la Universidad de Cornell. |

---

## 🏗️ Arquitectura Técnica y Módulos del Sistema

La plataforma está dividida en **4 paneles principales interactivos**, sincronizados en tiempo real mediante **Google Firebase Cloud Firestore** con respaldo automático en `localStorage` para funcionamiento offline:

### 1. 📋 Tablero Kanban (Gestión de Tareas por Pilares)
* **5 Columnas de Flujo:**
  1. `Por Hacer` (`todo`)
  2. `En Proceso` (`doing`)
  3. `En Revisión / Pruebas` (`review`)
  4. `Bloqueado` (`blocked`)
  5. `Completado` (`done`)
* **4 Pilares Técnicos de la Tesis:**
  * 💻 **Embebidos & Firmware (`emb`):** Microcontroladores, adquisición ADC, protocolos I2C/SPI/CAN/UART.
  * 🔌 **Circuitos & PCB (`pcb`):** Diseño esquemático, ruteo multicapa, aislamiento galvánico y BOM.
  * ⚡ **Control & Potencia (`ctl`):** Balanceo activo/pasivo de celdas, MOSFETs, convertidores DC-DC, algoritmos SoC/SoH.
  * 🎓 **Documentación & Tesis (`doc`):** Marco teórico, metodología PRISMA, normas IEEE y redacción de capítulos.
* **Progreso Automático:** Barra porcentual que calcula dinámicamente el avance global del proyecto según las tarjetas completadas.

### 2. 💬 Muro de Avances y Discusión (Foro Técnico)
* **Publicaciones en Tiempo Real:** Redacción de reportes con autor, título, cuerpo con detección automática de enlaces (`linkify`) y carga directa de archivos adjuntos (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.png`, `.jpg`, `.zip` hasta 20 MB).
* **Acordeón Desplegable de Comentarios:** Discusión organizada por cada publicación sin saturar la vista principal.
* **Confirmación de Lectura (`Visto 👁️`):** Registro de qué integrantes han revisado cada avance.
* **Extractor Automático de Enlaces + Semáforo Lateral:** Todos los links compartidos en los posts se indexan automáticamente en la barra lateral derecha con su propio semáforo de clasificación (`🟢`, `🟡`, `🔴`).

### 3. 🔗 Matriz de Dependencias (Ingeniería de Sistemas)
* Tabla cruzada de entradas y salidas técnicas entre los 4 pilares de la tesis (*Embebidos*, *Circuitos & PCB*, *Control & Potencia*, *Documentación*), asegurando que ningún bloque de hardware o firmware quede desarticulado del documento final.

### 4. 📚 Repositorio Académico & APIs (Vigilancia Tecnológica 2010–2026)
* **Auto-Sync al Entrar a la Página (`autoSyncOpenAlex`):** Cada vez que un usuario abre la web, el navegador consulta asíncronamente la API de OpenAlex (rango **2010 a 2026**) usando el *Polite Pool* (`mailto`), reconstruye los resúmenes desde el `abstract_inverted_index`, verifica duplicados por DOI/título e inserta las publicaciones más recientes ordenadas cronológicamente (de **2026 a 2010**).
* **7 Categorías Especializadas de Baterías de Ion de Litio:**
  1. `🔄 Segunda Vida` (Second-life EV batteries, repurposing)
  2. `🛡️ BMS Segunda Vida` (Battery Management Systems for aged cells)
  3. `📐 BMS Estándares` (Active/passive balancing, thermal management, safety standards)
  4. `🔋 SoH (Salud)` (State of Health estimation, aging, EIS, capacity fade, RUL)
  5. `📊 SoC (Carga)` (State of Charge, Kalman Filter, Coulomb counting, OCV)
  6. `⚡ Carga Rápida & Ciclos` (Fast charging protocols, lithium plating, cycle life testing)
  7. `🇨🇴 Colombia / LatAm` (Investigaciones locales en Santa Marta, Unimagdalena, UNAL, UIS, UniAndes y Latinoamérica)
* **Sistema de Semáforo PRISMA (`🟢` / `🟡` / `🔴`):**
  * `🟢 Verde (Aprobado / Incluido)`: Artículos seleccionados para citar en la tesis.
  * `🟡 Amarillo (En Revisión)`: Artículos en lectura o evaluación metodológica.
  * `🔴 Rojo (Descartado)`: Artículos excluidos del estado del arte.
* **Conector Descubridor Tayrona (Unimagdalena):** Accesos directos parametrizados al catálogo Primo de la Biblioteca Germán Bula Meyer y al Repositorio DSpace de la Facultad de Ingeniería.
* **Exportación Bibliográfica Instantánea:**
  * **Descargar `.bib` (BibTeX):** Listo para importar en Zotero, Mendeley o Overleaf/LaTeX.
  * **Descargar `.md` (Markdown):** Reporte estructurado con DOIs, autores, citas y resúmenes.
  * **Copiar BibTeX individual** en cada tarjeta.

---

## 📂 Estructura de Archivos del Proyecto

```text
ForoMagma/
├── index.html                        # Interfaz principal con los 4 paneles y modales
├── README.md                         # Documentación general y técnica del proyecto
├── DOCUMENTACION_TECNICA.md          # Manual técnico detallado de arquitectura, APIs y scripts
├── css/
│   └── styles.css                    # Sistema de diseño TaganAzul, Modo Oscuro, Kanban y Semáforo
├── js/
│   ├── firebase-config.js            # Credenciales y conexión con Firebase (Firestore + Storage)
│   ├── storage.js                    # Capa de persistencia en tiempo real (Posts, Kanban, Ratings)
│   ├── papers_data.js                # Base de datos precargada de artículos verificados (2010-2026)
│   ├── avatars.js                    # Generador de identidades y avatares técnicos SVG
│   └── app.js                        # Lógica principal UI, Auto-Sync OpenAlex, Semáforo y Exportadores
├── scripts/
│   ├── buscador_academico.py         # Motor CLI en Python para OpenAlex, Crossref, arXiv y Semantic Scholar
│   ├── recolectar_temas_tesis.py     # Recolector automatizado para las 7 temáticas de baterías (2010-2026)
│   └── requirements.txt              # Dependencias de Python (requests)
├── referencias_tesis_baterias.bib    # Compilado BibTeX de artículos recolectados
├── resultados_tesis_baterias.json    # Metadatos completos en formato JSON
└── resultados_tesis_baterias.md      # Reporte bibliográfico en Markdown
```

---

## 🐍 Uso de los Scripts de Python (Recolección Manual / Avanzada)

El proyecto incluye dos scripts en la carpeta `scripts/` por si deseas ejecutar búsquedas masivas desde tu computador:

### 1. Instalación de dependencias
```powershell
pip install -r scripts/requirements.txt
```

### 2. Búsqueda personalizada por consola (`buscador_academico.py`)
```powershell
python scripts/buscador_academico.py "lithium ion battery second life BMS" -n 15 --desde 2010 -o mi_busqueda.md
```
* Consulta simultáneamente **OpenAlex, Crossref, arXiv y Semantic Scholar**.
* Verifica que los enlaces DOI y PDF respondan con código HTTP válido (`200-399`) usando `ThreadPoolExecutor`.
* Exporta automáticamente `.md`, `.json` y `.bib`.

### 3. Recolector completo de los 7 temas de la tesis (`recolectar_temas_tesis.py`)
```powershell
python scripts/recolectar_temas_tesis.py
```
* Recorre todas las categorías de la tesis entre **2010 y 2026**, elimina duplicados, ordena del más reciente al más antiguo y actualiza automáticamente `js/papers_data.js`, `resultados_tesis_baterias.md` y `referencias_tesis_baterias.bib`.

---

## 🗄️ Estructura de Colecciones en Firebase Cloud Firestore

El proyecto utiliza 3 colecciones en tiempo real dentro del proyecto `foromagma-7365e`:

1. **`posts`**: Almacena los avances del foro (`id`, `title`, `author`, `content`, `attachments`, `comments`, `vistos`, `createdAt`).
2. **`kanban_tasks`**: Almacena las tarjetas del tablero Kanban (`id`, `pillar`, `title`, `desc`, `person`, `status`).
3. **`ratings` (documento `classification_map`)**: Almacena el estado del semáforo (`green`, `yellow`, `red`) tanto de los artículos científicos (`papers`) como de los enlaces compartidos en el muro (`links`).
