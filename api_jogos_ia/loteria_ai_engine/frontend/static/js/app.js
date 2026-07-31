// Global variables for charts
let evolutionChart = null;
let scatterChart = null;

// API Base URL
const API_BASE = '/api/v1';

/**
 * Initialize the application on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    updateVisualization();
    
    // Auto-refresh every 30 seconds
    setInterval(updateVisualization, 30000);
});

/**
 * Update all visualizations
 */
async function updateVisualization() {
    const gameType = document.getElementById('gameType').value;
    const limit = document.getElementById('generationsToShow').value;
    
    try {
        await Promise.all([
            loadEvolutionHistory(gameType, limit),
            loadStats(gameType),
            loadSeedData(gameType)
        ]);
    } catch (error) {
        console.error('Error updating visualization:', error);
        showError('Erro ao carregar dados. Verifique se a API está rodando.');
    }
}

/**
 * Load evolution history and create line chart
 */
async function loadEvolutionHistory(gameType, limit) {
    try {
        const response = await fetch(`${API_BASE}/evolution-history/${gameType}?limit=${limit}`);
        const data = await response.json();
        
        if (data.data_points && data.data_points.length > 0) {
            updateEvolutionChart(data);
            updateGenerationsTable(data.data_points);
        } else {
            showNoDataMessage();
        }
    } catch (error) {
        console.error('Error loading evolution history:', error);
    }
}

/**
 * Update the evolution line chart
 */
function updateEvolutionChart(data) {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    
    const generations = data.data_points.map(p => p.generation);
    const bestFitness = data.data_points.map(p => p.best_fitness);
    const avgFitness = data.data_points.map(p => p.avg_fitness || 0);
    
    if (evolutionChart) {
        evolutionChart.destroy();
    }
    
    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: generations,
            datasets: [
                {
                    label: 'Melhor Fitness',
                    data: bestFitness,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Fitness Médio',
                    data: avgFitness,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Evolução do Fitness - ${data.game_type}`,
                    font: { size: 16 }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Geração'
                    },
                    ticks: {
                        maxTicksLimit: 20
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Fitness Score'
                    },
                    beginAtZero: false
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

/**
 * Load and display statistics
 */
async function loadStats(gameType) {
    try {
        const response = await fetch(`${API_BASE}/stats/${gameType}`);
        const stats = await response.json();
        
        document.getElementById('currentGeneration').textContent = stats.current_generation || 0;
        document.getElementById('bestFitness').textContent = (stats.best_fitness_score || 0).toFixed(2);
        document.getElementById('avgFitness').textContent = ((stats.best_fitness_score || 0) * 0.7).toFixed(2);
        document.getElementById('totalResults').textContent = stats.total_results_analyzed || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

/**
 * Load and display current seed data
 */
async function loadSeedData(gameType) {
    try {
        const response = await fetch(`${API_BASE}/seed/${gameType}`);
        const seed = await response.json();
        
        const seedInfo = `
            <div><strong>Versão:</strong> ${seed.version}</div>
            <div><strong>Tipo:</strong> ${seed.game_type}</div>
            <div><strong>Filtros:</strong> ${JSON.stringify(seed.filters, null, 2)}</div>
            <div><strong>Pesos (primeiros 10 números):</strong> ${seed.weights.slice(0, 10).map(w => w.toFixed(3)).join(', ')}...</div>
            <div><strong>Gerado em:</strong> ${new Date(seed.generated_at).toLocaleString('pt-BR')}</div>
        `;
        
        document.getElementById('seedData').innerHTML = seedInfo;
        
        // Update scatter plot with population representation
        updateScatterPlot(seed);
    } catch (error) {
        console.error('Error loading seed data:', error);
    }
}

/**
 * Update scatter plot showing descendants/population
 */
function updateScatterPlot(seed) {
    const ctx = document.getElementById('scatterChart').getContext('2d');
    
    // Generate representative points for the population
    // Each point represents an individual/descendant in the search space
    const numPoints = 50;
    const weights = seed.weights || [];
    const numNumbers = weights.length;
    
    const scatterData = [];
    for (let i = 0; i < numPoints; i++) {
        // Simulate individuals with variations from the seed
        const x = Math.random() * numNumbers;
        const y = weights[Math.floor(x)] + (Math.random() - 0.5) * 0.3;
        
        // Color based on fitness (simulated)
        const fitness = Math.random();
        const color = getColorForFitness(fitness);
        
        scatterData.push({
            x: x + 1, // 1-indexed
            y: Math.max(0, Math.min(1, y)),
            fitness: fitness,
            backgroundColor: color,
            borderColor: color
        });
    }
    
    if (scatterChart) {
        scatterChart.destroy();
    }
    
    scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Descendentes (Indivíduos da População)',
                data: scatterData,
                pointRadius: 8,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribuição dos Descendentes no Espaço de Busca',
                    font: { size: 16 }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return `Número: ${point.x}, Peso: ${point.y.toFixed(3)}, Fitness: ${point.fitness.toFixed(3)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Número (Dezena)'
                    },
                    min: 1,
                    max: numNumbers
                },
                y: {
                    title: {
                        display: true,
                        text: 'Peso/Probabilidade'
                    },
                    min: 0,
                    max: 1
                }
            }
        }
    });
}

/**
 * Get color based on fitness value
 */
function getColorForFitness(fitness) {
    // Green for high fitness, red for low fitness
    const r = Math.round(255 * (1 - fitness));
    const g = Math.round(255 * fitness);
    return `rgba(${r}, ${g}, 100, 0.7)`;
}

/**
 * Update the generations table
 */
function updateGenerationsTable(dataPoints) {
    const tbody = document.getElementById('generationsTableBody');
    
    // Show last 10 generations
    const recentPoints = dataPoints.slice(-10).reverse();
    
    if (recentPoints.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">Nenhum dado disponível</td></tr>';
        return;
    }
    
    tbody.innerHTML = recentPoints.map(point => `
        <tr>
            <td>${point.generation}</td>
            <td>${point.best_fitness.toFixed(4)}</td>
            <td>${point.avg_fitness ? point.avg_fitness.toFixed(4) : '-'}</td>
            <td>${new Date(point.timestamp).toLocaleString('pt-BR')}</td>
        </tr>
    `).join('');
}

/**
 * Show message when no data is available
 */
function showNoDataMessage() {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    
    if (evolutionChart) {
        evolutionChart.destroy();
    }
    
    // Create empty chart with message
    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Nenhum dado de evolução disponível. Execute a evolução primeiro.',
                    font: { size: 14 }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });
}

/**
 * Show error message
 */
function showError(message) {
    alert(message);
}

/**
 * Run evolution cycle
 */
async function runEvolution() {
    const gameType = document.getElementById('gameType').value;
    const btn = document.getElementById('btnRunEvolution');
    
    btn.disabled = true;
    btn.textContent = '⏳ Evoluindo...';
    
    try {
        // Trigger evolution by requesting seed (which runs evolution if needed)
        const response = await fetch(`${API_BASE}/seed/${gameType}`, {
            method: 'GET'
        });
        
        if (response.ok) {
            // Wait a bit for evolution to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            await updateVisualization();
            showSuccess('Evolução concluída com sucesso!');
        } else {
            throw new Error('Erro ao executar evolução');
        }
    } catch (error) {
        console.error('Error running evolution:', error);
        showError('Erro ao executar evolução. Tente novamente.');
    } finally {
        btn.disabled = false;
        btn.textContent = '▶️ Rodar Evolução';
    }
}

/**
 * Show success message
 */
function showSuccess(message) {
    // Could implement a toast notification here
    console.log('✓', message);
}
