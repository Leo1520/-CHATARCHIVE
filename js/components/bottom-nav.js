/**
 * ChatArchive - Floating Active Bottom Navigation Bar Component
 * Implementación de Animación Inteligente de Dos Estados:
 * - ESTADO A (ELEVADO): Círculo blanco sobresale de la barra con notch cóncavo abierto.
 * - ESTADO B (INTEGRADO): Tras 2.000 ms sin interacción, el círculo blanco desciende
 *   suavemente y se alinea con los demás elementos mientras la muesca de la barra se cierra.
 * - Cancelación y reinicio inmediato de temporizadores ante cambios rápidos o navegación atrás/adelante.
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
      circleSize: 58,
      elevationShadow: "0 10px 24px rgba(0, 0, 0, 0.5)"
    },
    animation: {
      moveDurationMs: 300,
      settleDurationMs: 400,
      settleDelayMs: 2000
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
    this.barElement = null;
    this.svgPath = null;
    this.bubble = null;
    this.bubbleIcon = null;
    this.bubbleLabel = null;
    this.itemsElements = [];
    this.activeIndex = 0;

    // Estado físico del componente
    this.currentX = 0;
    this.currentY = 0; // 0 = Elevado (Estado A), 32 = Integrado (Estado B)
    this.currentCutDepth = 28; // 28 = Muesca abierta, 0 = Barra plana
    this.isSettled = false;

    // Animación y temporizadores
    this.animating = false;
    this.currentAnimFrame = null;
    this.settleTimeout = null;
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
    const { items } = this.config;
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
      this.updatePositionsImmediate();
      this.startSettleTimer();
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
        if (!isNaN(idx)) {
          this.setActiveIndex(idx);
        }
      });
    });

    // 2. Cambio de hash en la URL (incluye botones adelante / atrás del navegador)
    window.addEventListener('hashchange', () => {
      this.syncWithCurrentRoute();
    });

    // 3. Redimensionamiento de ventana
    window.addEventListener('resize', () => {
      this.updatePositionsImmediate();
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
      targetIndex = 1; // En el visor de chat la sección activa es Biblioteca
    } else {
      const foundIdx = this.config.items.findIndex(item => item.route === cleanHash);
      if (foundIdx !== -1) {
        targetIndex = foundIdx;
      }
    }

    if (targetIndex !== this.activeIndex || this.isSettled) {
      this.setActiveIndex(targetIndex);
    }
  }

  /**
   * Cambia el elemento activo, cancela temporizadores previos y pasa al Estado A (Elevado)
   * @param {number} newIndex
   */
  setActiveIndex(newIndex) {
    if (newIndex < 0 || newIndex >= this.config.items.length) return;

    // 1. Cancelar cualquier temporizador pendiente de descenso
    this.clearSettleTimer();

    const isSameIndex = newIndex === this.activeIndex;
    this.activeIndex = newIndex;
    const activeItem = this.config.items[newIndex];

    // 2. Actualizar estados visuales de las clases
    this.itemsElements.forEach((el, idx) => {
      const isCurrent = idx === newIndex;
      el.classList.toggle('is-active', isCurrent);
      el.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });

    // 3. Pasar al Estado A (Elevado) y animar hacia la nueva posición
    this.animateToStateA(activeItem, isSameIndex);
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
   * @param {number} cutDepth Profundidad de la muesca (28 = abierta, 0 = plana)
   */
  drawSvgPath(centerX, cutDepth = 28) {
    if (!this.svgPath || !this.barElement) return;

    const width = this.barElement.offsetWidth || window.innerWidth;
    const height = this.config.theme.barHeight;
    const radius = this.config.theme.borderRadius;

    // Si la muesca se ha cerrado por completo (Estado B integrado)
    if (cutDepth <= 0.5) {
      const dFlat = [
        `M 0 ${radius}`,
        `Q 0 0 ${radius} 0`,
        `L ${width - radius} 0`,
        `Q ${width} 0 ${width} ${radius}`,
        `L ${width} ${height}`,
        `L 0 ${height}`,
        `Z`
      ].join(' ');
      this.svgPath.setAttribute('d', dFlat);
      return;
    }

    const cutHalfWidth = 40;
    const xLeft = Math.max(radius, centerX - cutHalfWidth);
    const xRight = Math.min(width - radius, centerX + cutHalfWidth);

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
  updatePositionsImmediate() {
    const targetX = this.getItemCenterX(this.activeIndex);
    this.currentX = targetX;
    this.currentY = 0;
    this.currentCutDepth = 28;
    this.isSettled = false;

    const bubbleSize = this.config.theme.activeItem.circleSize;
    if (this.bubble) {
      this.bubble.classList.remove('is-settled');
      this.bubble.style.transform = `translateX(${this.currentX - (bubbleSize / 2)}px) translateY(0px)`;
    }
    this.drawSvgPath(this.currentX, 28);
  }

  /**
   * Animación hacia el Estado A (Elevado)
   * Se desplaza horizontalmente si cambió de pestaña, y se eleva verticalmente si estaba en Estado B
   * @param {Object} targetItem Datos de la opción seleccionada
   * @param {boolean} isSameIndex Si es la misma pestaña seleccionada nuevamente
   */
  animateToStateA(targetItem, isSameIndex) {
    if (this.currentAnimFrame) {
      cancelAnimationFrame(this.currentAnimFrame);
      this.currentAnimFrame = null;
    }

    const targetX = this.getItemCenterX(this.activeIndex);
    const startX = this.currentX;
    const startY = this.currentY;
    const startDepth = this.currentCutDepth;

    const targetY = 0; // Elevado
    const targetDepth = 28; // Muesca abierta

    const duration = this.config.theme.animation.moveDurationMs;
    const startTime = performance.now();

    if (this.bubble) {
      this.bubble.classList.remove('is-settled');
    }

    // Actualizar icono y texto en el círculo
    if (this.bubbleIcon && this.bubbleLabel) {
      if (isSameIndex) {
        this.bubbleIcon.className = `bi ${targetItem.icon} ca-bnav-active-icon`;
        this.bubbleLabel.textContent = targetItem.label;
      } else {
        setTimeout(() => {
          this.bubbleIcon.className = `bi ${targetItem.icon} ca-bnav-active-icon`;
          this.bubbleLabel.textContent = targetItem.label;
        }, duration * 0.35);
      }
    }

    const bubbleSize = this.config.theme.activeItem.circleSize;

    // Curva elástica natural
    const easeOutBack = (t) => {
      const c1 = 1.35;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress >= 1 ? 1 : easeOutBack(progress);

      this.currentX = startX + (targetX - startX) * eased;
      this.currentY = startY + (targetY - startY) * eased;
      this.currentCutDepth = startDepth + (targetDepth - startDepth) * eased;

      if (this.bubble) {
        this.bubble.style.transform = `translateX(${this.currentX - (bubbleSize / 2)}px) translateY(${this.currentY}px)`;
      }
      this.drawSvgPath(this.currentX, this.currentCutDepth);

      if (progress < 1) {
        this.currentAnimFrame = requestAnimationFrame(step);
      } else {
        this.currentAnimFrame = null;
        this.currentX = targetX;
        this.currentY = 0;
        this.currentCutDepth = 28;
        this.isSettled = false;

        if (this.bubble) {
          this.bubble.style.transform = `translateX(${this.currentX - (bubbleSize / 2)}px) translateY(0px)`;
        }
        this.drawSvgPath(this.currentX, 28);

        // Iniciar cuenta regresiva para el Estado B (Integrado)
        this.startSettleTimer();
      }
    };

    this.currentAnimFrame = requestAnimationFrame(step);
  }

  /**
   * Inicia el temporizador de 2.000 ms para descender al Estado B (Integrado)
   */
  startSettleTimer() {
    this.clearSettleTimer();
    this.settleTimeout = setTimeout(() => {
      this.animateToStateB();
    }, this.config.theme.animation.settleDelayMs);
  }

  /**
   * Cancela el temporizador de descenso si existía
   */
  clearSettleTimer() {
    if (this.settleTimeout) {
      clearTimeout(this.settleTimeout);
      this.settleTimeout = null;
    }
  }

  /**
   * Animación suave de descenso hacia el Estado B (Integrado)
   * El círculo baja +32px alineándose con la barra y la muesca de la barra se cierra
   */
  animateToStateB() {
    if (this.currentAnimFrame) {
      cancelAnimationFrame(this.currentAnimFrame);
      this.currentAnimFrame = null;
    }

    const startY = this.currentY;
    const targetY = 32; // Centrado en la barra de 78px
    const startDepth = this.currentCutDepth;
    const targetDepth = 0; // Borde superior plano

    const duration = this.config.theme.animation.settleDurationMs;
    const startTime = performance.now();

    if (this.bubble) {
      this.bubble.classList.add('is-settled');
    }

    // Easing suave easeInOutCubic
    const easeInOutCubic = (t) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const bubbleSize = this.config.theme.activeItem.circleSize;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress >= 1 ? 1 : easeInOutCubic(progress);

      this.currentY = startY + (targetY - startY) * eased;
      this.currentCutDepth = startDepth + (targetDepth - startDepth) * eased;

      if (this.bubble) {
        this.bubble.style.transform = `translateX(${this.currentX - (bubbleSize / 2)}px) translateY(${this.currentY}px)`;
      }
      this.drawSvgPath(this.currentX, this.currentCutDepth);

      if (progress < 1) {
        this.currentAnimFrame = requestAnimationFrame(step);
      } else {
        this.currentAnimFrame = null;
        this.currentY = targetY;
        this.currentCutDepth = 0;
        this.isSettled = true;

        if (this.bubble) {
          this.bubble.style.transform = `translateX(${this.currentX - (bubbleSize / 2)}px) translateY(${targetY}px)`;
        }
        this.drawSvgPath(this.currentX, 0);
      }
    };

    this.currentAnimFrame = requestAnimationFrame(step);
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
