function updateStatus(message, type = 'info') {
    const statusMessage = document.getElementById('statusMessage');
    const statusIcon = document.getElementById('statusIcon');

    if (statusMessage) statusMessage.textContent = message;

    if (statusIcon) {
        const icons = {
            'info':    'fa-solid fa-circle-info',
            'success': 'fa-solid fa-circle-check',
            'warning': 'fa-solid fa-triangle-exclamation',
            'error':   'fa-solid fa-circle-xmark',
            'loading': 'fa-solid fa-spinner fa-spin'
        };
        statusIcon.className = `status-icon ${icons[type] || icons.info}`;
    }
}
