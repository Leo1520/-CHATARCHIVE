/**
 * ChatArchive - Floating Active Bottom Navigation Bar Component
 * Recrea fielmente el diseño de la Imagen 2 de referencia:
 * - Barra horizontal de color negro (#000000)
 * - Elemento activo en círculo blanco (#FFFFFF) que sobresale de la barra
 * - Icono y texto del elemento activo en color negro (#000000)
 * - Elementos inactivos con iconos y textos en color blanco (#FFFFFF)
 * - Muesca cóncava suave en SVG que se desplaza fluidamente
 * - Animación de 300 ms con aceleración natural
 */

export const BOTTOM_NAV_CONFIG = {
  component: "BottomNavigationBar",
  type: "floating_active_item",
  theme: {
    barBackground: "#000000",
    barHeight: 78,
    borderRadius: 24,
    inactiveColor: "#FFFFFF",
    activeItem: {
      backgroundColor: "#FFFFFF",
      iconColor: "#000000",
      labelColor: "#000000",
      circleSize: 64,
      elevationShadow: "0 10px 24px rgba(0, 0, 0, 0.5)"
    },
    animation: {
      durationMs: 300
    }
  },
  items: [
    {
      id: "dashboard",
      label: "Inicio",
      icon: "bi-house-door",
      route: "#dashboard"
    },
    {
      id: "library",
      label: "Biblioteca",
      icon: "bi-collection",
      route: "#library"
    },
    {
      id: "import",
      label: "Importar",
      icon: "bi-cloud-arrow-up",
      route: "#import"
    },
    {
      id: "settings",
      label: "Ajustes",
      icon: "bi-gear",
      route: "#settings"
    }
  ]
};

class BottomNavigationComponent {
  constructor(config = BOTTOM_NAV_CONFIG) {
    this.config = config;
    this.container = null;
    this.svgPath = null;
    this.bubble = null;
    this.bubbleIcon = null;
    this.bubbleLabel = null;
    this.itemsElements = [];
    this.activeIndex = 0;
    this.currentCenterX = 0;
    this.targetCenterX = 0;
    this.animating = false;
    this.animationStartTime = 0;
    this.animationStartPos = 0;
  }

  /**
   * Inicializa y monta el componente en el contenedor del DOM
   * @param {HTMLElement} mountElement
   */
  init(mountElement) {
    if (!mountElement) return;
    this.container = mountElement;
    this.render();
    this.setupListeners();

    // Sincronizar ruta inicial
    this.syncWithCurrentRoute();
  }

  /**
   * Genera el marcado HTML y SVG del componente
   */
  render() {
    const { items, theme } = this.config;
    const initialItem = items[this.activeIndex] || items[0];

    this.container.innerHTML = `
      <div class="ca-bnav-bar" id="caBnavBar">
        <!-- Fondo SVG con corte cóncavo suave -->
        <svg class="ca-bnav-svg-bg" id="caBnavSvg" preserveAspectRatio="none">
          <path class="ca-bnav-svg-path" id="caBnavPath" d=""></path>
        </svg>

        <!-- Círculo Blanco Flotante (Icono y Texto negros) -->
        <div class="ca-bnav-active-bubble" id="caBnavBubble" aria-hidden="true">
          <i class="bi ${initialItem.icon} ca-bnav-active-icon" id="caBnavBubbleIcon"></i>
          <span class="ca-bnav-active-label" id="caBnavBubbleLabel">${initialItem.label}</span>
        </div>

        <!-- Lista de opciones de navegación -->
        <ul class="ca-bnav-items-list" role="tablist">
          ${items.map((item, idx) => `
            <li class="ca-bnav-item ${idx === this.activeIndex ? 'is-active' : ''}" 
                data-nav-id="${item.id}" 
                data-nav-index="${idx}"
                role="tab" 
                aria-selected="${idx === this.activeIndex}">
              <a href="${item.route}" class="ca-bnav-item-content text-decoration-none" aria-label="${item.label}">
                <i class="bi ${item.icon} ca-bnav-icon"></i>
                <span class="ca-bnav-label">${item.label}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    this.barElement = this.container.querySelector('#caBnavBar');
    this.svgPath = this.container.querySelector('#caBnavPath');
    this.bubble = this.container.querySelector('#caBnavBubble');
    this.bubbleIcon = this.container.querySelector('#caBnavBubbleIcon');
    this.bubbleLabel = this.container.querySelector('#caBnavBubbleLabel');
    this.itemsElements = Array.from(this.container.querySelectorAll('.ca-bnav-item'));

    // Calcular posición inicial tras layout
    requestAnimationFrame(() => {
      this.updatePositions(false);
    });
  }

  /**
   * Configura listeners de eventos (clic, hashchange y resize)
   */
  setupListeners() {
    // 1. Clics en las opciones
    this.itemsElements.forEach((el) => {
      el.addEventListener('click', (e) => {
        const idx = parseInt(el.getAttribute('data-nav-index'), 10);
        if (!isNaN(idx) && idx !== this.activeIndex) {
          this.setActiveIndex(idx);
        }
      });
    });

    // 2. Cambio de hash en la URL
    window.addEventListener('hashchange', () => {
      this.syncWithCurrentRoute();
    });

    // 3. Redimensionamiento de ventana
    window.addEventListener('resize', () => {
      this.updatePositions(false);
    });
  }

  /**
   * Sincroniza el elemento activo según el hash actual
   */
  syncWithCurrentRoute() {
    const hash = window.location.hash || '#dashboard';
    const cleanHash = hash.split('?')[0];

    let targetIndex = 0;
    if (cleanHash === '#chat') {
      // Si está en el visor de chat, el origen activo es Biblioteca
      targetIndex = 1;
    } else {
      const foundIdx = this.config.items.findIndex(item => item.route === cleanHash);
      if (foundIdx !== -1) {
        targetIndex = foundIdx;
      }
    }

    if (targetIndex !== this.activeIndex) {
      this.setActiveIndex(targetIndex);
    }
  }

