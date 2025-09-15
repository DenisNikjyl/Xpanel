// Xpanel - Utility Functions

// Format bytes to human readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}д ${hours}ч ${minutes}м`;
    } else if (hours > 0) {
        return `${hours}ч ${minutes}м`;
    } else {
        return `${minutes}м`;
    }
}

// Show notification
function showNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
        <div class="notification-header">
            <div class="notification-title">${title}</div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
        <div class="notification-message">${message}</div>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Get authentication token
function getAuthToken() {
    return localStorage.getItem('xpanel_token');
}

// Set authentication token
function setAuthToken(token) {
    localStorage.setItem('xpanel_token', token);
}

// Remove authentication token
function removeAuthToken() {
    localStorage.removeItem('xpanel_token');
}

// Check if user is authenticated
function isAuthenticated() {
    return !!getAuthToken();
}

// Logout function
function logout() {
    removeAuthToken();
    localStorage.removeItem('xpanel_user');
    window.location.href = '/login';
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
}

// Debounce function
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Generate random ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Успех', 'Скопировано в буфер обмена', 'success');
    } catch (err) {
        console.error('Failed to copy: ', err);
        showNotification('Ошибка', 'Не удалось скопировать', 'error');
    }
}

// Validate IP address
function isValidIP(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}

// Validate hostname
function isValidHostname(hostname) {
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return hostnameRegex.test(hostname);
}

// Get CPU usage color
function getCPUColor(usage) {
    if (usage < 50) return '#10b981';
    if (usage < 80) return '#f59e0b';
    return '#ef4444';
}

// Get memory usage color
function getMemoryColor(usage) {
    if (usage < 60) return '#10b981';
    if (usage < 85) return '#f59e0b';
    return '#ef4444';
}

// Get disk usage color
function getDiskColor(usage) {
    if (usage < 70) return '#10b981';
    if (usage < 90) return '#f59e0b';
    return '#ef4444';
}

// Escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Parse command output
function parseCommandOutput(output) {
    return output.split('\n').map(line => escapeHtml(line)).join('\n');
}

// Check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Smooth scroll to element
function scrollToElement(element, offset = 0) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
    });
}

// Local storage helpers
const storage = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    },
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Failed to get from localStorage:', e);
            return defaultValue;
        }
    },
    remove: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Failed to remove from localStorage:', e);
        }
    }
};

// Export for use in other modules
window.XpanelUtils = {
    formatBytes,
    formatUptime,
    showNotification,
    getAuthToken,
    setAuthToken,
    removeAuthToken,
    isAuthenticated,
    logout,
    formatDate,
    debounce,
    throttle,
    generateId,
    copyToClipboard,
    isValidIP,
    isValidHostname,
    getCPUColor,
    getMemoryColor,
    getDiskColor,
    escapeHtml,
    parseCommandOutput,
    isInViewport,
    scrollToElement,
    storage
};
