// Chart instances
let histogramChart = null;
let pieChart = null;
let lineChart = null;
let boxPlotChart = null;
let predictionChart = null;
let currentData = null;
let selectedColumn = null;
let charts = {};

// Toast notification system
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate__animated animate__fadeIn`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.replace('animate__fadeIn', 'animate__fadeOut');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Enhanced file upload handling
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
        showToast('Please upload a CSV file', 'error');
        return;
    }

    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        complete: function(results) {
            if (results.data && results.data.length > 0) {
                currentData = results.data;
                populateColumnSelect();
                showToast('File uploaded successfully', 'success');
            } else {
                showToast('Empty or invalid CSV file', 'error');
            }
        },
        error: function(error) {
            console.error('Error parsing CSV:', error);
            showToast('Error parsing CSV file', 'error');
        }
    });
}

function populateColumnSelect() {
    const select = document.getElementById('columnSelect');
    if (!select) return;

    // Clear existing options
    select.innerHTML = '<option value="">Select a column...</option>';

    if (currentData && currentData.length > 0) {
        // Get column names from the first row
        const columns = Object.keys(currentData[0]);
        
        // Add options for each column
        columns.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            select.appendChild(option);
        });

        // Enable the select element
        select.disabled = false;
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // File input listener
    const fileInput = document.getElementById('csvFile');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Column select listener
    const columnSelect = document.getElementById('columnSelect');
    if (columnSelect) {
        columnSelect.addEventListener('change', (event) => {
            const selectedColumn = event.target.value;
            if (selectedColumn) {
                analyzeColumn(selectedColumn);
            }
        });
    }

    // Scroll to Top FAB functionality
    const fab = document.querySelector('.mobile-fab');

    // Show/hide FAB based on scroll position
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            fab.classList.add('visible');
        } else {
            fab.classList.remove('visible');
        }
    });

    // Smooth scroll to top
    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    fab.addEventListener('click', scrollToTop);
});

function analyzeColumn(columnName) {
    if (!currentData || !columnName) {
        showToast('Please select a valid column', 'warning');
        return;
    }

    try {
        // Extract column data
        const columnData = currentData.map(row => row[columnName]).filter(val => val !== null && val !== undefined);
        
        // Update UI elements
        document.getElementById('selectedColumn').textContent = columnName;
        document.getElementById('totalRecords').textContent = columnData.length;
        
        // Detect data type
        const dataType = detectDataType(columnData);
        document.getElementById('columnType').textContent = dataType;
        
        // Calculate statistics
        const stats = calculateStatistics(columnData, dataType);
        updateStatistics(stats);
        
        // Update visualizations
        updateVisualizations(columnData, columnName, dataType);
        
        showToast('Column analysis complete', 'success');
        
        // Enable prediction if numerical
        const predictButton = document.getElementById('startPrediction');
        if (predictButton) {
            predictButton.disabled = !['Integer', 'Float'].includes(dataType);
        }
    } catch (error) {
        console.error('Error analyzing column:', error);
        showToast('Error analyzing column', 'error');
    }
}

function calculateStatistics(data, dataType) {
    const stats = {
        uniqueCount: new Set(data.map(String)).size,
        missingCount: currentData.length - data.length,
        range: 'N/A'
    };

    if (['Integer', 'Float'].includes(dataType)) {
        const numbers = data.map(Number).filter(n => !isNaN(n));
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        stats.range = `${min.toFixed(2)} to ${max.toFixed(2)}`;
        stats.mean = (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2);
        stats.median = calculateMedian(numbers).toFixed(2);
    } else if (dataType === 'Date') {
        const dates = data.map(d => new Date(d)).filter(d => !isNaN(d));
        const min = new Date(Math.min(...dates));
        const max = new Date(Math.max(...dates));
        stats.range = `${min.toLocaleDateString()} to ${max.toLocaleDateString()}`;
    }

    return stats;
}

function updateStatistics(stats) {
    document.getElementById('uniqueValues').textContent = stats.uniqueCount;
    document.getElementById('missingData').textContent = 
        `${stats.missingCount} (${((stats.missingCount / currentData.length) * 100).toFixed(1)}%)`;
    document.getElementById('dataRange').textContent = stats.range;
    
    // Update additional statistics if available
    if (stats.mean) document.getElementById('meanValue').textContent = stats.mean;
    if (stats.median) document.getElementById('medianValue').textContent = stats.median;
}

function updateVisualizations(data, selectedColumn, dataType) {
    // Clear existing charts
    if (charts.distribution) charts.distribution.destroy();
    if (charts.timeSeries) charts.timeSeries.destroy();
    if (charts.correlation) charts.correlation.destroy();

    // Create appropriate charts based on data type
    if (['Integer', 'Float'].includes(dataType)) {
        createNumericalCharts(data, selectedColumn);
    } else if (dataType === 'Date') {
        createDateCharts(data, selectedColumn);
    } else {
        createCategoricalCharts(data, selectedColumn);
    }
}

function calculateMedian(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
}

function detectDataType(values) {
    if (values.length === 0) return 'Empty';

    // Get a sample of non-empty values
    const sample = values.find(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (!sample) return 'Empty';

    // Check for dates
    if (!isNaN(Date.parse(sample))) {
        const dateCount = values.filter(v => !isNaN(Date.parse(v))).length;
        if (dateCount / values.length > 0.8) return 'Date';
    }

    // Check for numbers
    const numbers = values.filter(v => !isNaN(parseFloat(v)) && isFinite(v));
    if (numbers.length / values.length > 0.8) {
        const integers = numbers.filter(n => Number.isInteger(parseFloat(n)));
        return integers.length === numbers.length ? 'Integer' : 'Float';
    }

    // Check for boolean
    const booleanValues = new Set(values.map(v => String(v).toLowerCase()));
    if (booleanValues.size <= 2 && 
        Array.from(booleanValues).every(v => ['true', 'false', '1', '0', 'yes', 'no'].includes(v))) {
        return 'Boolean';
    }

    // Check for categorical
    if (new Set(values).size <= values.length * 0.2) return 'Categorical';

    return 'Text';
}

function createNumericalCharts(data, selectedColumn) {
    // Distribution Chart (Histogram)
    const numbers = data.map(v => parseFloat(v)).filter(n => !isNaN(n));
    const bins = calculateHistogramBins(numbers);
    
    charts.distribution = new Chart(document.getElementById('distributionChart'), {
        type: 'bar',
        data: {
            labels: bins.map(b => b.label),
            datasets: [{
                label: 'Frequency',
                data: bins.map(b => b.count),
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribution',
                    color: '#f8fafc'
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: selectedColumn,
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'Frequency',
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });

    // Time Series Chart
    charts.timeSeries = new Chart(document.getElementById('timeSeriesChart'), {
        type: 'line',
        data: {
            labels: Array.from({ length: numbers.length }, (_, i) => i + 1),
            datasets: [{
                label: selectedColumn,
                data: numbers,
                borderColor: 'rgba(139, 92, 246, 1)',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Time Series',
                    color: '#f8fafc'
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Index',
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: selectedColumn,
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });

    // Correlation Chart (Scatter plot with trend line)
    const xValues = Array.from({ length: numbers.length }, (_, i) => i);
    const regression = calculateLinearRegression(xValues, numbers);
    const trendline = xValues.map(x => regression.slope * x + regression.intercept);

    charts.correlation = new Chart(document.getElementById('correlationChart'), {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Data Points',
                    data: numbers.map((y, i) => ({ x: i, y })),
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Trend Line',
                    data: trendline.map((y, i) => ({ x: i, y })),
                    type: 'line',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Trend Analysis',
                    color: '#f8fafc'
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Index',
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: selectedColumn,
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });
}

function calculateHistogramBins(numbers) {
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const binCount = Math.min(20, Math.ceil(Math.sqrt(numbers.length)));
    const binWidth = (max - min) / binCount;
    
    const bins = Array.from({ length: binCount }, (_, i) => ({
        min: min + i * binWidth,
        max: min + (i + 1) * binWidth,
        count: 0,
        label: ''
    }));

    numbers.forEach(num => {
        const binIndex = Math.min(
            binCount - 1,
            Math.floor((num - min) / binWidth)
        );
        bins[binIndex].count++;
    });

    bins.forEach(bin => {
        bin.label = `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}`;
    });

    return bins;
}

function calculateLinearRegression(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumXX = x.reduce((total, xi) => total + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

function createDateCharts(data, selectedColumn) {
    // Distribution Chart (Bar chart)
    const dates = data.map(v => new Date(v)).filter(d => !isNaN(d));
    const bins = calculateDateBins(dates);
    
    charts.distribution = new Chart(document.getElementById('distributionChart'), {
        type: 'bar',
        data: {
            labels: bins.map(b => b.label),
            datasets: [{
                label: 'Frequency',
                data: bins.map(b => b.count),
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribution',
                    color: '#f8fafc'
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: selectedColumn,
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'Frequency',
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });

    // Time Series Chart
    charts.timeSeries = new Chart(document.getElementById('timeSeriesChart'), {
        type: 'line',
        data: {
            labels: Array.from({ length: dates.length }, (_, i) => i + 1),
            datasets: [{
                label: selectedColumn,
                data: dates.map(d => d.getTime()),
                borderColor: 'rgba(139, 92, 246, 1)',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Time Series',
                    color: '#f8fafc'
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Index',
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: selectedColumn,
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });

    // Correlation Chart (Scatter plot with trend line)
    const xValues = Array.from({ length: dates.length }, (_, i) => i);
    const regression = calculateLinearRegression(xValues, dates.map(d => d.getTime()));
    const trendline = xValues.map(x => regression.slope * x + regression.intercept);

    charts.correlation = new Chart(document.getElementById('correlationChart'), {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Data Points',
                    data: dates.map((d, i) => ({ x: i, y: d.getTime() })),
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Trend Line',
                    data: trendline.map((y, i) => ({ x: i, y })),
                    type: 'line',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Trend Analysis',
                    color: '#f8fafc'
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Index',
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: selectedColumn,
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });
}

function calculateDateBins(dates) {
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const binCount = Math.min(20, Math.ceil(Math.sqrt(dates.length)));
    const binWidth = (max - min) / binCount;
    
    const bins = Array.from({ length: binCount }, (_, i) => ({
        min: min + i * binWidth,
        max: min + (i + 1) * binWidth,
        count: 0,
        label: ''
    }));

    dates.forEach(date => {
        const binIndex = Math.min(
            binCount - 1,
            Math.floor((date - min) / binWidth)
        );
        bins[binIndex].count++;
    });

    bins.forEach(bin => {
        bin.label = `${bin.min.toLocaleDateString()} - ${bin.max.toLocaleDateString()}`;
    });

    return bins;
}

function createCategoricalCharts(data, selectedColumn) {
    // Distribution Chart (Bar chart)
    const categories = Array.from(new Set(data));
    const counts = categories.map(category => data.filter(v => v === category).length);
    
    charts.distribution = new Chart(document.getElementById('distributionChart'), {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Frequency',
                data: counts,
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribution',
                    color: '#f8fafc'
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: selectedColumn,
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'Frequency',
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });

    // Time Series Chart
    charts.timeSeries = new Chart(document.getElementById('timeSeriesChart'), {
        type: 'line',
        data: {
            labels: Array.from({ length: data.length }, (_, i) => i + 1),
            datasets: [{
                label: selectedColumn,
                data: data.map(v => categories.indexOf(v)),
                borderColor: 'rgba(139, 92, 246, 1)',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Time Series',
                    color: '#f8fafc'
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Index',
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: selectedColumn,
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });

    // Correlation Chart (Scatter plot with trend line)
    const xValues = Array.from({ length: data.length }, (_, i) => i);
    const regression = calculateLinearRegression(xValues, data.map(v => categories.indexOf(v)));
    const trendline = xValues.map(x => regression.slope * x + regression.intercept);

    charts.correlation = new Chart(document.getElementById('correlationChart'), {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Data Points',
                    data: data.map((v, i) => ({ x: i, y: categories.indexOf(v) })),
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Trend Line',
                    data: trendline.map((y, i) => ({ x: i, y })),
                    type: 'line',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Trend Analysis',
                    color: '#f8fafc'
                },
                legend: {
                    labels: { color: '#f8fafc' }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Index',
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: selectedColumn,
                        color: '#f8fafc'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });
}

// Prediction functionality
function startPrediction() {
    const selectedColumn = document.getElementById('columnSelect').value;
    if (!selectedColumn || !currentData) {
        showToast('Please select a column first', 'warning');
        return;
    }

    try {
        // Get numerical values
        const values = currentData
            .map(row => parseFloat(row[selectedColumn]))
            .filter(val => !isNaN(val));

        if (values.length === 0) {
            showToast('Selected column contains no numerical data', 'error');
            return;
        }

        // Get prediction parameters
        const futurePoints = parseInt(document.getElementById('futurePoints').value) || 5;
        const confidenceLevel = parseInt(document.getElementById('confidenceLevel').value) || 95;

        // Calculate predictions
        const predictions = calculatePredictions(values, futurePoints, confidenceLevel);
        
        // Update UI with predictions
        updatePredictionUI(predictions, selectedColumn);
        
        // Create visualization
        createPredictionVisualization(values, predictions, selectedColumn);

        showToast('Prediction analysis complete', 'success');
    } catch (error) {
        console.error('Error in prediction:', error);
        showToast('Error generating prediction', 'error');
    }
}

function calculatePredictions(values, futurePoints, confidenceLevel) {
    // Calculate trend using linear regression
    const xValues = Array.from({ length: values.length }, (_, i) => i);
    const regression = calculateLinearRegression(xValues, values);

    // Generate future predictions
    const futurePredictions = [];
    const upperBound = [];
    const lowerBound = [];

    // Calculate standard error for confidence intervals
    const standardError = calculateStandardError(values, regression);
    const tValue = getTValue(confidenceLevel);
    const margin = tValue * standardError;

    // Generate predictions with confidence intervals
    for (let i = 0; i < futurePoints; i++) {
        const x = values.length + i;
        const prediction = regression.slope * x + regression.intercept;
        futurePredictions.push(prediction);
        upperBound.push(prediction + margin);
        lowerBound.push(prediction - margin);
    }

    return {
        trend: regression.slope,
        predictions: futurePredictions,
        upperBound,
        lowerBound,
        confidence: confidenceLevel,
        margin,
        nextValue: futurePredictions[0]
    };
}

function updatePredictionUI(predictions, columnName) {
    // Show prediction section
    const predictionSection = document.querySelector('.prediction-section');
    predictionSection.classList.remove('hidden');

    // Update prediction stats
    document.getElementById('trendDirection').textContent = 
        predictions.trend > 0 ? '📈 Upward' : predictions.trend < 0 ? '📉 Downward' : '➡️ Stable';
    
    document.getElementById('confidenceScore').textContent = 
        `${predictions.confidence}% (±${predictions.margin.toFixed(2)})`;
    
    document.getElementById('nextPrediction').textContent = 
        predictions.nextValue.toFixed(2);

    // Add additional prediction details
    const details = document.getElementById('predictionDetails');
    if (details) {
        details.innerHTML = `
            <div class="prediction-detail">
                <span>Column:</span> ${columnName}
            </div>
            <div class="prediction-detail">
                <span>Trend Strength:</span> ${Math.abs(predictions.trend).toFixed(4)}
            </div>
            <div class="prediction-detail">
                <span>Confidence Interval:</span> ±${predictions.margin.toFixed(2)}
            </div>
            <div class="prediction-detail">
                <span>Next 3 Values:</span> ${predictions.predictions.slice(0, 3).map(v => v.toFixed(2)).join(', ')}
            </div>
        `;
    }
}

function createPredictionVisualization(actualValues, predictions, columnName) {
    const ctx = document.getElementById('predictionChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (charts.prediction) {
        charts.prediction.destroy();
    }

    // Prepare data
    const labels = Array.from(
        { length: actualValues.length + predictions.predictions.length }, 
        (_, i) => i + 1
    );

    // Create new chart
    charts.prediction = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Actual Data',
                    data: [...actualValues, ...Array(predictions.predictions.length).fill(null)],
                    borderColor: 'rgba(99, 102, 241, 1)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'rgba(99, 102, 241, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(99, 102, 241, 1)'
                },
                {
                    label: 'Predictions',
                    data: [...Array(actualValues.length).fill(null), ...predictions.predictions],
                    borderColor: 'rgba(139, 92, 246, 1)',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'rgba(139, 92, 246, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(139, 92, 246, 1)'
                },
                {
                    label: 'Confidence Interval',
                    data: [...Array(actualValues.length).fill(null), ...predictions.upperBound],
                    borderColor: 'rgba(99, 102, 241, 0.2)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: '+1'
                },
                {
                    label: 'Confidence Interval',
                    data: [...Array(actualValues.length).fill(null), ...predictions.lowerBound],
                    borderColor: 'rgba(99, 102, 241, 0.2)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                title: {
                    display: true,
                    text: `Prediction Analysis for ${columnName}`,
                    color: '#f8fafc',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    labels: { color: '#f8fafc' }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            if (value === null) return null;
                            return `${context.dataset.label}: ${value.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time Points',
                        color: '#f8fafc'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: { color: '#f8fafc' }
                },
                y: {
                    title: {
                        display: true,
                        text: columnName,
                        color: '#f8fafc'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });

    // Add hover effects
    const canvas = document.getElementById('predictionChart');
    canvas.style.transition = 'transform 0.2s ease';
    canvas.addEventListener('mouseover', () => {
        canvas.style.transform = 'scale(1.02)';
    });
    canvas.addEventListener('mouseout', () => {
        canvas.style.transform = 'scale(1)';
    });
}

