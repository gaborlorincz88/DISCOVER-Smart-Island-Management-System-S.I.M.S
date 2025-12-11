// Load tourist origins analytics
async function loadTouristOrigins() {
    try {
        console.log('Loading tourist origins data...');
        
        const response = await fetch('/api/auth/analytics/tourist-origins');
        const data = await response.json();
        
        if (data.success && data.analytics) {
            displayTouristOrigins(data.analytics);
        } else {
            console.error('Failed to load tourist origins:', data.error);
            showTouristOriginsError('Failed to load tourist origins data');
        }
    } catch (error) {
        console.error('Error loading tourist origins:', error);
        showTouristOriginsError('Error loading tourist origins data');
    }
}

// Display tourist origins analytics
function displayTouristOrigins(analytics) {
    // Registration overview - using stat cards like general analytics
    const overviewHtml = `
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-user-plus"></i>
            </div>
            <div class="stat-content">
                <div class="stat-label">Total Registrations</div>
                <div class="stat-value">${analytics.totalRegistrations}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-map-marker-alt"></i>
            </div>
            <div class="stat-content">
                <div class="stat-label">With Location Data</div>
                <div class="stat-value">${analytics.registrationsWithLocation}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-percentage"></i>
            </div>
            <div class="stat-content">
                <div class="stat-label">Coverage Rate</div>
                <div class="stat-value">${analytics.summary.coveragePercentage}%</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-clock"></i>
            </div>
            <div class="stat-content">
                <div class="stat-label">With Stay Duration</div>
                <div class="stat-value">${analytics.registrationsWithPlannedStay || 0}</div>
            </div>
        </div>
    `;
    document.getElementById('registration-overview').innerHTML = overviewHtml;
    
    // Top origins - table format
    const topOriginsHtml = `
        <table class="origins-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Location</th>
                    <th>Tourists</th>
                </tr>
            </thead>
            <tbody>
                ${analytics.locationStats.slice(0, 10).map((item, index) => `
                    <tr>
                        <td class="rank-cell">
                            <span class="rank-badge">${index + 1}</span>
                        </td>
                        <td class="location-cell">
                            <i class="fas fa-map-marker-alt"></i>
                            ${item.location}
                        </td>
                        <td class="count-cell">${item.count}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    document.getElementById('top-origins').innerHTML = topOriginsHtml || '<div class="no-data">No location data available</div>';
    
    // Complete breakdown - table format
    const breakdownHtml = `
        <table class="origins-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Location</th>
                    <th>Tourists</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${analytics.locationStats.map((item, index) => `
                    <tr>
                        <td class="rank-cell">
                            <span class="rank-badge">${index + 1}</span>
                        </td>
                        <td class="location-cell">
                            <i class="fas fa-map-marker-alt"></i>
                            ${item.location}
                        </td>
                        <td class="count-cell">${item.count}</td>
                        <td class="percentage-cell">
                            <div class="percentage-bar-container">
                                <div class="percentage-bar" style="width: ${Math.round((item.count / analytics.registrationsWithLocation) * 100)}%"></div>
                                <span class="percentage-text">${Math.round((item.count / analytics.registrationsWithLocation) * 100)}%</span>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    document.getElementById('location-breakdown').innerHTML = breakdownHtml || '<div class="no-data">No location data available</div>';
    
    // Create detailed charts
    createTouristOriginsCharts(analytics);
}

