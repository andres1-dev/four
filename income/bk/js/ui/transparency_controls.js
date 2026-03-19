/**
 * Control de Transparencias
 * Permite al usuario ajustar la opacidad de negro y blanco en tiempo real
 */

class TransparencyController {
    constructor() {
        this.panel = null;
        this.isOpen = false;
        this.currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        
        // Valores por defecto
        this.defaults = {
            dark: {
                blackSubtle: 0.05,
                blackLight: 0.08,
                blackMedium: 0.12,
                blackStrong: 0.15,
                blackDeep: 0.25,
                blackDarker: 0.35,
                blackDarkest: 0.45,
                whiteSubtle: 0.03,
                whiteLight: 0.06,
                whiteMedium: 0.25,
                whiteStrong: 0.45,
                whiteDeep: 0.70,
                whiteSolid: 0.97
            },
            light: {
                blackSubtle: 0.07,
                blackLight: 0.10,
                blackMedium: 0.12,
                blackStrong: 0.15,
                blackDeep: 0.08,
                blackDarker: 0.10,
                blackDarkest: 0.15,
                whiteSubtle: 0.25,
                whiteLight: 0.45,
                whiteMedium: 0.50,
                whiteStrong: 0.70,
                whiteDeep: 0.97,
                whiteSolid: 0.97
            }
        };
        
        this.init();
    }
    
    init() {
        this.createPanel();
        this.attachEventListeners();
        this.loadSavedValues();
        this.observeThemeChanges();
    }
    
