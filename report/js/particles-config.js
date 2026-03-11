/* ==========================================================================
   particles-config.js — Configuración visual de Particles.js
   ========================================================================== */

/**
 * Configuración de partículas para el fondo animado.
 * @see https://vincentgarreau.com/particles.js/
 * @readonly
 */
const PARTICLES_CONFIG = Object.freeze({
    particles: {
        number: {
            value: 80,
            density: { enable: true, value_area: 800 },
        },
        color: { value: '#ad86f2' },
        shape: { type: 'circle' },
        opacity: { value: 0.5, random: false },
        size: { value: 5, random: true },
        line_linked: {
            enable: true,
            distance: 150,
            color: '#ad86f2',
            opacity: 0.4,
            width: 1,
        },
        move: {
            enable: true,
            speed: 6,
            direction: 'none',
            random: false,
        },
    },
    interactivity: {
        detect_on: 'canvas',
        events: {
            onhover: { enable: true, mode: 'repulse' },
            onclick: { enable: true, mode: 'push' },
        },
        modes: {
            repulse: { distance: 100 },
            push: { particles_nb: 4 },
        },
    },
    retina_detect: true,
});

/**
 * Inicializa Particles.js en el contenedor indicado.
 * @param {string} containerId — ID del elemento DOM contenedor.
 */
function initParticles(containerId = 'particles-js') {
    if (typeof particlesJS === 'function') {
        particlesJS(containerId, PARTICLES_CONFIG);
    } else {
        console.warn('[particles] particlesJS no está disponible');
    }
}