// Create detailed charts for tourist origins
function createTouristOriginsCharts(analytics) {
    // Destroy existing charts if they exist
    if (window.touristOriginsChart) {
        window.touristOriginsChart.destroy();
    }
    if (window.touristOriginsPieChart) {
        window.touristOriginsPieChart.destroy();
    }
    if (window.plannedStayChart) {
        window.plannedStayChart.destroy();
    }
    if (window.stayDurationTimelineChart) {
        window.stayDurationTimelineChart.destroy();
    }
    
    // Create chart containers if they don't exist
    let chartsContainer = document.getElementById('tourist-origins-charts-container');
    if (!chartsContainer) {
        chartsContainer = document.createElement('div');
        chartsContainer.id = 'tourist-origins-charts-container';
        chartsContainer.className = 'analytics-container';
        chartsContainer.style.marginTop = '30px';
        
        // Create side-by-side container for bar and pie charts
        const sideBySideDiv = document.createElement('div');
        sideBySideDiv.className = 'analytics-container side-by-side';
        sideBySideDiv.innerHTML = `
            <div class="analytics-card">
                <h3><i class="fas fa-chart-bar"></i> Origins by Count</h3>
                <canvas id="originsBarChart"></canvas>
            </div>
            <div class="analytics-card">
                <h3><i class="fas fa-chart-pie"></i> Origins Distribution</h3>
                <canvas id="originsPieChart"></canvas>
            </div>
        `;
        
        // Create separate container for timeline chart
        const timelineDiv = document.createElement('div');
        timelineDiv.className = 'analytics-container';
        timelineDiv.innerHTML = `
            <div class="analytics-card">
                <h3><i class="fas fa-chart-line"></i> Origins Timeline</h3>
                <canvas id="originsTimelineChart"></canvas>
            </div>
        `;
        
        // Create side-by-side container for stay duration charts
        const stayDurationDiv = document.createElement('div');
        stayDurationDiv.className = 'analytics-container side-by-side';
        stayDurationDiv.innerHTML = `
            <div class="analytics-card">
                <h3><i class="fas fa-clock"></i> Planned Stay Duration</h3>
                <canvas id="plannedStayChart"></canvas>
            </div>
            <div class="analytics-card">
                <h3><i class="fas fa-calendar-alt"></i> Stay Duration Timeline</h3>
                <canvas id="stayDurationTimelineChart"></canvas>
            </div>
        `;
        
        chartsContainer.appendChild(sideBySideDiv);
        chartsContainer.appendChild(timelineDiv);
        chartsContainer.appendChild(stayDurationDiv);
        
        // Insert after the side-by-side container
        const sideBySideContainer = document.getElementById('location-breakdown').closest('.side-by-side');
        sideBySideContainer.parentNode.insertBefore(chartsContainer, sideBySideContainer.nextSibling);
    }
    
    // Prepare data
    const locations = analytics.locationStats.map(item => item.location);
    const counts = analytics.locationStats.map(item => item.count);
    
    // Generate colors for charts - create a consistent color mapping
    const colorPalette = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
        '#14b8a6', '#eab308', '#dc2626', '#7c3aed', '#0891b2'
    ];
    
    // Create a color map for each location to ensure consistency
    const locationColorMap = {};
    analytics.locationStats.forEach((item, index) => {
        locationColorMap[item.location] = colorPalette[index % colorPalette.length];
    });
    
    const colors = locations.map(loc => locationColorMap[loc]);
    
    // Store the color map globally for timeline chart
    window.locationColorMap = locationColorMap;
    
    // Create bar chart
    const barCtx = document.getElementById('originsBarChart').getContext('2d');
    window.touristOriginsChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: locations,
            datasets: [{
                label: 'Tourists',
                data: counts,
                backgroundColor: colors.map(color => color + '80'),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f3f4f6',
                    bodyColor: '#d1d5db',
                    borderColor: 'rgba(75, 85, 99, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const percentage = Math.round((context.parsed.y / analytics.registrationsWithLocation) * 100);
                            return `${context.parsed.y} tourists (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)'
                    }
                },
                x: {
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            size: 11
                        },
                        maxRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    // Create pie chart
    const pieCtx = document.getElementById('originsPieChart').getContext('2d');
    window.touristOriginsPieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: locations,
            datasets: [{
                data: counts,
                backgroundColor: colors.map(color => color + 'CC'), // Add slight transparency to match timeline
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#d1d5db',
                        font: {
                            size: 11
                        },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f3f4f6',
                    bodyColor: '#d1d5db',
                    borderColor: 'rgba(75, 85, 99, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const percentage = Math.round((context.parsed / analytics.registrationsWithLocation) * 100);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '50%'
        }
    });
    
    // Create timeline chart (mock data for demonstration)
    const timelineCtx = document.getElementById('originsTimelineChart').getContext('2d');
    const timelineData = generateTimelineData(analytics);
    
    window.touristOriginsTimelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: timelineData.labels,
            datasets: timelineData.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 2.5,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'start',
                    labels: {
                        color: '#d1d5db',
                        font: {
                            size: 11,
                            weight: '500'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 12,
                        boxWidth: 12,
                        boxHeight: 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f3f4f6',
                    bodyColor: '#d1d5db',
                    borderColor: 'rgba(75, 85, 99, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    intersect: false,
                    mode: 'index',
                    titleFont: {
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 12
                    },
                    callbacks: {
                        title: function(context) {
                            return `Month: ${context[0].label}`;
                        },
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            return `${label}: ${value} user${value !== 1 ? 's' : ''}`;
                        },
                        footer: function(tooltipItems) {
                            const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
                            return `Total: ${total} users`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            size: 10
                        },
                        stepSize: 1,
                        precision: 0,
                        callback: function(value) {
                            return Number.isInteger(value) ? value : '';
                        }
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.2)',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Cumulative Users',
                        color: '#d1d5db',
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                },
                x: {
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            size: 10
                        },
                        maxRotation: 45,
                        minRotation: 0
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.2)',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Month (2024)',
                        color: '#d1d5db',
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                }
            },
            elements: {
                point: {
                    hoverBorderWidth: 3
                }
            }
        }
    });
    
    // Create planned stay duration chart
    if (analytics.stayDurationStats && analytics.stayDurationStats.length > 0) {
        const stayCtx = document.getElementById('plannedStayChart').getContext('2d');
        const durations = analytics.stayDurationStats.map(item => item.duration);
        const durationCounts = analytics.stayDurationStats.map(item => item.count);
        
        // Color gradient from short stays to long stays
        const stayColors = [
            '#ef4444', // red for 1-3 days
            '#f97316', // orange for 4-7 days
            '#f59e0b', // amber for 1-2 weeks
            '#eab308', // yellow for 2-4 weeks
            '#84cc16', // lime for 1-3 months
            '#10b981', // green for 3-6 months
            '#06b6d4', // cyan for 6+ months
            '#8b5cf6'  // purple for local resident
        ];
        
        window.plannedStayChart = new Chart(stayCtx, {
            type: 'bar',
            data: {
                labels: durations,
                datasets: [{
                    label: 'Tourists',
                    data: durationCounts,
                    backgroundColor: stayColors.slice(0, durations.length).map(c => c + '80'),
                    borderColor: stayColors.slice(0, durations.length),
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#f3f4f6',
                        bodyColor: '#d1d5db',
                        borderColor: 'rgba(75, 85, 99, 0.3)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const total = analytics.registrationsWithPlannedStay;
                                const percentage = total > 0 ? Math.round((context.parsed.y / total) * 100) : 0;
                                return `${context.parsed.y} tourists (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                size: 12
                            },
                            stepSize: 1,
                            precision: 0,
                            callback: function(value) {
                                return Number.isInteger(value) ? value : '';
                            }
                        },
                        grid: {
                            color: 'rgba(75, 85, 99, 0.3)'
                        },
                        title: {
                            display: true,
                            text: 'Number of Tourists',
                            color: '#d1d5db',
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Planned Stay Duration',
                            color: '#d1d5db',
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        }
                    }
                }
            }
        });
        
        // Create stay duration timeline chart
        const timelineData = generateStayDurationTimeline(analytics, stayColors);
        const stayTimelineCtx = document.getElementById('stayDurationTimelineChart').getContext('2d');
        
        window.stayDurationTimelineChart = new Chart(stayTimelineCtx, {
            type: 'line',
            data: {
                labels: timelineData.labels,
                datasets: timelineData.datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'start',
                        labels: {
                            color: '#d1d5db',
                            font: {
                                size: 10,
                                weight: '500'
                            },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 8,
                            boxWidth: 10,
                            boxHeight: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#f3f4f6',
                        bodyColor: '#d1d5db',
                        borderColor: 'rgba(75, 85, 99, 0.3)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        intersect: false,
                        mode: 'index',
                        titleFont: {
                            size: 13,
                            weight: '600'
                        },
                        bodyFont: {
                            size: 11
                        },
                        callbacks: {
                            title: function(context) {
                                return `Month: ${context[0].label}`;
                            },
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                return `${label}: ${value} registration${value !== 1 ? 's' : ''}`;
                            },
                            footer: function(tooltipItems) {
                                const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
                                return `Total: ${total} registrations`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                size: 10
                            },
                            stepSize: 1,
                            precision: 0,
                            callback: function(value) {
                                return Number.isInteger(value) ? value : '';
                            }
                        },
                        grid: {
                            color: 'rgba(75, 85, 99, 0.2)',
                            drawBorder: false
                        },
                        title: {
                            display: true,
                            text: 'Registrations per Month',
                            color: '#d1d5db',
                            font: {
                                size: 11,
                                weight: '500'
                            }
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                size: 10
                            },
                            maxRotation: 45,
                            minRotation: 0
                        },
                        grid: {
                            color: 'rgba(75, 85, 99, 0.2)',
                            drawBorder: false
                        },
                        title: {
                            display: true,
                            text: 'Last 12 Months',
                            color: '#d1d5db',
                            font: {
                                size: 11,
                                weight: '500'
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 3,
                        hoverRadius: 5,
                        hoverBorderWidth: 2
                    }
                }
            }
        });
    }
}

