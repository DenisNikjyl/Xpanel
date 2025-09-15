// Xpanel - Monitoring JavaScript

class MonitoringManager {
    constructor() {
        this.charts = {};
        this.chartData = {
            cpu: [],
            memory: [],
            disk: [],
            network: []
        };
        this.maxDataPoints = 50;
        this.init();
    }

    init() {
        this.initCharts();
        this.setupWebSocketHandlers();
    }

    initCharts() {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded, loading from CDN...');
            this.loadChartJS().then(() => {
                this.createCharts();
            });
        } else {
            this.createCharts();
        }
    }

    async loadChartJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    createCharts() {
        this.createCPUChart();
        this.createMemoryChart();
    }

    createCPUChart() {
        const ctx = document.getElementById('cpu-chart');
        if (!ctx) return;

        this.charts.cpu = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Usage (%)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Загрузка процессора',
                        color: '#f8fafc'
                    },
                    legend: {
                        labels: {
                            color: '#cbd5e1'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: '#475569'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: '#475569'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    createMemoryChart() {
        const ctx = document.getElementById('memory-chart');
        if (!ctx) return;

        this.charts.memory = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Memory Usage (%)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Использование памяти',
                        color: '#f8fafc'
                    },
                    legend: {
                        labels: {
                            color: '#cbd5e1'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: '#475569'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: '#475569'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    setupWebSocketHandlers() {
        // WebSocket handlers will be set up when WebSocket is enabled
        if (typeof ws !== 'undefined' && ws) {
            ws.on('system_stats', (data) => {
                this.updateCharts(data);
            });
        }
    }

    updateCharts(stats) {
        if (!stats || !stats.timestamp) return;

        const timestamp = new Date(stats.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Update CPU chart
        if (this.charts.cpu && stats.cpu) {
            this.addDataPoint('cpu', timestamp, stats.cpu.usage);
        }

        // Update Memory chart
        if (this.charts.memory && stats.memory) {
            this.addDataPoint('memory', timestamp, stats.memory.percent);
        }
    }

    addDataPoint(chartType, label, value) {
        const chart = this.charts[chartType];
        if (!chart) return;

        const data = chart.data;
        
        // Add new data point
        data.labels.push(label);
        data.datasets[0].data.push(value);

        // Remove old data points if we have too many
        if (data.labels.length > this.maxDataPoints) {
            data.labels.shift();
            data.datasets[0].data.shift();
        }

        // Update chart
        chart.update('none'); // 'none' for no animation to improve performance
    }

    clearCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.data.labels = [];
                chart.data.datasets[0].data = [];
                chart.update();
            }
        });
    }

    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Initialize monitoring manager
document.addEventListener('DOMContentLoaded', () => {
    window.monitoringManager = new MonitoringManager();
});
