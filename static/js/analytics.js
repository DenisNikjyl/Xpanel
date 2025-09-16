class AnalyticsManager {
    constructor() {
        this.charts = {};
        this.currentTimeRange = '24h';
        this.currentServerFilter = 'all';
        this.servers = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
    }

    setupEventListeners() {
        // Time range selector
        document.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTimeRange = e.target.dataset.range;
                this.loadData();
            });
        });

        // Server filter
        const serverFilter = document.getElementById('server-filter');
        if (serverFilter) {
            serverFilter.addEventListener('change', (e) => {
                this.currentServerFilter = e.target.value;
                this.loadData();
            });
        }

        // Export button
        const exportBtn = document.getElementById('export-data');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-analytics');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }
    }

    async loadData() {
        this.showLoadingState();
        
        try {
            await this.loadMetrics();
            await this.loadChartData();
            await this.generateInsights();
        } catch (error) {
            console.error('Failed to load analytics data:', error);
            this.showErrorState();
        }
    }

    async loadMetrics() {
        try {
            const response = await fetch('/api/analytics/performance', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                document.getElementById('avg-cpu').textContent = `${data.avg_cpu.toFixed(1)}%`;
                document.getElementById('avg-memory').textContent = `${data.avg_memory.toFixed(1)}%`;
                document.getElementById('avg-disk').textContent = `${data.avg_disk.toFixed(1)}%`;
                document.getElementById('network-throughput').textContent = `${data.avg_network.toFixed(1)} MB/s`;
                
                this.updateTrendIndicator('cpu-trend', data.cpu_trend);
                this.updateTrendIndicator('memory-trend', data.memory_trend);
                this.updateTrendIndicator('disk-trend', data.disk_trend);
                this.updateTrendIndicator('network-trend', data.network_trend);
            } else {
                throw new Error('Failed to load metrics');
            }
        } catch (error) {
            console.error('Error loading metrics:', error);
            document.getElementById('avg-cpu').textContent = 'N/A';
            document.getElementById('avg-memory').textContent = 'N/A';
            document.getElementById('avg-disk').textContent = 'N/A';
            document.getElementById('network-throughput').textContent = 'N/A';
        }
    }

    updateTrendIndicator(elementId, trend) {
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
        try {
            const response = await fetch('/api/analytics/performance', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                this.updatePerformanceChart(data.performance_history);
                this.updateDistributionChart(data.server_distribution);
                this.updateServerList(data.servers);
            } else {
                throw new Error('Failed to load chart data');
            }
        } catch (error) {
            console.error('Error loading chart data:', error);
            this.showEmptyCharts();
        }
    }

    updatePerformanceChart(data) {
        const ctx = document.getElementById('performance-chart');
        if (!ctx) return;

        if (this.charts.performance) {
            this.charts.performance.destroy();
        }

        this.charts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: 'CPU Usage',
                    data: data.cpu || [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Memory Usage',
                    data: data.memory || [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Disk Usage',
                    data: data.disk || [],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    updateDistributionChart(data) {
        const ctx = document.getElementById('distribution-chart');
        if (!ctx) return;

        if (this.charts.distribution) {
            this.charts.distribution.destroy();
        }

        this.charts.distribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels || [],
                datasets: [{
                    data: data.values || [],
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444',
                        '#8b5cf6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateServerList(servers) {
        const container = document.getElementById('server-list');
        if (!container || !servers) return;

        container.innerHTML = servers.map(server => `
            <div class="server-item">
                <div class="server-info">
                    <div class="server-name">${server.name}</div>
                    <div class="server-status ${server.status}">${server.status}</div>
                </div>
                <div class="server-metrics">
                    <div class="metric">
                        <span class="metric-label">CPU</span>
                        <span class="metric-value">${server.cpu_usage || 0}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Memory</span>
                        <span class="metric-value">${server.memory_usage || 0}%</span>
                    </div>
                </div>
            </div>
        `).join('');
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

    showEmptyCharts() {
        const performanceChart = document.getElementById('performance-chart');
        const distributionChart = document.getElementById('distribution-chart');
        
        if (performanceChart) {
            performanceChart.innerHTML = '<div class="empty-chart">No performance data available</div>';
        }
        
        if (distributionChart) {
            distributionChart.innerHTML = '<div class="empty-chart">No distribution data available</div>';
        }
    }

    showLoadingState() {
        const sections = ['performance-metrics', 'performance-chart', 'distribution-chart', 'server-list'];
        sections.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.innerHTML = '<div class="loading-placeholder">Loading...</div>';
            }
        });
    }

    showErrorState() {
        const sections = ['performance-metrics', 'performance-chart', 'distribution-chart', 'server-list'];
        sections.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.innerHTML = '<div class="error-placeholder">Failed to load data</div>';
            }
        });
    }

    async generateInsights() {
        try {
            const response = await fetch('/api/analytics/performance', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const insights = [];

                if (data.avg_cpu > 80) {
                    insights.push({
                        type: 'warning',
                        icon: 'exclamation-triangle',
                        title: 'High CPU Usage',
                        description: `Average CPU usage is ${data.avg_cpu.toFixed(1)}%. Consider scaling resources.`
                    });
                }

                if (data.avg_memory > 85) {
                    insights.push({
                        type: 'error',
                        icon: 'memory',
                        title: 'Memory Pressure',
                        description: `Memory usage is ${data.avg_memory.toFixed(1)}%. Memory optimization needed.`
                    });
                }

                if (data.offline_servers > 0) {
                    insights.push({
                        type: 'warning',
                        icon: 'server',
                        title: 'Offline Servers',
                        description: `${data.offline_servers} servers are currently offline.`
                    });
                }

                this.renderInsights(insights);
            }
        } catch (error) {
            console.error('Error generating insights:', error);
        }
    }

    exportData() {
        const data = {
            timestamp: new Date().toISOString(),
            timeRange: this.currentTimeRange,
            serverFilter: this.currentServerFilter,
            note: 'Real-time analytics data export'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize analytics when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsManager = new AnalyticsManager();
});
