// Xpanel - File Manager JavaScript

class FilesManager {
    constructor() {
        this.currentServer = null;
        this.currentPath = '/';
        this.files = [];
        this.init();
    }

    init() {
        this.setupEventHandlers();
        this.loadServers();
    }

    setupEventHandlers() {
        const serverSelect = document.getElementById('files-server-select');
        
        if (serverSelect) {
            serverSelect.addEventListener('change', (e) => {
                this.selectServer(e.target.value);
            });
        }
    }

    loadServers() {
        // This will be populated by the servers manager
    }

    selectServer(serverId) {
        if (!serverId) {
            this.currentServer = null;
            this.clearFilesList();
            return;
        }

        this.currentServer = serverId;
        this.currentPath = '/';
        this.loadFiles();
    }

    async loadFiles(path = this.currentPath) {
        if (!this.currentServer) {
            this.clearFilesList();
            return;
        }

        try {
            this.showLoading();
            const result = await api.getServerFiles(this.currentServer, path);
            
            if (result.success) {
                this.files = result.files || [];
                this.currentPath = result.path || path;
                this.renderFilesList();
                this.updatePathDisplay();
            } else {
                this.showError(result.error || 'Не удалось загрузить файлы');
            }
        } catch (error) {
            console.error('Failed to load files:', error);
            this.showError('Ошибка загрузки файлов');
        }
    }

    renderFilesList() {
        const filesList = document.getElementById('files-list');
        if (!filesList) return;

        if (this.files.length === 0) {
            filesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <h3>Папка пуста</h3>
                    <p>В этой папке нет файлов</p>
                </div>
            `;
            return;
        }

        // Add parent directory link if not in root
        let filesHtml = '';
        if (this.currentPath !== '/') {
            filesHtml += `
                <div class="file-item" onclick="navigateToParent()">
                    <i class="fas fa-level-up-alt file-icon directory"></i>
                    <div class="file-name">..</div>
                    <div class="file-size"></div>
                    <div class="file-date"></div>
                </div>
            `;
        }

        // Sort files: directories first, then files
        const sortedFiles = [...this.files].sort((a, b) => {
            if (a.is_directory && !b.is_directory) return -1;
            if (!a.is_directory && b.is_directory) return 1;
            return a.name.localeCompare(b.name);
        });

        filesHtml += sortedFiles.map(file => `
            <div class="file-item" onclick="handleFileClick('${file.name}', ${file.is_directory})">
                <i class="fas ${file.is_directory ? 'fa-folder' : this.getFileIcon(file.name)} file-icon ${file.is_directory ? 'directory' : ''}"></i>
                <div class="file-name">${file.name}</div>
                <div class="file-size">${file.is_directory ? '' : file.size}</div>
                <div class="file-date">${file.modified}</div>
            </div>
        `).join('');

        filesList.innerHTML = filesHtml;
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        
        const iconMap = {
            // Text files
            'txt': 'fa-file-alt',
            'md': 'fa-file-alt',
            'log': 'fa-file-alt',
            'conf': 'fa-file-alt',
            'config': 'fa-file-alt',
            
            // Code files
            'js': 'fa-file-code',
            'html': 'fa-file-code',
            'css': 'fa-file-code',
            'php': 'fa-file-code',
            'py': 'fa-file-code',
            'java': 'fa-file-code',
            'cpp': 'fa-file-code',
            'c': 'fa-file-code',
            'sh': 'fa-file-code',
            
            // Archives
            'zip': 'fa-file-archive',
            'tar': 'fa-file-archive',
            'gz': 'fa-file-archive',
            'rar': 'fa-file-archive',
            '7z': 'fa-file-archive',
            
            // Images
            'jpg': 'fa-file-image',
            'jpeg': 'fa-file-image',
            'png': 'fa-file-image',
            'gif': 'fa-file-image',
            'svg': 'fa-file-image',
            
            // Documents
            'pdf': 'fa-file-pdf',
            'doc': 'fa-file-word',
            'docx': 'fa-file-word',
            'xls': 'fa-file-excel',
            'xlsx': 'fa-file-excel',
            
            // Media
            'mp3': 'fa-file-audio',
            'wav': 'fa-file-audio',
            'mp4': 'fa-file-video',
            'avi': 'fa-file-video'
        };
        
        return iconMap[ext] || 'fa-file';
    }

    updatePathDisplay() {
        const pathElement = document.getElementById('current-path');
        if (pathElement) {
            pathElement.textContent = this.currentPath;
        }
    }

    showLoading() {
        const filesList = document.getElementById('files-list');
        if (filesList) {
            filesList.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Загрузка файлов...</p>
                </div>
            `;
        }
    }

    showError(message) {
        const filesList = document.getElementById('files-list');
        if (filesList) {
            filesList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--error-color); margin-bottom: 1rem;"></i>
                    <h3>Ошибка</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="refreshFiles()">Попробовать снова</button>
                </div>
            `;
        }
    }

    clearFilesList() {
        const filesList = document.getElementById('files-list');
        if (filesList) {
            filesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-server" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <h3>Выберите сервер</h3>
                    <p>Выберите сервер для просмотра файлов</p>
                </div>
            `;
        }
    }

    navigateToDirectory(dirName) {
        const newPath = this.currentPath === '/' 
            ? `/${dirName}` 
            : `${this.currentPath}/${dirName}`;
        this.loadFiles(newPath);
    }

    navigateToParent() {
        const pathParts = this.currentPath.split('/').filter(part => part);
        pathParts.pop();
        const newPath = pathParts.length === 0 ? '/' : '/' + pathParts.join('/');
        this.loadFiles(newPath);
    }
}

// Global functions
window.handleFileClick = function(fileName, isDirectory) {
    if (isDirectory) {
        window.filesManager.navigateToDirectory(fileName);
    } else {
        // Handle file click (download, edit, etc.)
        XpanelUtils.showNotification('Файл', `Клик по файлу: ${fileName}`, 'info');
    }
};

window.navigateToParent = function() {
    window.filesManager.navigateToParent();
};

window.refreshFiles = function() {
    if (window.filesManager) {
        window.filesManager.loadFiles();
    }
};

// Initialize files manager
document.addEventListener('DOMContentLoaded', () => {
    window.filesManager = new FilesManager();
});
