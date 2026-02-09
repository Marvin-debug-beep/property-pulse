const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store (replace with PostgreSQL in production)
const db = {
    users: new Map(),
    properties: new Map(),
    deals: new Map(),
    savedProperties: new Map(),
    pipelines: new Map(),
    marketData: new Map()
};

// Initialize with sample data
initializeSampleData();

// API Routes

// Properties
app.get('/api/properties', (req, res) => {
    const { type, minPrice, maxPrice, minSize, maxSize, location, page = 1, limit = 20 } = req.query;
    
    let results = Array.from(db.properties.values());
    
    // Filters
    if (type && type !== 'all') {
        results = results.filter(p => p.type === type);
    }
    if (location) {
        results = results.filter(p => 
            p.city.toLowerCase().includes(location.toLowerCase()) ||
            p.state.toLowerCase().includes(location.toLowerCase()) ||
            p.zip.includes(location)
        );
    }
    if (minPrice) {
        results = results.filter(p => p.price >= parseInt(minPrice));
    }
    if (maxPrice) {
        results = results.filter(p => p.price <= parseInt(maxPrice));
    }
    if (minSize) {
        results = results.filter(p => p.size >= parseInt(minSize));
    }
    if (maxSize) {
        results = results.filter(p => p.size <= parseInt(maxSize));
    }
    
    // Pagination
    const start = (page - 1) * limit;
    const paginated = results.slice(start, start + parseInt(limit));
    
    res.json({
        properties: paginated,
        total: results.length,
        page: parseInt(page),
        totalPages: Math.ceil(results.length / limit)
    });
});

app.get('/api/properties/:id', (req, res) => {
    const property = db.properties.get(req.params.id);
    if (property) {
        res.json(property);
    } else {
        res.status(404).json({ error: 'Property not found' });
    }
});

// Deal Analysis
app.post('/api/analyze', (req, res) => {
    const { propertyId, purchasePrice, downPayment, interestRate, loanTerm, renovationCosts, targetCapRate } = req.body;
    
    const property = db.properties.get(propertyId);
    if (!property) {
        return res.status(404).json({ error: 'Property not found' });
    }
    
    const analysis = calculateDealMetrics({
        purchasePrice: purchasePrice || property.price,
        downPayment: downPayment || (property.price * 0.25),
        interestRate: interestRate || 0.07,
        loanTerm: loanTerm || 30,
        renovationCosts: renovationCosts || 0,
        grossIncome: property.grossIncome || property.price * 0.05,
        expenses: property.expenses || property.price * 0.035,
        targetCapRate: targetCapRate || 0.06
    });
    
    res.json({
        property,
        analysis,
        recommendations: generateRecommendations(analysis)
    });
});

// Pipeline Management
app.get('/api/pipeline/:userId', (req, res) => {
    const pipeline = db.pipelines.get(req.params.userId) || {
        userId: req.params.userId,
        stages: [
            { id: 'lead', name: 'Lead', deals: [] },
            { id: 'analyzing', name: 'Analyzing', deals: [] },
            { id: 'offer', name: 'Offer Made', deals: [] },
            { id: 'due_diligence', name: 'Due Diligence', deals: [] },
            { id: 'closing', name: 'Closing', deals: [] },
            { id: 'closed', name: 'Closed', deals: [] }
        ]
    };
    res.json(pipeline);
});

app.post('/api/pipeline/:userId/move', (req, res) => {
    const { dealId, fromStage, toStage } = req.body;
    const pipeline = db.pipelines.get(req.params.userId);
    
    if (pipeline) {
        const from = pipeline.stages.find(s => s.id === fromStage);
        const to = pipeline.stages.find(s => s.id === toStage);
        
        if (from && to) {
            const dealIndex = from.deals.findIndex(d => d.id === dealId);
            if (dealIndex !== -1) {
                const [deal] = from.deals.splice(dealIndex, 1);
                to.deals.push(deal);
                res.json({ success: true, pipeline });
            }
        }
    }
    res.json({ success: false });
});

// Market Intelligence
app.get('/api/market/:location', (req, res) => {
    const location = req.params.location.toUpperCase();
    const marketData = db.marketData.get(location) || generateMarketData(location);
    
    res.json({
        location,
        ...marketData,
        comparables: Array.from(db.properties.values())
            .filter(p => p.state === location || p.city.toUpperCase().includes(location))
            .slice(0, 10)
    });
});

