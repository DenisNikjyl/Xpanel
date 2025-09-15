// Xpanel - Analytics JavaScript

class AnalyticsManager {
    constructor() {
        this.auth = new XpanelAuth();
        this.servers = [];
        this.charts = {};
        this.currentTimeRange = '24h';
        this.currentServerFilter = 'all';
        this.updateInterval = null;
        this.init();
    }

    init() {
        this.setupEventHandlers();
        this.loadServers();
        this.loadAnalyticsData();
        this.startAutoRefresh();
    }

    setupEventHandlers() {
        // Time range selector
        const timeRangeSelect = document.getElementById('time-range');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (e) => {
                this.currentTimeRange = e.target.value;
                this.loadAnalyticsData();
            });
        }

        // Server filter
        const serverFilterSelect = document.getElementById('server-filter');
        if (serverFilterSelect) {
            serverFilterSelect.addEventListener('change', (e) => {
                this.currentServerFilter = e.target.value;
                this.loadAnalyticsData();
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }

        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // Generate report button
        const generateReportBtn = document.getElementById('generate-report');
        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => {
                this.generateReport();
            });
        }
    }

    async loadServers() {
        try {
            const response = await fetch('/api/servers', {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.servers = await response.json();
                this.updateServerFilter();
            } else if (response.status === 401) {
                this.auth.logout();
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
        }
    }

    updateServerFilter() {
        const serverFilterSelect = document.getElementById('server-filter');
        if (!serverFilterSelect) return;

        // Keep the "All Servers" option and add individual servers
        const currentValue = serverFilterSelect.value;
        serverFilterSelect.innerHTML = '<option value="all">All Servers</option>';
        
        this.servers.forEach(server => {
            const option = document.createElement('option');
            option.value = server.id;
            option.textContent = `${server.name} (${server.host})`;
            serverFilterSelect.appendChild(option);
        });

        // Restore previous selection if still valid
        if (currentValue && (currentValue === 'all' || this.servers.find(s => s.id === currentValue))) {
            serverFilterSelect.value = currentValue;
        }
    }

    async loadAnalyticsData() {
        try {
            // Show loading state
            this.showLoadingState();

            // Load metrics data
            await this.loadMetrics();
            
            // Load chart data
            await this.loadChartData();
            
            // Load detailed analytics
            await this.loadDetailedAnalytics();
            
            // Generate insights
            await this.generateInsights();

        } catch (error) {
            console.error('Failed to load analytics data:', error);
            this.showErrorState();
        }
    }

    async loadMetrics() {
        // Simulate loading metrics data
        const metrics = this.generateMockMetrics();
        
        // Update metric cards
        document.getElementById('avg-cpu').textContent = `${metrics.cpu.toFixed(1)}%`;
        document.getElementById('avg-memory').textContent = `${metrics.memory.toFixed(1)}%`;
        document.getElementById('avg-disk').textContent = `${metrics.disk.toFixed(1)}%`;
        document.getElementById('network-traffic').textContent = `${metrics.networkTraffic} MB/s`;

        // Update trends
        this.updateTrend('cpu-trend', metrics.cpuTrend);
        this.updateTrend('memory-trend', metrics.memoryTrend);
        this.updateTrend('disk-trend', metrics.diskTrend);
        this.updateTrend('network-trend', metrics.networkTrend);
    }

    updateTrend(elementId, trend) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const indicator = element.querySelector('.trend-indicator');
        if (!indicator) return;

        const isPositive = trend > 0;
        const isNegative = trend < 0;
        
        indicator.innerHTML = `
            <i class="fas fa-arrow-${isPositive ? 'up' : isNegative ? 'down' : 'right'}"></i>
            ${Math.abs(trend).toFixed(1)}%
        `;
        
        indicator.className = `trend-indicator ${isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'}`;
    }

    async loadChartData() {
        // Generate mock data for charts
        const performanceData = this.generatePerformanceData();
        const distributionData = this.generateDistributionData();

        // Create or update performance chart
        this.createPerformanceChart(performanceData);
        
        // Create or update distribution chart
        this.createDistributionChart(distributionData);
    }

    createPerformanceChart(data) {
        const ctx = document.getElementById('performance-chart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.performance) {
            this.charts.performance.destroy();
        }

        this.charts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'CPU Usage',
                        data: data.cpu,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Memory Usage',
                        data: data.memory,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Disk Usage',
                        data: data.disk,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // We have custom legend
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#9ca3af'
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 0,
                        hoverRadius: 6
                    }
                }
            }
        });
    }

    createDistributionChart(data) {
        const ctx = document.getElementById('server-distribution-chart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.distribution) {
            this.charts.distribution.destroy();
        }

        this.charts.distribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444',
                        '#8b5cf6',
                        '#06b6d4'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#9ca3af',
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    async loadDetailedAnalytics() {
        // Load resource consumers
        const consumers = this.generateResourceConsumers();
        this.renderResourceConsumers(consumers);

        // Load recent alerts
        const alerts = this.generateRecentAlerts();
        this.renderRecentAlerts(alerts);
    }

    renderResourceConsumers(consumers) {
        const container = document.getElementById('resource-consumers');
        if (!container) return;

        container.innerHTML = consumers.map(consumer => `
            <div class="resource-item">
                <div class="resource-info">
                    <div class="resource-name">${consumer.name}</div>
                    <div class="resource-server">${consumer.server}</div>
                </div>
                <div class="resource-usage">
                    <div class="usage-bar">
                        <div class="usage-fill ${consumer.type}" style="width: ${consumer.usage}%"></div>
                    </div>
                    <div class="usage-value">${consumer.usage}%</div>
                </div>
            </div>
        `).join('');
    }

    renderRecentAlerts(alerts) {
        const container = document.getElementById('recent-alerts');
        if (!container) return;

        if (alerts.length === 0) {
            container.innerHTML = '<div class="no-alerts">No recent alerts</div>';
            return;
        }

        container.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.severity}">
                <div class="alert-icon">
                    <i class="fas fa-${alert.icon}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-message">${alert.message}</div>
                    <div class="alert-time">${alert.time}</div>
                </div>
                <div class="alert-actions">
                    <button class="btn-link" onclick="analyticsManager.dismissAlert('${alert.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async generateInsights() {
        const insights = this.generatePerformanceInsights();
        this.renderInsights(insights);
    }

    renderInsights(insights) {
        const container = document.getElementById('performance-insights');
        if (!container) return;

        container.innerHTML = insights.map(insight => `
            <div class="insight-card ${insight.type}">
                <div class="insight-icon">
                    <i class="fas fa-${insight.icon}"></i>
                </div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-description">${insight.description}</div>
                    ${insight.action ? `
                        <button class="btn-link insight-action" onclick="${insight.action}">
                            ${insight.actionText}
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    // Mock data generators
    generateMockMetrics() {
        return {
            cpu: 45.2 + (Math.random() - 0.5) * 20,
            memory: 62.8 + (Math.random() - 0.5) * 30,
            disk: 78.3 + (Math.random() - 0.5) * 15,
            networkTraffic: (12.5 + (Math.random() - 0.5) * 10).toFixed(1),
            cpuTrend: (Math.random() - 0.5) * 10,
            memoryTrend: (Math.random() - 0.5) * 8,
            diskTrend: (Math.random() - 0.5) * 5,
            networkTrend: (Math.random() - 0.5) * 15
        };
    }

    generatePerformanceData() {
        const now = new Date();
        const labels = [];
        const cpu = [];
        const memory = [];
        const disk = [];

        const points = this.currentTimeRange === '1h' ? 12 : 
                      this.currentTimeRange === '24h' ? 24 : 
                      this.currentTimeRange === '7d' ? 7 : 30;

        for (let i = points - 1; i >= 0; i--) {
            let time;
            if (this.currentTimeRange === '1h') {
                time = new Date(now - i * 5 * 60 * 1000);
                labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
            } else if (this.currentTimeRange === '24h') {
                time = new Date(now - i * 60 * 60 * 1000);
                labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
            } else if (this.currentTimeRange === '7d') {
                time = new Date(now - i * 24 * 60 * 60 * 1000);
                labels.push(time.toLocaleDateString('en-US', { weekday: 'short' }));
            } else {
                time = new Date(now - i * 24 * 60 * 60 * 1000);
                labels.push(time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            }

            cpu.push(Math.max(0, Math.min(100, 45 + Math.sin(i * 0.3) * 20 + (Math.random() - 0.5) * 10)));
            memory.push(Math.max(0, Math.min(100, 60 + Math.cos(i * 0.2) * 15 + (Math.random() - 0.5) * 8)));
            disk.push(Math.max(0, Math.min(100, 75 + Math.sin(i * 0.1) * 10 + (Math.random() - 0.5) * 5)));
        }

        return { labels, cpu, memory, disk };
    }

    generateDistributionData() {
        const serverTypes = ['Web Servers', 'Database Servers', 'Application Servers', 'Cache Servers', 'Load Balancers'];
        const values = serverTypes.map(() => Math.floor(Math.random() * 10) + 1);
        
        return {
            labels: serverTypes,
            values: values
        };
    }

    generateResourceConsumers() {
        const processes = [
            { name: 'nginx', type: 'cpu' },
            { name: 'mysql', type: 'memory' },
            { name: 'node', type: 'cpu' },
            { name: 'redis', type: 'memory' },
            { name: 'apache2', type: 'cpu' }
        ];

        return processes.map(process => ({
            ...process,
            server: this.servers[Math.floor(Math.random() * Math.max(1, this.servers.length))]?.name || 'Server-1',
            usage: Math.floor(Math.random() * 80) + 20
        }));
    }

    generateRecentAlerts() {
        const alertTypes = [
            { message: 'High CPU usage detected', severity: 'warning', icon: 'exclamation-triangle' },
            { message: 'Memory usage above threshold', severity: 'error', icon: 'exclamation-circle' },
            { message: 'Disk space running low', severity: 'warning', icon: 'hdd' },
            { message: 'Network connectivity issues', severity: 'error', icon: 'network-wired' }
        ];

        return alertTypes.slice(0, Math.floor(Math.random() * 4) + 1).map((alert, index) => ({
            ...alert,
            id: `alert-${index}`,
            time: `${Math.floor(Math.random() * 60)} minutes ago`
        }));
    }

    generatePerformanceInsights() {
        const insights = [
            {
                type: 'optimization',
                icon: 'lightbulb',
                title: 'CPU Optimization Opportunity',
                description: 'Server-1 shows consistent high CPU usage. Consider load balancing or upgrading.',
                action: 'analyticsManager.optimizeCPU()',
                actionText: 'View Recommendations'
            },
            {
                type: 'warning',
                icon: 'exclamation-triangle',
                title: 'Memory Usage Trend',
                description: 'Memory usage has increased by 15% over the past week across all servers.',
                action: 'analyticsManager.analyzeMemory()',
                actionText: 'Analyze Memory'
            },
            {
                type: 'success',
                icon: 'check-circle',
                title: 'Network Performance',
                description: 'Network latency has improved by 23% since the last optimization.',
                action: null,
                actionText: null
            }
        ];

        return insights.slice(0, Math.floor(Math.random() * 3) + 1);
    }

    // Utility methods
    showLoadingState() {
        // Add loading indicators to various sections
        const sections = ['resource-consumers', 'recent-alerts', 'performance-insights'];
        sections.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.innerHTML = '<div class="loading-placeholder">Loading...</div>';
            }
        });
    }

    showErrorState() {
        const sections = ['resource-consumers', 'recent-alerts', 'performance-insights'];
        sections.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.innerHTML = '<div class="error-placeholder">Failed to load data</div>';
            }
        });
    }

    refreshData() {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('fa-spin');
            
            setTimeout(() => {
                icon.classList.remove('fa-spin');
            }, 1000);
        }
        
        this.loadAnalyticsData();
    }

    exportData() {
        // Simulate data export
        const data = {
            timestamp: new Date().toISOString(),
            timeRange: this.currentTimeRange,
            serverFilter: this.currentServerFilter,
            metrics: this.generateMockMetrics(),
            performanceData: this.generatePerformanceData()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `xpanel-analytics-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Analytics data exported successfully', 'success');
    }

    generateReport() {
        this.showNotification('Generating performance report...', 'info');
        
        // Simulate report generation
        setTimeout(() => {
            this.showNotification('Performance report generated and sent to your email', 'success');
        }, 2000);
    }

    dismissAlert(alertId) {
        const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
        if (alertElement) {
            alertElement.remove();
        }
    }

    optimizeCPU() {
        this.showNotification('Opening CPU optimization recommendations...', 'info');
    }

    analyzeMemory() {
        this.showNotification('Opening memory analysis dashboard...', 'info');
    }

    startAutoRefresh() {
        // Refresh data every 30 seconds
        this.updateInterval = setInterval(() => {
            this.loadAnalyticsData();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        if (type === 'error') {
            notification.style.backgroundColor = '#ef4444';
        } else if (type === 'success') {
            notification.style.backgroundColor = '#10b981';
        } else {
            notification.style.backgroundColor = '#3b82f6';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    destroy() {
        this.stopAutoRefresh();
        
        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
}

// Initialize analytics manager
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsManager = new AnalyticsManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.analyticsManager) {
        window.analyticsManager.destroy();
    }
});