// Generate colors for charts
function generateChartColors(count) {
    const colors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
        '#14b8a6', '#eab308', '#dc2626', '#7c3aed', '#0891b2'
    ];
    
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(colors[i % colors.length]);
    }
    return result;
}

// Generate timeline data with real user registration dates
function generateTimelineData(analytics) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    // Create a map of locations to their monthly registrations
    const locationTimeline = {};
    
    // Initialize all locations with 12 months of zeros
    analytics.locationStats.forEach(location => {
        locationTimeline[location.location] = new Array(12).fill(0);
    });
    
    // Process real registration data if available
    if (analytics.rawData && analytics.rawData.registrations) {
        analytics.rawData.registrations.forEach(reg => {
            try {
                const regDate = new Date(reg.timestamp);
                if (regDate.getFullYear() === currentYear) {
                    const monthIndex = regDate.getMonth();
                    const eventData = JSON.parse(reg.event_data);
                    if (eventData.location && locationTimeline[eventData.location]) {
                        locationTimeline[eventData.location][monthIndex]++;
                    }
                }
            } catch (e) {
                console.log('Error parsing registration date:', e);
            }
        });
    }
    
    // Process direct user data if available
    if (analytics.rawData && analytics.rawData.directUsers) {
        analytics.rawData.directUsers.forEach(user => {
            try {
                const userDate = new Date(user.created_at);
                if (userDate.getFullYear() === currentYear) {
                    const monthIndex = userDate.getMonth();
                    if (user.location && locationTimeline[user.location]) {
                        locationTimeline[user.location][monthIndex]++;
                    }
                }
            } catch (e) {
                console.log('Error parsing user date:', e);
            }
        });
    }
    
    // Generate datasets for top 8 locations with actual data
    const topLocations = analytics.locationStats.slice(0, 8);
    const datasets = topLocations.map((location, index) => {
        // Use the global color map to ensure consistency across all charts
        const color = window.locationColorMap ? window.locationColorMap[location.location] : generateChartColors(8)[index];
        const monthlyData = locationTimeline[location.location] || new Array(12).fill(0);
        
        // Convert to cumulative data for better visualization
        const cumulativeData = [];
        let cumulative = 0;
        for (let i = 0; i < 12; i++) {
            cumulative += monthlyData[i];
            cumulativeData.push(cumulative);
        }
        
        return {
            label: location.location,
            data: cumulativeData,
            borderColor: color,
            backgroundColor: color + '15',
            borderWidth: 2.5,
            fill: false,
            tension: 0.3,
            pointBackgroundColor: color,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBorderWidth: 3,
            spanGaps: false
        };
    });
    
    return {
        labels: months,
        datasets: datasets
    };
}

