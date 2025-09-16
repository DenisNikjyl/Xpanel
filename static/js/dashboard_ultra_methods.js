// Additional methods for UltraDashboard class

UltraDashboard.prototype.getServerStatusClass = function(status) {
    const statusMap = {
        'online': 'status-online',
        'offline': 'status-offline',
        'warning': 'status-warning',
        'error': 'status-error'
    };
    return statusMap[status] || 'status-offline';
};

UltraDashboard.prototype.getServerStatusIcon = function(status) {
    const iconMap = {
        'online': 'fas fa-circle text-success',
        'offline': 'fas fa-circle text-danger',
        'warning': 'fas fa-exclamation-triangle text-warning',
        'error': 'fas fa-times-circle text-danger'
    };
    return iconMap[status] || 'fas fa-circle text-muted';
};

UltraDashboard.prototype.showLoading = function(message = 'Loading...') {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.style.display = 'flex';
        const messageEl = loader.querySelector('.loading-message');
        if (messageEl) messageEl.textContent = message;
    }
};

UltraDashboard.prototype.hideLoading = function() {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.style.display = 'none';
    }
};

UltraDashboard.prototype.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
};

UltraDashboard.prototype.handleKeyboard = function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'r':
                e.preventDefault();
                this.refreshDashboard();
                break;
            case 'n':
                e.preventDefault();
                this.showAddServerModal();
                break;
        }
    }
};

UltraDashboard.prototype.refreshDashboard = function() {
    this.loadDashboard();
};

UltraDashboard.prototype.showAddServerModal = function() {
    const modal = document.getElementById('add-server-modal');
    if (modal) {
        modal.classList.add('active');
    }
};

UltraDashboard.prototype.showEditServerModal = function(serverId) {
    const modal = document.getElementById('edit-server-modal');
    if (modal) {
        // Find server data and populate form
        const server = this.servers.find(s => s.id === serverId);
        if (server) {
            document.getElementById('edit-server-name').value = server.name || '';
            document.getElementById('edit-server-host').value = server.host || '';
            document.getElementById('edit-server-port').value = server.port || 22;
            document.getElementById('edit-server-username').value = server.username || 'root';
            document.getElementById('edit-server-password').value = '';
            document.getElementById('edit-server-description').value = server.description || '';
        }
        modal.classList.add('active');
    }
};

UltraDashboard.prototype.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
};

// Global function for HTML onclick
function closeModal(modalId) {
    if (window.dashboard) {
        window.dashboard.closeModal(modalId);
    }
};