  /**
   * Cambia el elemento activo y lanza la animación
   * @param {number} newIndex
   */
  setActiveIndex(newIndex) {
    if (newIndex < 0 || newIndex >= this.config.items.length) return;

    this.activeIndex = newIndex;
    const activeItem = this.config.items[newIndex];

    // Actualizar estados visuales de las clases
    this.itemsElements.forEach((el, idx) => {
      const isCurrent = idx === newIndex;
      el.classList.toggle('is-active', isCurrent);
      el.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });

    // Iniciar animación cinemática hacia la nueva posición
    this.animateToActive(activeItem);
  }

  /**
   * Recalcula la posición central del elemento activo
   * @param {number} index
   * @returns {number} Coordenada X central en píxeles
   */
  getItemCenterX(index) {
    if (!this.barElement) return 0;
    const width = this.barElement.offsetWidth || window.innerWidth;
    const count = this.config.items.length;
    const itemWidth = width / count;
    return (index * itemWidth) + (itemWidth / 2);
  }

  /**
   * Dibuja la curva SVG de la barra con la concavidad exacta
   * @param {number} centerX Posición horizontal del centro del hueco
   */
  drawSvgPath(centerX) {
    if (!this.svgPath || !this.barElement) return;

    const width = this.barElement.offsetWidth || window.innerWidth;
    const height = this.config.theme.barHeight;
    const radius = this.config.theme.borderRadius;

    // Dimensiones del hueco cóncavo (notch suave)
    const cutHalfWidth = 42;
    const cutDepth = 30;

    const xLeft = Math.max(radius, centerX - cutHalfWidth);
    const xRight = Math.min(width - radius, centerX + cutHalfWidth);

    // Trazado Bézier fluido:
    // 1. Esquina superior izquierda redondeada
    // 2. Línea recta hasta el inicio del hueco
    // 3. Curva cóncava suave descendente y ascendente
    // 4. Línea recta hasta esquina superior derecha redondeada
    // 5. Cierre rectangular por la base
    const d = [
      `M 0 ${radius}`,
      `Q 0 0 ${radius} 0`,
      `L ${xLeft} 0`,
      `C ${centerX - 24} 0, ${centerX - 20} ${cutDepth}, ${centerX} ${cutDepth}`,
      `C ${centerX + 20} ${cutDepth}, ${centerX + 24} 0, ${xRight} 0`,
      `L ${width - radius} 0`,
      `Q ${width} 0 ${width} ${radius}`,
      `L ${width} ${height}`,
      `L 0 ${height}`,
      `Z`
    ].join(' ');

    this.svgPath.setAttribute('d', d);
  }

  /**
   * Actualiza posiciones inmediatamente sin animación (ej. resize o carga inicial)
   */
  updatePositions(animate = true) {
    const targetX = this.getItemCenterX(this.activeIndex);
    this.currentCenterX = targetX;
    this.targetCenterX = targetX;

    const bubbleSize = this.config.theme.activeItem.circleSize;
    if (this.bubble) {
      this.bubble.style.transform = `translateX(${targetX - (bubbleSize / 2)}px)`;
    }
    this.drawSvgPath(targetX);
  }

  /**
   * Animación fluida de 300 ms entre la posición actual y la de destino
   * @param {Object} targetItem Datos de la opción seleccionada
   */
  animateToActive(targetItem) {
    this.targetCenterX = this.getItemCenterX(this.activeIndex);
    this.animationStartPos = this.currentCenterX;
    this.animationStartTime = performance.now();
    const duration = this.config.theme.animation.durationMs;

    // Cambiar contenido del círculo blanco a mitad de camino para transición limpia
    setTimeout(() => {
      if (this.bubbleIcon && this.bubbleLabel) {
        this.bubbleIcon.className = `bi ${targetItem.icon} ca-bnav-active-icon`;
        this.bubbleLabel.textContent = targetItem.label;
      }
    }, duration * 0.4);

    if (this.animating) return;
    this.animating = true;

    const bubbleSize = this.config.theme.activeItem.circleSize;

    // Función de aceleración natural elástica (cubic-bezier)
    const easeOutBack = (t) => {
      const c1 = 1.35;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    const step = (now) => {
      const elapsed = now - this.animationStartTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = progress >= 1 ? 1 : easeOutBack(progress);

      this.currentCenterX = this.animationStartPos + (this.targetCenterX - this.animationStartPos) * easedProgress;

      if (this.bubble) {
        this.bubble.style.transform = `translateX(${this.currentCenterX - (bubbleSize / 2)}px)`;
      }
      this.drawSvgPath(this.currentCenterX);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.animating = false;
        this.currentCenterX = this.targetCenterX;
        if (this.bubble) {
          this.bubble.style.transform = `translateX(${this.targetCenterX - (bubbleSize / 2)}px)`;
        }
        this.drawSvgPath(this.targetCenterX);
      }
    };

    requestAnimationFrame(step);
  }
}

let bottomNavInstance = null;

/**
 * Inicializador exportado para la aplicación
 * @param {HTMLElement} container
 */
export function initBottomNav(container) {
  if (!bottomNavInstance) {
    bottomNavInstance = new BottomNavigationComponent();
  }
  bottomNavInstance.init(container);
  return bottomNavInstance;
}

export function setActiveBottomNavItem(routeId) {
  if (!bottomNavInstance) return;
  const idx = BOTTOM_NAV_CONFIG.items.findIndex(item => item.id === routeId);
  if (idx !== -1) {
    bottomNavInstance.setActiveIndex(idx);
  }
}
