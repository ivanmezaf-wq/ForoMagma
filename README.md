# ⚡ ForoMagma - Foro de Investigación y Tesis en Electrónica

**ForoMagma** es una plataforma web colaborativa, moderna y 100% responsiva diseñada para documentar avances de tesis, compartir reportes técnicos, discutir esquemáticos y debatir sobre electrónica con tus compañeros y asesores.

---

## 🚀 Características Principales

* **Feed Central de Publicaciones:** Enfoque prioritario en el contenido técnico en el centro de la pantalla.
* **Subida de Documentos:** Compatible con **PDF**, **Microsoft Word (`.docx`, `.doc`)**, **Excel (`.xlsx`, `.xls`)**, **PowerPoint (`.pptx`)**, imágenes de circuitos y esquemáticos.
* **Sistema de Identidad Simple:**
  * Requisito breve: **Nombre y Apellido**.
  * Opción de **subir una foto de perfil** o **generar automáticamente un avatar tecnológico** único basado en iniciales y circuitos.
* **Comentarios y Discusión Abierta:**
  * Cualquier persona que tenga el enlace puede entrar a leer y comentar de inmediato.
  * Botones de "Útil" (Likes) y compartir enlace directo a publicaciones específicas.
* **Categorías de Electrónica:**
  * 💻 Sistemas Embebidos (STM32, ESP32, FPGA, PIC)
  * 🔌 Circuitos y PCB (Altium, KiCad, Eagle, ruteo)
  * ⚡ Potencia y Control (Fuentes conmutadas, inversores, drivers)
  * 📡 Sensores e IoT (Transductores, instrumentación, telemetría)
  * 📶 Telecomunicaciones y RF
  * 🎓 Avances de Tesis y Metodología
* **100% Responsivo:** Adaptado a pantallas de teléfonos móviles, tablets y ordenadores de escritorio.
* **Sin configuración de bases de datos complejas:** Funciona en el navegador usando almacenamiento persistente local (`IndexedDB`) y está listo para ser alojado de forma gratuita en **GitHub Pages**.

---

## 🌐 Cómo publicar tu página en GitHub Pages (en tu repositorio `ivanmezaf-wq`)

Sigue estos sencillos pasos para tener tu foro en línea:

### Opción A: Desde la página web de GitHub (Sin comandos)
1. Entra a tu cuenta en [GitHub.com](https://github.com) y ve a tu repositorio (`ivanmezaf-wq` o el repositorio que creaste para la tesis).
2. Haz clic en **Add file** -> **Upload files**.
3. Arrastra todos los archivos de esta carpeta:
   * `index.html`
   * carpeta `css/` (con `styles.css`)
   * carpeta `js/` (con `app.js`, `avatars.js`, `storage.js`)
   * `README.md`
4. Haz clic en **Commit changes**.
5. Ve a la pestaña **Settings** (Configuración) de tu repositorio.
6. En el menú lateral izquierdo, haz clic en **Pages**.
7. En la sección **Build and deployment > Branch**, selecciona la rama `main` (o `master`) y la carpeta `/ (root)`.
8. Haz clic en **Save**. ¡Listo! En 1 o 2 minutos tu página estará activa en:
   ```
   https://ivanmezaf-wq.github.io/<nombre-del-repositorio>/
   ```

### Opción B: Mediante Git en tu terminal
```bash
# Entrar a la carpeta del proyecto
cd "C:\Users\LENOVO\.gemini\antigravity\scratch\ForoMagma"

# Inicializar Git
git init
git branch -M main

# Conectar con tu repositorio de GitHub
git remote add origin https://github.com/ivanmezaf-wq/<tu-repositorio>.git

# Guardar y subir
git add .
git commit -m "Lanzamiento oficial de ForoMagma para avances de tesis"
git push -u origin main
```

---

## 🎨 Paleta de Colores
* **Blanco y Azul Tecnológico:**
  * Azul Primario: `#2563eb` y `#1e3a8a`
  * Fondos: `#ffffff` y `#f8fafc`
  * Acentos de Estado: Verde `#16a34a`, Cian `#0284c7`, Rojo PDF `#dc2626`.
