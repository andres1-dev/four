(function () {
    function verifySession() {
        const user = localStorage.getItem('user');

        if (!user) {
            if (!window.location.pathname.includes('login.html')) {
                window.location.replace('./login.html');
            }
            return;
        }
    }

    // Ejecución inmediata (Head)
    verifySession();

    // Re-verificación cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', verifySession);
})();
