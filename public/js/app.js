// PropertyPulse - Main Application JavaScript

const API_BASE = '/api';

// State
let currentPage = 'search';
let properties = [];
let pipeline = {
    lead: [],
    analyzing: [],
    offer: [],
    due_diligence: [],
    closing: [],
    closed: []
};
let marketData = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadProperties();
    loadPipeline();
    loadPropertySelect();
});

// Navigation
function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');
    
    currentPage = page;
    
    // Load page data
    if (page === 'market' && !marketData.location) {
        showMarketPlaceholder();
    }
}

// Properties
async function loadProperties(filters = {}) {
    try {
        const params = new URLSearchParams(filters).toString();
        const response = await fetch(`${API_BASE}/properties?${params}`);
        const data = await response.json();
        
        properties = data.properties;
        renderProperties(properties);
        updateResultsCount(data.total);
    } catch (error) {
        console.error('Error loading properties:', error);
        showToast('Error loading properties');
    }
}

function renderProperties(props) {
    const grid = document.getElementById('properties-grid');
    
    if (!props.length) {
        grid.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <p style="color: var(--gray-500); font-size: 1.125rem;">No properties found matching your criteria</p>
                <p style="color: var(--gray-400); margin-top: 0.5rem;">Try adjusting your filters</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = props.map(property => `
        <div class="property-card" onclick="showPropertyDetail('${property.id}')">
            <div class="property-image" style="background-image: url('${property.imageUrl || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800'}')">
                <span class="property-badge">${property.daysOnMarket} days on market</span>
                <span class="property-type">${property.subtype || property.type}</span>
            </div>
            <div class="property-content">
                <div class="property-price">$${formatNumber(property.price)}</div>
                <div class="property-title">${property.title}</div>
                <div class="property-address">${property.address}, ${property.city}, ${property.state} ${property.zip}</div>
                <div class="property-stats">
                    <div class="stat">
                        <div class="stat-value">${formatNumber(property.size)}</div>
                        <div class="stat-label">Sq Ft</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${property.capRate}%</div>
                        <div class="stat-label">Cap Rate</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${property.occupancy || 'N/A'}%</div>
                        <div class="stat-label">Occupancy</div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function updateResultsCount(total) {
    document.getElementById('results-count').textContent = `${total} properties found`;
}

function searchProperties() {
    const filters = {
        type: document.getElementById('filter-type').value,
        location: document.getElementById('filter-location').value,
        minPrice: document.getElementById('filter-min-price').value,
        maxPrice: document.getElementById('filter-max-price').value,
        minSize: document.getElementById('filter-min-size').value,
        maxSize: document.getElementById('filter-max-size').value
    };
    
    loadProperties(filters);
}

// Property Detail
async function showPropertyDetail(propertyId) {
    const property = properties.find(p => p.id === propertyId);
    if (!property) return;
    
    const content = document.getElementById('property-detail-content');
    content.innerHTML = `
        <div class="property-detail-grid">
            <div class="property-detail-image" style="background-image: url('${property.imageUrl || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800'}')"></div>
            <div class="property-detail-info">
                <h2>${property.title}</h2>
                <p style="color: var(--gray-500); margin-bottom: 0.5rem;">${property.address}, ${property.city}, ${property.state} ${property.zip}</p>
                <div class="property-detail-price">$${formatNumber(property.price)}</div>
                
                <div class="property-detail-stats">
                    <div class="detail-stat">
                        <div class="detail-stat-value">${formatNumber(property.size)} sq ft</div>
                        <div class="detail-stat-label">Size</div>
                    </div>
                    <div class="detail-stat">
                        <div class="detail-stat-value">${property.capRate}%</div>
                        <div class="detail-stat-label">Cap Rate</div>
                    </div>
                    <div class="detail-stat">
                        <div class="detail-stat-value">$${formatNumber(property.pricePerSqFt)}</div>
                        <div class="detail-stat-label">Per Sq Ft</div>
                    </div>
                    <div class="detail-stat">
                        <div class="detail-stat-value">${property.yearBuilt}</div>
                        <div class="detail-stat-label">Year Built</div>
                    </div>
                    <div class="detail-stat">
                        <div class="detail-stat-value">${property.occupancy || 'N/A'}%</div>
                        <div class="detail-stat-label">Occupancy</div>
                    </div>
                    <div class="detail-stat">
                        <div class="detail-stat-value">$${formatNumber(property.noi)}</div>
                        <div class="detail-stat-label">NOI</div>
                    </div>
                </div>
                
                <p style="color: var(--gray-600); margin: 1rem 0;">${property.description}</p>
                
                ${property.features ? `
                    <div style="margin-top: 1rem;">
                        <strong>Features:</strong>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                            ${property.features.map(f => `<span style="background: var(--gray-100); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem;">${f}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--gray-200);">
                    <p style="font-size: 0.875rem; color: var(--gray-500);">
                        <strong>MLS#:</strong> ${property.mlsNumber}<br>
                        <strong>Listed:</strong> ${new Date(property.listedDate).toLocaleDateString()}<br>
                        <strong>Agent:</strong> ${property.agent || 'Contact for info'}
                    </p>
                </div>
                
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="analyzeProperty('${property.id}')">📊 Analyze</button>
                    <button class="btn btn-secondary" onclick="addToPipelineFromDetail('${property.id}')">📋 Add to Pipeline</button>
                    <button class="btn btn-secondary" onclick="saveProperty('${property.id}')">❤️ Save</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('property-modal').classList.add('active');
}

function analyzeProperty(propertyId) {
    closeModal('property-modal');
    navigateTo('analysis');
    
    // Set the property and trigger analysis
    document.getElementById('analysis-property').value = propertyId;
    
    const property = properties.find(p => p.id === propertyId);
    if (property) {
        document.getElementById('analysis-price').value = property.price;
        document.getElementById('analysis-property').text = property.title;
    }
}

function addToPipelineFromDetail(propertyId) {
    closeModal('property-modal');
    openDealModal(propertyId);
}

// Pipeline
async function loadPipeline() {
    try {
        const response = await fetch(`${API_BASE}/pipeline/demo-user`);
        pipeline = response.json();
        renderPipeline();
    } catch (error) {
        console.error('Error loading pipeline:', error);
        // Use empty pipeline
        renderPipeline();
    }
}

function renderPipeline() {
    const board = document.getElementById('pipeline-board');
    
    const stages = [
        { id: 'lead', name: '💡 Lead' },
        { id: 'analyzing', name: '📊 Analyzing' },
        { id: 'offer', name: '💰 Offer Made' },
        { id: 'due_diligence', name: '🔍 Due Diligence' },
        { id: 'closing', name: '📝 Closing' },
        { id: 'closed', name: '✅ Closed' }
    ];
    
    board.innerHTML = stages.map(stage => `
        <div class="pipeline-stage" data-stage="${stage.id}">
            <div class="stage-header">
                <span class="stage-name">${stage.name}</span>
                <span class="stage-count">${pipeline[stage.id]?.length || 0}</span>
            </div>
            <div class="stage-deals" ondragover="allowDrop(event)" ondrop="dropDeal(event, '${stage.id}')">
                ${renderDealCards(pipeline[stage.id] || [])}
            </div>
        </div>
    `).join('');
}

function renderDealCards(deals) {
    if (!deals.length) {
        return `<p style="text-align: center; color: var(--gray-400); padding: 1rem;">Drop deals here</p>`;
    }
    
    return deals.map(deal => `
        <div class="deal-card" draggable="true" ondragstart="dragDeal(event, '${deal.id}', '${deal.stage}')" onclick="showPropertyDetail('${deal.propertyId}')">
            <div class="deal-title">${deal.title}</div>
            <div class="deal-price">$${formatNumber(deal.price)}</div>
            <div class="deal-meta">
                <span>${deal.type}</span>
                <span>${deal.date}</span>
            </div>
        </div>
    `).join('');
}

function dragDeal(event, dealId, stage) {
    event.dataTransfer.setData('dealId', dealId);
    event.dataTransfer.setData('fromStage', stage);
}

function allowDrop(event) {
    event.preventDefault();
}

async function dropDeal(event, toStage) {
    event.preventDefault();
    const dealId = event.dataTransfer.getData('dealId');
    const fromStage = event.dataTransfer.getData('fromStage');
    
    // Find and move deal
    const dealIndex = pipeline[fromStage]?.findIndex(d => d.id === dealId);
    if (dealIndex !== -1) {
        const [deal] = pipeline[fromStage].splice(dealIndex, 1);
        deal.stage = toStage;
        deal.date = new Date().toLocaleDateString();
        pipeline[toStage] = pipeline[toStage] || [];
        pipeline[toStage].push(deal);
        
        // Save to backend
        try {
            await fetch(`${API_BASE}/pipeline/demo-user/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dealId, fromStage, toStage })
            });
        } catch (error) {
            console.error('Error saving pipeline move:', error);
        }
        
        renderPipeline();
        showToast('Deal moved successfully');
    }
}

function openDealModal(propertyId = null) {
    if (propertyId) {
        document.getElementById('deal-property').value = propertyId;
    }
    document.getElementById('deal-modal').classList.add('active');
}

async function addToPipeline() {
    const propertyId = document.getElementById('deal-property').value;
    const stage = document.getElementById('deal-stage').value;
    const notes = document.getElementById('deal-notes').value;
    
    if (!propertyId) {
        showToast('Please select a property');
        return;
    }
    
    const property = properties.find(p => p.id === propertyId);
    if (!property) return;
    
    const deal = {
        id: Date.now().toString(),
        propertyId,
        title: property.title,
        price: property.price,
        type: property.type,
        stage,
        date: new Date().toLocaleDateString(),
        notes
    };
    
    pipeline[stage] = pipeline[stage] || [];
    pipeline[stage].push(deal);
    
    // Save to backend
    try {
        await fetch(`${API_BASE}/pipeline/demo-user/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deal)
        });
    } catch (error) {
        console.error('Error saving deal:', error);
    }
    
    renderPipeline();
    closeModal('deal-modal');
    showToast('Deal added to pipeline');
}

// Market Intelligence
async function loadMarketData() {
    const location = document.getElementById('market-location').value.toUpperCase();
    
    if (!location) {
        showToast('Please enter a location');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/market/${location}`);
        marketData = await response.json();
        renderMarketData();
    } catch (error) {
        console.error('Error loading market data:', error);
        showToast('Error loading market data');
    }
}

function showMarketPlaceholder() {
    document.getElementById('market-data').innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
            <p style="color: var(--gray-500); font-size: 1.125rem;">Enter a city or state to see market data</p>
        </div>
    `;
}

function renderMarketData() {
    const container = document.getElementById('market-data');
    
    if (!marketData.location) {
        showMarketPlaceholder();
        return;
    }
    
    const metrics = [
        { label: 'Median Price', value: `$${formatNumber(marketData.medianPrice)}`, change: marketData.priceChange1Year, suffix: '%' },
        { label: 'Cap Rate', value: `${marketData.medianCapRate}%`, change: null },
        { label: 'Vacancy Rate', value: `${marketData.vacancyRate}%`, change: null, inverted: true },
        { label: 'Population Growth', value: `${marketData.populationGrowth}%`, change: marketData.populationGrowth, suffix: '%' },
        { label: 'Job Growth', value: `${marketData.jobGrowth}%`, change: marketData.jobGrowth, suffix: '%' },
        { label: 'Unemployment', value: `${marketData.unemploymentRate}%`, change: null, inverted: true },
        { label: 'Median Rent', value: `$${formatNumber(marketData.medianRent)}`, change: marketData.rentGrowth, suffix: '%' },
        { label: 'Market Score', value: `${marketData.marketScore}/100`, change: null }
    ];
    
    container.innerHTML = `
        <div class="market-card" style="grid-column: 1/-1;">
            <h3>${marketData.location} Market Overview</h3>
            <p style="color: var(--gray-500); font-size: 0.875rem;">Last updated: ${new Date(marketData.lastUpdated).toLocaleString()}</p>
        </div>
        ${metrics.map(m => `
            <div class="market-card">
                <h3>${m.label}</h3>
                <div class="market-value">${m.value}</div>
                ${m.change !== undefined && m.change !== null ? `
                    <span class="market-change ${getChangeClass(m.change, m.inverted)}">
                        ${m.change >= 0 ? '↑' : '↓'} ${Math.abs(m.change)}${m.suffix || ''} YoY
                    </span>
                ` : ''}
            </div>
        `).join('')}
    `;
}

function getChangeClass(value, inverted = false) {
    if (inverted) return value > 5 ? 'negative' : 'positive';
    return value >= 0 ? 'positive' : 'negative';
}

// Deal Analysis
async function analyzeDeal() {
    const propertyId = document.getElementById('analysis-property').value;
    const purchasePrice = document.getElementById('analysis-price').value;
    const downPayment = document.getElementById('analysis-down').value;
    const interestRate = document.getElementById('analysis-rate').value;
    const loanTerm = 30;
    const renovationCosts = document.getElementById('analysis-renovation').value;
    const targetCapRate = document.getElementById('analysis-target-cap').value;
    
    if (!propertyId && !purchasePrice) {
        showToast('Please select a property or enter a price');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                propertyId,
                purchasePrice: parseFloat(purchasePrice),
                downPayment: parseFloat(downPayment) / 100 * parseFloat(purchasePrice || property?.price || 0),
                interestRate: parseFloat(interestRate) / 100,
                loanTerm,
                renovationCosts: parseFloat(renovationCosts || 0),
                targetCapRate: parseFloat(targetCapRate) / 100
            })
        });
        
        const data = await response.json();
        renderAnalysis(data);
    } catch (error) {
        console.error('Error analyzing deal:', error);
        showToast('Error analyzing deal');
    }
}