function calculateStandardError(values, regression) {
    const predictions = values.map((_, i) => regression.slope * i + regression.intercept);
    const residuals = values.map((y, i) => y - predictions[i]);
    const sumSquaredResiduals = residuals.reduce((sum, r) => sum + r * r, 0);
    return Math.sqrt(sumSquaredResiduals / (values.length - 2));
}

function getTValue(confidenceLevel) {
    // Simplified t-value lookup
    const tValues = {
        90: 1.645,
        95: 1.96,
        99: 2.576
    };
    return tValues[confidenceLevel] || 1.96;
}

// Add event listener for prediction button
document.addEventListener('DOMContentLoaded', () => {
    const predictionButton = document.getElementById('startPrediction');
    if (predictionButton) {
        predictionButton.addEventListener('click', startPrediction);
    }
});

// Initialize charts
let distributionChart, timeSeriesChart, correlationChart;

function createTimeSeriesChart(data, selectedColumn) {
    if (timeSeriesChart) timeSeriesChart.destroy();

    const values = data.map(row => parseFloat(row[selectedColumn])).filter(val => !isNaN(val));
    const timeSeriesCtx = document.getElementById('timeSeriesChart').getContext('2d');
    
    // Create gradient for area fill
    const gradientFill = timeSeriesCtx.createLinearGradient(0, 0, 0, 400);
    gradientFill.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradientFill.addColorStop(1, 'rgba(139, 92, 246, 0.02)');

    // Calculate moving average for smoother line
    const movingAverageWindow = 5;
    const movingAverages = calculateMovingAverage(values, movingAverageWindow);

    timeSeriesChart = new Chart(timeSeriesCtx, {
        type: 'line',
        data: {
            labels: Array.from({ length: values.length }, (_, i) => i + 1),
            datasets: [
                {
                    label: 'Raw Data',
                    data: values,
                    borderColor: 'rgba(139, 92, 246, 0.5)',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    pointBackgroundColor: 'rgba(139, 92, 246, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(139, 92, 246, 1)',
                    order: 2
                },
                {
                    label: 'Trend Line',
                    data: movingAverages,
                    borderColor: 'rgba(139, 92, 246, 1)',
                    backgroundColor: gradientFill,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: true,
                    tension: 0.4,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart',
                delay: (context) => context.dataIndex * 5
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Time Series Analysis',
                    color: '#f8fafc',
                    font: {
                        size: 18,
                        weight: 'bold',
                        family: "'Segoe UI', sans-serif"
                    },
                    padding: 20
                },
                legend: {
                    display: true,
                    labels: {
                        color: '#f8fafc',
                        font: {
                            size: 14,
                            family: "'Segoe UI', sans-serif"
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 15
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: {
                        size: 14,
                        weight: 'bold',
                        family: "'Segoe UI', sans-serif"
                    },
                    bodyFont: {
                        size: 13,
                        family: "'Segoe UI', sans-serif"
                    },
                    callbacks: {
                        title: (items) => `Time Point: ${items[0].label}`,
                        label: (context) => {
                            const label = context.dataset.label;
                            const value = context.raw.toFixed(2);
                            return `${label}: ${value}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time Points',
                        color: '#f8fafc',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: "'Segoe UI', sans-serif"
                        },
                        padding: { top: 10 }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false,
                        tickLength: 0
                    },
                    ticks: {
                        color: '#f8fafc',
                        font: {
                            size: 12,
                            family: "'Segoe UI', sans-serif"
                        },
                        maxTicksLimit: 10
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: selectedColumn,
                        color: '#f8fafc',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: "'Segoe UI', sans-serif"
                        },
                        padding: { bottom: 10 }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false,
                        tickLength: 0
                    },
                    ticks: {
                        color: '#f8fafc',
                        font: {
                            size: 12,
                            family: "'Segoe UI', sans-serif"
                        },
                        callback: (value) => value.toFixed(2)
                    }
                }
            }
        }
    });

    return timeSeriesChart;
}

// Helper function to calculate moving average
function calculateMovingAverage(values, window) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
        let sum = 0;
        let count = 0;
        
        for (let j = Math.max(0, i - Math.floor(window/2)); 
             j < Math.min(values.length, i + Math.floor(window/2) + 1); 
             j++) {
            sum += values[j];
            count++;
        }
        
        result.push(sum / count);
    }
    return result;
}

// Update function specifically for time series
function updateTimeSeriesChart(data, selectedColumn) {
    document.querySelector('.chart-box').classList.add('chart-loading');

    setTimeout(() => {
        createTimeSeriesChart(data, selectedColumn);
        
        document.querySelector('.chart-box').classList.remove('chart-loading');
        document.querySelector('.chart-box').classList.add('chart-animate');
    }, 300);
}

function createDistributionChart(data, selectedColumn) {
    if (distributionChart) distributionChart.destroy();

    const values = data.map(row => parseFloat(row[selectedColumn])).filter(val => !isNaN(val));
    const distributionCtx = document.getElementById('distributionChart').getContext('2d');
    
    // Create gradient
    const gradient = distributionCtx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.6)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.1)');

    // Calculate bins
    const bins = calculateDistribution(values);

    distributionChart = new Chart(distributionCtx, {
        type: 'bar',
        data: {
            labels: bins.map(bin => bin.label),
            datasets: [{
                label: 'Frequency Distribution',
                data: bins.map(bin => bin.count),
                backgroundColor: gradient,
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: 'rgba(99, 102, 241, 0.8)',
                barPercentage: 0.95,
                categoryPercentage: 0.95
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart',
                from: {
                    y: 500
                },
                delay: (context) => context.dataIndex * 100
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Value Distribution Analysis',
                    color: '#f8fafc',
                    font: {
                        size: 18,
                        weight: 'bold',
                        family: "'Segoe UI', sans-serif"
                    },
                    padding: 20
                },
                legend: {
                    display: true,
                    labels: {
                        color: '#f8fafc',
                        font: {
                            size: 14,
                            family: "'Segoe UI', sans-serif"
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: {
                        size: 14,
                        weight: 'bold',
                        family: "'Segoe UI', sans-serif"
                    },
                    bodyFont: {
                        size: 13,
                        family: "'Segoe UI', sans-serif"
                    },
                    callbacks: {
                        title: (items) => `Range: ${items[0].label}`,
                        label: (item) => `Frequency: ${item.raw}`,
                        afterLabel: (item) => {
                            const percentage = (item.raw / values.length * 100).toFixed(1);
                            return `Percentage: ${percentage}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Value Ranges',
                        color: '#f8fafc',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: "'Segoe UI', sans-serif"
                        },
                        padding: { top: 10 }
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#f8fafc',
                        font: {
                            size: 12,
                            family: "'Segoe UI', sans-serif"
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Frequency Count',
                        color: '#f8fafc',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: "'Segoe UI', sans-serif"
                        },
                        padding: { bottom: 10 }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false,
                        lineWidth: 0.5
                    },
                    ticks: {
                        color: '#f8fafc',
                        font: {
                            size: 12,
                            family: "'Segoe UI', sans-serif"
                        },
                        callback: (value) => Math.round(value)
                    }
                }
            }
        }
    });

    return distributionChart;
}

// Helper function to calculate distribution bins
function calculateDistribution(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = 20;
    const binWidth = (max - min) / binCount;
    
    const bins = [];
    const counts = new Array(binCount).fill(0);
    
    for (let i = 0; i < binCount; i++) {
        bins.push(min + (i * binWidth));
    }
    
    values.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1);
        counts[binIndex]++;
    });
    
    return bins.map((bin, i) => ({
        label: `${bin.toFixed(1)}-${(bin + binWidth).toFixed(1)}`,
        count: counts[i]
    }));
}

// Update function to use the new distribution chart
function updateDistributionChart(data, selectedColumn) {
    document.querySelector('.chart-box').classList.add('chart-loading');

    setTimeout(() => {
        createDistributionChart(data, selectedColumn);
        
        document.querySelector('.chart-box').classList.remove('chart-loading');
        document.querySelector('.chart-box').classList.add('chart-animate');
    }, 300);
}