// ============================================
// PARTÍCULAS GEOMÉTRICAS + CONSTELACIÓN
// Reutilizable: llama initParticles('id-del-canvas')
// ============================================

function initParticles(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const dark = () => document.documentElement.classList.contains('vscode-dark');

    let W, H, pts;
    const N    = 60;
    const LINK = 145;

    const rnd = (a, b) => a + Math.random() * (b - a);

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function mkPt() {
        return {
            x:    rnd(0, W),   y:    rnd(0, H),
            vx:   rnd(-.38,.38), vy: rnd(-.3,.3),
            r:    rnd(5, 20),
            type: Math.floor(Math.random() * 5),
            rot:  rnd(0, Math.PI * 2),
            rotV: rnd(-.007, .007),
            alpha: rnd(.18, .6),
        };
    }

    function init() { resize(); pts = Array.from({ length: N }, mkPt); }

    const col = (a) => dark()
        ? `rgba(55,148,255,${a})`
        : `rgba(0,100,210,${a})`;

    function shape(p) {
        const s = p.r;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.strokeStyle = col(p.alpha);
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        switch (p.type) {
            case 0: // triángulo
                ctx.moveTo(0,-s); ctx.lineTo(s*.866,s*.5); ctx.lineTo(-s*.866,s*.5); ctx.closePath(); break;
            case 1: // cuadrado
                ctx.rect(-s/2,-s/2,s,s); break;
            case 2: // diamante
                ctx.moveTo(0,-s); ctx.lineTo(s*.6,0); ctx.lineTo(0,s); ctx.lineTo(-s*.6,0); ctx.closePath(); break;
            case 3: // hexágono
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 6;
                    i === 0 ? ctx.moveTo(Math.cos(a)*s, Math.sin(a)*s)
                            : ctx.lineTo(Math.cos(a)*s, Math.sin(a)*s);
                }
                ctx.closePath(); break;
            case 4: // punto relleno
                ctx.fillStyle = col(p.alpha * .75);
                ctx.arc(0, 0, s * .42, 0, Math.PI * 2);
                ctx.fill(); ctx.restore(); return;
        }
        ctx.stroke();
        ctx.restore();
    }

    function links() {
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                const dx = pts[i].x - pts[j].x;
                const dy = pts[i].y - pts[j].y;
                const d  = Math.sqrt(dx*dx + dy*dy);
                if (d < LINK) {
                    ctx.strokeStyle = col((1 - d / LINK) * .22);
                    ctx.lineWidth   = .9;
                    ctx.beginPath();
                    ctx.moveTo(pts[i].x, pts[i].y);
                    ctx.lineTo(pts[j].x, pts[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function tick() {
        ctx.clearRect(0, 0, W, H);
        links();
        for (const p of pts) {
            p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
            if (p.x < -50) p.x = W + 50; if (p.x > W + 50) p.x = -50;
            if (p.y < -50) p.y = H + 50; if (p.y > H + 50) p.y = -50;
            shape(p);
        }
        requestAnimationFrame(tick);
    }

    window.addEventListener('resize', resize);
    init();
    tick();
}

window.initParticles = initParticles;