function renderAnalysis(data) {
    const { analysis, property, recommendations } = data;
    const results = document.getElementById('analysis-results');
    
    const metrics = [
        { label: 'Monthly Cash Flow', value: `$${formatNumber(analysis.monthlyCashFlow)}`, 
          class: analysis.monthlyCashFlow >= 0 ? 'good' : 'danger' },
        { label: 'Cash-on-Cash Return', value: `${analysis.cashOnCash}%`, 
          class: parseFloat(analysis.cashOnCash) >= 8 ? 'good' : parseFloat(analysis.cashOnCash) >= 5 ? 'warning' : 'danger' },
        { label: 'Cap Rate', value: `${analysis.capRate}%`, 
          class: parseFloat(analysis.capRate) >= 6 ? 'good' : parseFloat(analysis.capRate) >= 4 ? 'warning' : 'danger' },
        { label: 'DSCR', value: analysis.dscr, 
          class: parseFloat(analysis.dscr) >= 1.25 ? 'good' : parseFloat(analysis.dscr) >= 1.0 ? 'warning' : 'danger' },
        { label: 'NOI', value: `$${formatNumber(analysis.noi)}` },
        { label: 'Monthly Mortgage', value: `$${formatNumber(analysis.monthlyMortgage)}` },
        { label: 'Total Investment', value: `$${formatNumber(analysis.totalInvestment)}` },
        { label: 'Target vs Actual', value: `${analysis.comparedToTarget > 0 ? '+' : ''}${analysis.comparedToTarget}%` }
    ];
    
    results.innerHTML = `
        <div class="metric-card" style="grid-column: 1/-1;">
            <div class="risk-indicator">
                <span style="color: var(--gray-600);">Investment Risk:</span>
                <span class="risk-badge ${analysis.riskLevel.level.toLowerCase().replace(' ', '-')}">
                    ${analysis.riskLevel.level}
                </span>
                <span style="color: var(--gray-500);">${analysis.riskLevel.message}</span>
            </div>
        </div>
        ${metrics.map(m => `
            <div class="metric-card">
                <div class="metric-label">${m.label}</div>
                <div class="metric-value ${m.class || ''}">${m.value}</div>
            </div>
        `).join('')}
        ${recommendations?.length ? `
            <div class="metric-card" style="grid-column: 1/-1; text-align: left;">
                <h4 style="margin-bottom: 1rem;">💡 Recommendations</h4>
                ${recommendations.map(r => `
                    <div style="padding: 0.75rem; background: ${r.type === 'success' ? '#dcfce7' : r.type === 'warning' ? '#fef3c7' : '#dbeafe'}; border-radius: var(--radius); margin-bottom: 0.5rem;">
                        ${r.message}
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

// Utilities
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function loadPropertySelect() {
    try {
        const response = await fetch(`${API_BASE}/properties?limit=100`);
        const data = await response.json();
        const select = document.getElementById('analysis-property');
        const dealSelect = document.getElementById('deal-property');
        
        const options = data.properties.map(p => 
            `<option value="${p.id}">${p.title} - $${formatNumber(p.price)}</option>`
        ).join('');
        
        select.innerHTML = '<option value="">Select a property</option>' + options;
        dealSelect.innerHTML = '<option value="">Select a property</option>' + options;
    } catch (error) {
        console.error('Error loading property select:', error);
    }
}

function saveProperty(propertyId) {
    showToast('Property saved to favorites!');
}

// Close modals on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    }
});

// Close modals on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});
