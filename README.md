# ChatArchive 💬📦

**ChatArchive** es una aplicación web progresiva (PWA) de alto rendimiento, diseñada para importar, organizar, visualizar, buscar y conservar conversaciones exportadas de WhatsApp en un entorno **100% privado, local y sin conexión**.

---

## 🌟 Pilares del Proyecto

1. **Privacidad Absoluta**: No existe backend, base de datos remota ni envío de conversaciones a servidores externos. Todo el procesamiento y almacenamiento se realiza en el dispositivo del usuario mediante **IndexedDB** y **Web Workers**.
2. **PWA Offline**: Funciona sin conexión mediante un **Service Worker** local y **Web App Manifest**, instalable en Android y Windows PC.
3. **Diseño Profesional con Bootstrap 5.3**: Interfaz limpia, responsiva y cuidada, con modo claro y modo oscuro. Iconografía oficial estricta con **Bootstrap Icons** (sin emojis para navegación o iconos de interfaz).
4. **Despliegue Gratuito en GitHub Pages**: Rutas totalmente relativas (`./`), compatible con subdirectorios y sin dependencias de servidor.

---

## 📂 Estructura del Proyecto

```text
ChatArchive/
├── index.html                   # Documento principal y contenedor de vistas
├── manifest.json                # Manifiesto PWA para instalación
├── sw.js                        # Service Worker para caché offline
├── README.md                    # Documentación del proyecto
│
├── assets/
│   ├── icons/                   # Iconos de la aplicación (SVG y PNG 192/512)
│   ├── images/                  # Ilustraciones y recursos visuales
│   └── logo/                    # Logotipo vectorial SVG de ChatArchive
│
├── vendor/                      # Dependencias locales (sin CDN)
│   ├── bootstrap/               # Bootstrap 5.3.3 (CSS y JS Bundle)
│   ├── bootstrap-icons/         # Bootstrap Icons 1.11.3 (CSS y fuentes WOFF2/WOFF)
│   └── jszip/                   # JSZip 3.10.1 para procesamiento de archivos ZIP
│
├── css/
│   ├── style.css                # Variables CSS, reset y paleta de color
│   ├── components.css           # Estilos para navbar, tarjetas, dropzone y modales
│   ├── chat.css                 # Estilos específicos del visor de conversación
│   └── responsive.css           # Adaptabilidad para móvil (Bottom Nav) y desktop
│
├── js/
│   ├── app.js                   # Punto de entrada e inicialización de la PWA
│   ├── core/
│   │   ├── config.js            # Constantes y configuración global
│   │   ├── state.js             # Gestor reactivo de estado y temas
│   │   └── router.js            # Enrutador cliente basado en hash para GitHub Pages
│   │
│   ├── database/                # [Etapa 3] Controladores de IndexedDB
│   │   ├── db.js
│   │   ├── conversations.js
│   │   └── messages.js
│   │
│   ├── import/                  # Controladores de importación y parser
│   │   ├── importer.js          # Vista drag & drop y guías paso a paso
│   │   ├── zip-reader.js        # [Etapa 2] Extractor de ZIP con JSZip
│   │   ├── txt-reader.js        # [Etapa 2] Lector de archivos de texto plano
│   │   ├── parser.js            # [Etapa 2] Parser modular de WhatsApp
│   │   └── media-handler.js     # [Etapa 2] Gestor de fotos, audios y documentos
│   │
│   ├── views/                   # Vistas principales de la aplicación
│   │   ├── dashboard.js         # Panel de inicio con métricas y accesos rápidos
│   │   ├── library.js           # Biblioteca con filtros, búsqueda y vistas
│   │   ├── chat-viewer.js       # [Etapa 4] Visor de mensajes y burbujas
│   │   ├── search.js            # [Etapa 5] Buscador avanzado de mensajes
│   │   └── settings.js          # Preferencias, tema y gestión de almacenamiento
│   │
│   ├── backup/                  # [Etapa 6] Respaldos y restauración ZIP/JSON
│   │   ├── export.js
│   │   └── restore.js
│   │
│   └── utils/
│       ├── helpers.js           # Funciones de formato, seguridad y toasts
│       ├── dates.js             # [Etapa 2] Formateador y validador de fechas
│       └── validation.js        # [Etapa 2] Validación de archivos seguros
│
└── workers/                     # Web Workers para operaciones pesadas
    ├── parser-worker.js         # [Etapa 2] Procesamiento de chats gigantes en segundo plano
    └── search-worker.js         # [Etapa 5] Búsqueda indexada en miles de mensajes
```

---

## 🚀 Estado de Desarrollo por Etapas

- [x] **ETAPA 1 — Fundación y Diseño**:
  - Estructura modular completa creada.
  - Bootstrap 5.3.3 y Bootstrap Icons 1.11.3 instalados localmente.
  - Identidad visual, logo vectorial SVG e iconos PWA (192 y 512).
  - Dashboard responsive con tarjetas estadísticas y banner de privacidad local.
  - Enrutador hash para GitHub Pages (`#dashboard`, `#library`, `#import`, `#settings`).
  - Navegación superior y barra inferior de navegación táctil para móviles (Bottom Nav).
  - Modo claro y oscuro con detección automática y guardado de preferencias.
  - Pantalla inicial de importación con zona drag & drop y guías paso a paso (Android e iOS).
  - Manifiesto PWA y Service Worker con precaché offline completo.
- [ ] **ETAPA 2 — Importación y Parser**:
  - Lectura de archivos TXT y descompresión de ZIPs de WhatsApp con JSZip.
  - Reconocimiento multiformato de fechas (DD/MM/YY, DD/MM/YYYY, 12h/24h, mensajes de sistema).
  - Extracción y correlación de archivos multimedia adjuntos.
- [ ] **ETAPA 3 — Base de Datos Local**:
  - Implementación completa de IndexedDB para chats, mensajes y archivos Blob.
- [ ] **ETAPA 4 — Visor de Conversaciones**:
  - Renderizado de burbujas tipo chat, separadores de fecha y carga progresiva.
  - Controles para saltar al primer y último mensaje.
- [ ] **ETAPA 5 — Búsqueda Avanzada**:
  - Localización de términos, nombres y fechas con resaltado visual y navegación entre coincidencias.
- [ ] **ETAPA 6 — Respaldos y Restauración**:
  - Generación y restauración de copias de seguridad en ZIP y JSON.
- [ ] **ETAPA 7 — PWA y Optimización Final**:
  - Auditoría Lighthouse, seguridad ZIP Slip y validación final.

---

## 🛠️ Cómo Probar Localmente

1. Abre el directorio del proyecto en un servidor local (por ejemplo Laragon en `http://localhost/-CHATARCHIVE/` o `npx serve .` o `python -m http.server 8000`).
2. También puede abrirse directamente o desplegarse en cualquier rama de **GitHub Pages**.
3. Prueba la alternancia entre Modo Claro y Modo Oscuro desde el botón de la barra superior o en la vista de Ajustes.
4. Navega entre las vistas de Inicio, Biblioteca, Importar y Ajustes.
5. Comprueba la vista móvil achicando la ventana del navegador para verificar la barra inferior táctil (Bottom Navigation).