    createPanel() {
        const panel = document.createElement('div');
        panel.className = 'transparency-panel';
        panel.id = 'transparencyPanel';
        
        panel.innerHTML = `
            <div class="transparency-panel-header">
                <h2 class="transparency-panel-title">
                    <i class="fas fa-adjust"></i>
                    Control de Transparencias
                </h2>
                <button class="transparency-panel-close" id="closeTransparencyPanel">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="transparency-panel-content">
                <!-- Sección Negro -->
                <div class="transparency-section">
                    <h3 class="transparency-section-title">
                        <i class="fas fa-circle" style="color: #000;"></i>
                        Opacidad de Negro
                    </h3>
                    
                    ${this.createControl('blackSubtle', 'Bordes Sutiles', 'Bordes muy ligeros y discretos')}
                    ${this.createControl('blackLight', 'Bordes Ligeros', 'Bordes suaves')}
                    ${this.createControl('blackMedium', 'Bordes Medios', 'Bordes estándar')}
                    ${this.createControl('blackStrong', 'Bordes Fuertes', 'Bordes más visibles')}
                    ${this.createControl('blackDeep', 'Sombras Profundas', 'Sombras básicas')}
                    ${this.createControl('blackDarker', 'Sombras Oscuras', 'Sombras medianas')}
                    ${this.createControl('blackDarkest', 'Sombras Máximas', 'Sombras más profundas')}
                </div>
                
                <!-- Sección Blanco -->
                <div class="transparency-section">
                    <h3 class="transparency-section-title">
                        <i class="fas fa-circle" style="color: #fff; text-shadow: 0 0 2px #000;"></i>
                        Opacidad de Blanco
                    </h3>
                    
                    ${this.createControl('whiteSubtle', 'Fondos Sutiles', 'Fondos muy ligeros')}
                    ${this.createControl('whiteLight', 'Fondos Ligeros', 'Fondos suaves')}
                    ${this.createControl('whiteMedium', 'Fondos Medios', 'Fondos estándar')}
                    ${this.createControl('whiteStrong', 'Fondos Fuertes', 'Fondos más visibles')}
                    ${this.createControl('whiteDeep', 'Fondos Profundos', 'Fondos intensos')}
                    ${this.createControl('whiteSolid', 'Fondos Sólidos', 'Casi completamente sólido')}
                </div>
                
                <!-- Presets -->
                <div class="transparency-section">
                    <h3 class="transparency-section-title">
                        <i class="fas fa-magic"></i>
                        Presets Rápidos
                    </h3>
                    <div class="transparency-preset-buttons">
                        <button class="transparency-preset-btn" data-preset="subtle">
                            <i class="fas fa-feather"></i>
                            Sutil
                        </button>
                        <button class="transparency-preset-btn" data-preset="balanced">
                            <i class="fas fa-balance-scale"></i>
                            Balanceado
                        </button>
                        <button class="transparency-preset-btn" data-preset="strong">
                            <i class="fas fa-bolt"></i>
                            Fuerte
                        </button>
                        <button class="transparency-preset-btn" data-preset="maximum">
                            <i class="fas fa-fire"></i>
                            Máximo
                        </button>
                    </div>
                </div>
                
                <!-- Reset -->
                <button class="transparency-reset-btn" id="resetTransparency">
                    <i class="fas fa-undo"></i>
                    Restaurar Valores por Defecto
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.panel = panel;
    }
    
    createControl(id, label, description) {
        return `
            <div class="transparency-control">
                <div class="transparency-control-header">
                    <label class="transparency-control-label" for="${id}Slider">
                        ${label}
                    </label>
                    <span class="transparency-control-value" id="${id}Value">0.00</span>
                </div>
                <input 
                    type="range" 
                    class="transparency-slider" 
                    id="${id}Slider" 
                    min="0" 
                    max="100" 
                    step="1" 
                    data-var="${id}"
                >
                <div class="transparency-control-description">${description}</div>
            </div>
        `;
    }
    
    attachEventListeners() {
        // Botón de abrir (desde el settings existente)
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.toggle());
        }
        
        // Botón de cerrar
        const closeBtn = document.getElementById('closeTransparencyPanel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // Sliders
        const sliders = this.panel.querySelectorAll('.transparency-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => this.handleSliderChange(e));
        });
        
        // Presets
        const presetBtns = this.panel.querySelectorAll('.transparency-preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.currentTarget.getAttribute('data-preset');
                this.applyPreset(preset);
            });
        });
        
        // Reset
        const resetBtn = document.getElementById('resetTransparency');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }
        
        // Cerrar al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.panel.contains(e.target) && 
                e.target.id !== 'settingsBtn' &&
                !e.target.closest('#settingsBtn')) {
                this.close();
            }
        });
    }
    
    handleSliderChange(e) {
        const slider = e.target;
        const varName = slider.getAttribute('data-var');
        const value = parseInt(slider.value) / 100;
        
        this.updateValue(varName, value);
        this.saveValue(varName, value);
    }
    
    updateValue(varName, value) {
        const cssVarName = this.getCSSVarName(varName);
        const valueDisplay = document.getElementById(`${varName}Value`);
        
        // Actualizar CSS
        if (this.currentTheme === 'light') {
            document.documentElement.style.setProperty(cssVarName, value);
        } else {
            document.documentElement.style.setProperty(cssVarName, value);
        }
        
        // Actualizar display
        if (valueDisplay) {
            valueDisplay.textContent = value.toFixed(2);
        }
        
        // Actualizar slider
        const slider = document.getElementById(`${varName}Slider`);
        if (slider) {
            slider.value = Math.round(value * 100);
        }
    }
    
    getCSSVarName(varName) {
        // Convertir camelCase a kebab-case
        const kebab = varName.replace(/([A-Z])/g, '-$1').toLowerCase();
        
        if (varName.startsWith('black')) {
            return `--black-opacity-${kebab.replace('black-', '')}`;
        } else if (varName.startsWith('white')) {
            return `--white-opacity-${kebab.replace('white-', '')}`;
        }
        return `--${kebab}`;
    }
    
    saveValue(varName, value) {
        const key = `transparency_${this.currentTheme}_${varName}`;
        localStorage.setItem(key, value);
    }
    
    loadSavedValues() {
        const theme = this.currentTheme;
        const defaults = this.defaults[theme];
        
        Object.keys(defaults).forEach(varName => {
            const key = `transparency_${theme}_${varName}`;
            const saved = localStorage.getItem(key);
            const value = saved !== null ? parseFloat(saved) : defaults[varName];
            
            this.updateValue(varName, value);
        });
    }
    
    applyPreset(preset) {
        const presets = {
            subtle: {
                blackMultiplier: 0.5,
                whiteMultiplier: 0.6
            },
            balanced: {
                blackMultiplier: 1.0,
                whiteMultiplier: 1.0
            },
            strong: {
                blackMultiplier: 1.5,
                whiteMultiplier: 1.3
            },
            maximum: {
                blackMultiplier: 2.0,
                whiteMultiplier: 1.5
            }
        };
        
        const config = presets[preset];
        const defaults = this.defaults[this.currentTheme];
        
        Object.keys(defaults).forEach(varName => {
            let value = defaults[varName];
            
            if (varName.startsWith('black')) {
                value = Math.min(1.0, value * config.blackMultiplier);
            } else if (varName.startsWith('white')) {
                value = Math.min(1.0, value * config.whiteMultiplier);
            }
            
            this.updateValue(varName, value);
            this.saveValue(varName, value);
        });
    }
    
    reset() {
        const defaults = this.defaults[this.currentTheme];
        
        Object.keys(defaults).forEach(varName => {
            const value = defaults[varName];
            this.updateValue(varName, value);
            this.saveValue(varName, value);
        });
    }
    
    observeThemeChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    this.currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                    this.loadSavedValues();
                }
            });
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.panel.classList.add('active');
        this.isOpen = true;
    }
    
    close() {
        this.panel.classList.remove('active');
        this.isOpen = false;
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.transparencyController = new TransparencyController();
    });
} else {
    window.transparencyController = new TransparencyController();
}