// User Management
app.post('/api/users/register', (req, res) => {
    const { email, password, name } = req.body;
    
    if (db.users.has(email)) {
        return res.status(400).json({ error: 'User already exists' });
    }
    
    const user = {
        id: uuidv4(),
        email,
        name,
        tier: 'explorer',
        createdAt: new Date().toISOString()
    };
    
    db.users.set(email, user);
    res.json({ success: true, user: { ...user, password: undefined } });
});

app.post('/api/users/login', (req, res) => {
    const { email } = req.body;
    const user = db.users.get(email);
    
    if (user) {
        res.json({ success: true, user: { ...user, password: undefined } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// WebSocket for real-time updates
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'subscribe') {
            ws.subscriptions = data.topics || [];
        }
        
        if (data.type === 'property_update') {
            // Broadcast property updates to subscribers
            broadcastToSubscribers('property_update', data.property);
        }
    });
    
    ws.send(JSON.stringify({ type: 'connected', message: 'PropertyPulse WebSocket active' }));
});

function broadcastToSubscribers(topic, data) {
    wss.clients.forEach(client => {
        if (client.readyState === 1 && client.subscriptions?.includes(topic)) {
            client.send(JSON.stringify({ type: topic, data }));
        }
    });
}

// Deal Calculator Helper Functions
function calculateDealMetrics({
    purchasePrice,
    downPayment,
    interestRate,
    loanTerm,
    renovationCosts,
    grossIncome,
    expenses,
    targetCapRate
}) {
    const loanAmount = purchasePrice - downPayment;
    const totalInvestment = downPayment + renovationCosts;
    const monthlyRate = interestRate / 12;
    const numberOfPayments = loanTerm * 12;
    
    // Mortgage calculation
    const monthlyMortgage = loanAmount * 
        (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    // Annual metrics
    const annualGrossIncome = grossIncome * 12;
    const annualExpenses = expenses * 12;
    const annualDebtService = monthlyMortgage * 12;
    const noi = annualGrossIncome - annualExpenses;
    const cashFlow = noi - annualDebtService;
    
    // Cap rate and ROI
    const capRate = noi / purchasePrice;
    const cashOnCash = cashFlow / totalInvestment;
    const totalReturn = cashFlow + (purchasePrice * 0.03); // Assuming 3% appreciation
    
    // Risk assessment
    const dscr = noi / annualDebtService;
    const riskScore = calculateRiskScore({
        dscr,
        capRate,
        cashOnCash,
        vacancy: 0.05 // Assumed 5% vacancy
    });
    
    return {
        purchasePrice,
        downPayment,
        loanAmount,
        totalInvestment,
        monthlyMortgage,
        annualGrossIncome,
        annualExpenses,
        noi,
        annualDebtService,
        cashFlow,
        monthlyCashFlow: cashFlow / 12,
        capRate: (capRate * 100).toFixed(2),
        cashOnCash: (cashOnCash * 100).toFixed(2),
        totalReturn: (totalReturn * 100).toFixed(2),
        dscr: dscr.toFixed(2),
        riskScore,
        riskLevel: getRiskLevel(riskScore),
        targetCapRate: (targetCapRate * 100).toFixed(2),
        comparedToTarget: ((capRate - targetCapRate) * 100).toFixed(2)
    };
}

function calculateRiskScore({ dscr, capRate, cashOnCash, vacancy }) {
    let score = 100;
    
    // DSCR penalty (below 1.25 is risky)
    if (dscr < 1.0) score -= 40;
    else if (dscr < 1.25) score -= 20;
    else if (dscr < 1.5) score -= 10;
    
    // Cap rate penalty (too low is risky)
    if (capRate < 0.04) score -= 30;
    else if (capRate < 0.06) score -= 15;
    
    // Cash-on-cash penalty (negative is very risky)
    if (cashOnCash < 0) score -= 25;
    else if (cashOnCash < 0.05) score -= 10;
    
    // Vacancy penalty
    if (vacancy > 0.10) score -= 15;
    else if (vacancy > 0.05) score -= 5;
    
    return Math.max(0, Math.min(100, score));
}

function getRiskLevel(score) {
    if (score >= 80) return { level: 'LOW', color: 'green', message: 'Strong investment' };
    if (score >= 60) return { level: 'MODERATE', color: 'yellow', message: 'Acceptable with conditions' };
    if (score >= 40) return { level: 'HIGH', color: 'orange', message: 'Proceed with caution' };
    return { level: 'VERY HIGH', color: 'red', message: 'Not recommended' };
}

function generateRecommendations(analysis) {
    const recommendations = [];
    
    if (parseFloat(analysis.cashOnCash) < 5) {
        recommendations.push({
            type: 'warning',
            message: 'Cash-on-cash return is below 5%. Consider renegotiating price or increasing down payment.'
        });
    }
    
    if (parseFloat(analysis.capRate) < parseFloat(analysis.targetCapRate)) {
        recommendations.push({
            type: 'info',
            message: `Property cap rate (${analysis.capRate}%) is below your target (${analysis.targetCapRate}%). This may not meet your return requirements.`
        });
    }
    
    if (parseFloat(analysis.dscr) < 1.25) {
        recommendations.push({
            type: 'warning',
            message: 'DSCR is below 1.25. Consider a larger down payment or better financing terms.'
        });
    }
    
    if (parseFloat(analysis.riskScore) >= 70) {
        recommendations.push({
            type: 'success',
            message: 'This property has a favorable risk profile. Consider moving forward with due diligence.'
        });
    }
    
    return recommendations;
}

// Sample Data Initialization
function initializeSampleData() {
    const sampleProperties = [
        {
            id: uuidv4(),
            mlsNumber: 'CREXI-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            title: 'Downtown Office Building',
            address: '123 Main Street',
            city: 'Miami',
            state: 'FL',
            zip: '33101',
            type: 'commercial',
            subtype: 'office',
            price: 2500000,
            size: 15000,
            pricePerSqFt: 167,
            capRate: 6.5,
            noi: 162500,
            grossIncome: 225000,
            expenses: 62500,
            yearBuilt: 2015,
            parkingSpaces: 50,
            tenants: 8,
            occupancy: 92,
            description: 'Class A office building in downtown Miami. Fully occupied with diverse tenant base.',
            features: ['Modern HVAC', 'Elevator', 'Security System', 'Fiber Internet'],
            imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800',
            listedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            daysOnMarket: 30,
            seller: 'Miami Commercial Properties LLC',
            agent: 'John Smith - Commercial Realty'
        },
        {
            id: uuidv4(),
            mlsNumber: 'CREXI-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            title: 'Industrial Warehouse',
            address: '456 Industrial Blvd',
            city: 'Tampa',
            state: 'FL',
            zip: '33601',
            type: 'commercial',
            subtype: 'industrial',
            price: 1800000,
            size: 25000,
            pricePerSqFt: 72,
            capRate: 7.2,
            noi: 129600,
            grossIncome: 180000,
            expenses: 50400,
            yearBuilt: 2018,
            parkingSpaces: 30,
            loadingDocks: 8,
            clearHeight: 28,
            description: 'Modern distribution warehouse with dock-high doors and ESFR sprinklers.',
            features: ['Dock Doors', 'Sprinkler System', 'Heavy Power', 'Truck Courts'],
            imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
            listedDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            daysOnMarket: 45,
            seller: 'Tampa Industrial Partners',
            agent: 'Maria Garcia - Industrial CRE'
        },
        {
            id: uuidv4(),
            mlsNumber: 'LOOP-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            title: 'Retail Strip Center',
            address: '789 Commerce Way',
            city: 'Orlando',
            state: 'FL',
            zip: '32801',
            type: 'commercial',
            subtype: 'retail',
            price: 3200000,
            size: 20000,
            pricePerSqFt: 160,
            capRate: 6.0,
            noi: 192000,
            grossIncome: 280000,
            expenses: 88000,
            yearBuilt: 2012,
            parkingSpaces: 80,
            tenants: 12,
            occupancy: 100,
            description: 'Prime retail location with strong co-tenants and excellent visibility.',
            features: ['Pylon Sign', 'Corner Lot', 'High Traffic', 'Full Renovation 2020'],
            imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
            listedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            daysOnMarket: 60,
            seller: 'Orlando Retail Group',
            agent: 'Bob Johnson - Retail Experts'
        },
        {
            id: uuidv4(),
            mlsNumber: 'MULTI-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            title: '24-Unit Apartment Complex',
            address: '321 Residential Ave',
            city: 'Jacksonville',
            state: 'FL',
            zip: '32201',
            type: 'multifamily',
            subtype: 'apartment',
            price: 4500000,
            size: 36000,
            pricePerSqFt: 125,
            capRate: 5.8,
            noi: 261000,
            grossIncome: 390000,
            expenses: 129000,
            yearBuilt: 2008,
            units: 24,
            avgRent: 1350,
            occupancy: 95,
            description: 'Well-maintained apartment complex with upside potential in strong rental market.',
            features: ['Pool', 'Laundry Facility', 'Parking', 'Recent Roof Update'],
            imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
            listedDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
            daysOnMarket: 20,
            seller: 'Jacksonville Multi-Family LLC',
            agent: 'Sarah Williams - Multi-Family Specialists'
        },
        {
            id: uuidv4(),
            mlsNumber: 'LAND-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            title: '15-Acre Development Site',
            address: 'Highway 441',
            city: 'Gainesville',
            state: 'FL',
            zip: '32601',
            type: 'land',
            subtype: 'commercial',
            price: 750000,
            size: 653400,
            pricePerSqFt: 1.15,
            zoning: 'Commercial General',
            description: 'Prime development site with all utilities available. Ready for vertical construction.',
            features: ['Utilities Available', 'Highway Frontage', 'Flat Terrain', 'Wetlands Survey Complete'],
            imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800',
            listedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            daysOnMarket: 90,
            seller: 'Gainesville Development Corp',
            agent: 'Mike Brown - Land Pro'
        },
        {
            id: uuidv4(),
            mlsNumber: 'RESI-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            title: 'Single Family Home - Flip Opportunity',
            address: '555 Fixer Upper Lane',
            city: 'Fort Lauderdale',
            state: 'FL',
            zip: '33301',
            type: 'residential',
            subtype: 'single-family',
            price: 425000,
            size: 2200,
            pricePerSqFt: 193,
            arv: 650000,
            renovationEstimate: 75000,
            bedrooms: 4,
            bathrooms: 2,
            yearBuilt: 1975,
            description: 'Solid bones, needs cosmetic updates. Great flip opportunity in appreciating neighborhood.',
            features: ['Pool', 'Large Lot', 'Good Schools', 'Investor Friendly'],
            imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
            listedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            daysOnMarket: 10,
            seller: 'Estate Sale - Johnson Family',
            agent: 'Lisa Chen - Premier Realty'
        }
    ];
    
    sampleProperties.forEach(p => db.properties.set(p.id, p));
    
    // Initialize market data
    ['FL', 'MIAMI', 'TAMPA', 'ORLANDO', 'JACKSONVILLE'].forEach(location => {
        db.marketData.set(location, generateMarketData(location));
    });
}

function generateMarketData(location) {
    return {
        medianPrice: Math.floor(Math.random() * 500000) + 200000,
        priceChange1Year: (Math.random() * 15 - 3).toFixed(1),
        priceChange5Year: (Math.random() * 40 + 10).toFixed(1),
        medianCapRate: (Math.random() * 2 + 4).toFixed(2),
        vacancyRate: (Math.random() * 5 + 3).toFixed(1),
        populationGrowth: (Math.random() * 3 + 0.5).toFixed(1),
        jobGrowth: (Math.random() * 4 + 1).toFixed(1),
        unemploymentRate: (Math.random() * 3 + 2).toFixed(1),
        medianRent: Math.floor(Math.random() * 1500) + 1200,
        rentGrowth: (Math.random() * 5 + 1).toFixed(1),
        marketScore: Math.floor(Math.random() * 30) + 70,
        marketTrend: Math.random() > 0.3 ? 'appreciating' : 'stable',
        lastUpdated: new Date().toISOString()
    };
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Serve main app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🏠 PropertyPulse Server Running                                ║
║                                                                  ║
║   Dashboard: http://localhost:${PORT}                             ║
║   API:       http://localhost:${PORT}/api                         ║
║   WebSocket: ws://localhost:${PORT}                               ║
║                                                                  ║
║   ${samplePropertiesCount()} properties loaded                              ║
║   ${Object.keys(db.marketData).length} market data regions available                      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    `);
});

function samplePropertiesCount() {
    return db.properties.size;
}