// Generate stay duration timeline data
function generateStayDurationTimeline(analytics, stayColors) {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    // Create labels for the last 12 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = [];
    const monthKeys = []; // Store year-month for proper grouping
    
    for (let i = 11; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        labels.push(`${monthNames[month]} ${year}`);
        monthKeys.push(`${year}-${month}`);
    }
    
    // Define the duration categories in order
    const durationCategories = [
        '1-3 days',
        '4-7 days',
        '1-2 weeks',
        '2-4 weeks',
        '1-3 months',
        '3-6 months',
        '6+ months',
        'Local resident'
    ];
    
    // Create a map of durations to their monthly registrations
    const durationTimeline = {};
    
    // Initialize all durations with 12 months of zeros
    durationCategories.forEach(duration => {
        durationTimeline[duration] = new Array(12).fill(0);
    });
    
    // Process real registration data if available
    if (analytics.rawData && analytics.rawData.registrations) {
        analytics.rawData.registrations.forEach(reg => {
            try {
                const regDate = new Date(reg.timestamp);
                const yearMonth = `${regDate.getFullYear()}-${regDate.getMonth()}`;
                const monthIndex = monthKeys.indexOf(yearMonth);
                
                if (monthIndex !== -1) {
                    const eventData = JSON.parse(reg.event_data);
                    const duration = eventData.plannedStayDuration;
                    
                    if (duration && durationTimeline[duration]) {
                        durationTimeline[duration][monthIndex]++;
                    }
                }
            } catch (e) {
                console.log('Error parsing registration date:', e);
            }
        });
    }
    
    // Process direct user data if available
    if (analytics.rawData && analytics.rawData.directUsers) {
        analytics.rawData.directUsers.forEach(user => {
            try {
                const userDate = new Date(user.created_at);
                const yearMonth = `${userDate.getFullYear()}-${userDate.getMonth()}`;
                const monthIndex = monthKeys.indexOf(yearMonth);
                
                if (monthIndex !== -1) {
                    const duration = user.planned_stay_duration;
                    
                    if (duration && durationTimeline[duration]) {
                        durationTimeline[duration][monthIndex]++;
                    }
                }
            } catch (e) {
                console.log('Error parsing user date:', e);
            }
        });
    }
    
    // Generate datasets for each duration category
    const datasets = durationCategories.map((duration, index) => {
        const monthlyData = durationTimeline[duration];
        const color = stayColors[index] || '#6b7280';
        
        return {
            label: duration,
            data: monthlyData,
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointBackgroundColor: color,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointHoverBorderWidth: 2,
            spanGaps: false
        };
    }).filter(dataset => {
        // Only include datasets that have at least one non-zero value
        return dataset.data.some(value => value > 0);
    });
    
    return {
        labels: labels,
        datasets: datasets
    };
}

// Helper function to show error messages
function showTouristOriginsError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // Replace loading content with error
    document.querySelectorAll('#tourist-origins-tab .loading').forEach(loading => {
        loading.parentNode.replaceChild(errorDiv.cloneNode(true), loading);
    });
}
