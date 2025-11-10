// LEGO Parts Database
// This database contains common LEGO brick types with their identifying characteristics
// In a production app, this would be a comprehensive database with thousands of parts

const LEGO_PARTS_DATABASE = {
    // Basic Bricks
    'brick_2x4': {
        id: '3001',
        name: '2x4 Brick',
        category: 'Basic Brick',
        dimensions: '2x4 studs',
        colors: ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black', 'Gray'],
        keywords: ['brick', 'rectangular', 'basic', 'standard']
    },
    'brick_2x2': {
        id: '3003',
        name: '2x2 Brick',
        category: 'Basic Brick',
        dimensions: '2x2 studs',
        colors: ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black', 'Gray'],
        keywords: ['brick', 'square', 'basic', 'small']
    },
    'brick_1x4': {
        id: '3010',
        name: '1x4 Brick',
        category: 'Basic Brick',
        dimensions: '1x4 studs',
        colors: ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black', 'Gray'],
        keywords: ['brick', 'long', 'thin', 'narrow']
    },
    'brick_1x2': {
        id: '3004',
        name: '1x2 Brick',
        category: 'Basic Brick',
        dimensions: '1x2 studs',
        colors: ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black', 'Gray'],
        keywords: ['brick', 'small', 'short', 'narrow']
    },
    
    // Plates
    'plate_2x4': {
        id: '3020',
        name: '2x4 Plate',
        category: 'Plate',
        dimensions: '2x4 studs',
        colors: ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black', 'Gray'],
        keywords: ['plate', 'flat', 'thin', 'rectangular']
    },
    'plate_2x2': {
        id: '3022',
        name: '2x2 Plate',
        category: 'Plate',
        dimensions: '2x2 studs',
        colors: ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black', 'Gray'],
        keywords: ['plate', 'flat', 'thin', 'square']
    },
    'plate_1x4': {
        id: '3710',
        name: '1x4 Plate',
        category: 'Plate',
        dimensions: '1x4 studs',
        colors: ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black', 'Gray'],
        keywords: ['plate', 'flat', 'thin', 'long', 'narrow']
    },
    
    // Slopes
    'slope_45_2x2': {
        id: '3039',
        name: '45° Slope 2x2',
        category: 'Slope',
        dimensions: '2x2 studs',
        colors: ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black', 'Gray'],
        keywords: ['slope', 'angled', 'roof', 'diagonal']
    },
    'slope_45_2x4': {
        id: '3037',
        name: '45° Slope 2x4',
        category: 'Slope',
        dimensions: '2x4 studs',
        colors: ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black', 'Gray'],
        keywords: ['slope', 'angled', 'roof', 'diagonal', 'large']
    },
    
    // Special Parts
    'wheel': {
        id: '6014',
        name: 'Wheel',
        category: 'Special',
        dimensions: 'Various',
        colors: ['Black', 'Gray', 'White'],
        keywords: ['wheel', 'tire', 'round', 'circular', 'vehicle']
    },
    'window_1x2x2': {
        id: '60592',
        name: '1x2x2 Window',
        category: 'Special',
        dimensions: '1x2x2 studs',
        colors: ['White', 'Black', 'Blue', 'Red'],
        keywords: ['window', 'transparent', 'glass', 'opening']
    },
    'door_1x4x6': {
        id: '60596',
        name: '1x4x6 Door Frame',
        category: 'Special',
        dimensions: '1x4x6 studs',
        colors: ['White', 'Black', 'Red', 'Blue'],
        keywords: ['door', 'frame', 'tall', 'opening']
    }
};

// Color database for better identification
const LEGO_COLORS = {
    'red': { hex: '#D11013', name: 'Red' },
    'blue': { hex: '#0055BF', name: 'Blue' },
    'yellow': { hex: '#FFD700', name: 'Yellow' },
    'green': { hex: '#00A651', name: 'Green' },
    'white': { hex: '#FFFFFF', name: 'White' },
    'black': { hex: '#000000', name: 'Black' },
    'gray': { hex: '#808080', name: 'Gray' },
    'light_gray': { hex: '#C0C0C0', name: 'Light Gray' },
    'dark_gray': { hex: '#404040', name: 'Dark Gray' },
    'orange': { hex: '#FF6600', name: 'Orange' },
    'brown': { hex: '#582A10', name: 'Brown' },
    'tan': { hex: '#D4B27A', name: 'Tan' }
};

// Helper function to find matching parts based on analysis
function findMatchingParts(keywords, category = null) {
    const matches = [];
    
    for (const [key, part] of Object.entries(LEGO_PARTS_DATABASE)) {
        let score = 0;
        
        // Check category match
        if (category && part.category.toLowerCase().includes(category.toLowerCase())) {
            score += 10;
        }
        
        // Check keyword matches
        keywords.forEach(keyword => {
            const kw = keyword.toLowerCase();
            if (part.keywords.some(pk => pk.includes(kw) || kw.includes(pk))) {
                score += 5;
            }
            if (part.name.toLowerCase().includes(kw)) {
                score += 3;
            }
        });
        
        if (score > 0) {
            matches.push({
                ...part,
                matchScore: score,
                key: key
            });
        }
    }
    
    // Sort by match score
    return matches.sort((a, b) => b.matchScore - a.matchScore);
}

// Analyze image predictions and match to LEGO parts
function analyzeForLegoParts(predictions) {
    const results = [];
    
    predictions.forEach(pred => {
        const className = pred.className.toLowerCase();
        const keywords = className.split(/[\s,]+/);
        
        // Try to identify the part type
        let category = null;
        if (keywords.some(kw => ['brick', 'block', 'cube'].includes(kw))) {
            category = 'brick';
        } else if (keywords.some(kw => ['flat', 'plate', 'tile'].includes(kw))) {
            category = 'plate';
        } else if (keywords.some(kw => ['slope', 'wedge', 'roof'].includes(kw))) {
            category = 'slope';
        } else if (keywords.some(kw => ['wheel', 'tire', 'circular'].includes(kw))) {
            category = 'wheel';
        }
        
        const matches = findMatchingParts(keywords, category);
        
        if (matches.length > 0) {
            // Take top 3 matches
            matches.slice(0, 3).forEach((match, index) => {
                results.push({
                    part: match,
                    confidence: pred.probability * (1 - index * 0.15), // Reduce confidence for lower matches
                    originalPrediction: pred.className
                });
            });
        } else {
            // Generic LEGO brick if no specific match
            results.push({
                part: {
                    id: 'UNKNOWN',
                    name: 'Generic LEGO Brick',
                    category: 'Unknown',
                    dimensions: 'Unknown',
                    colors: ['Unknown'],
                    keywords: keywords
                },
                confidence: pred.probability * 0.5,
                originalPrediction: pred.className
            });
        }
    });
    
    // Sort by confidence and remove duplicates
    const uniqueResults = [];
    const seenIds = new Set();
    
    results.sort((a, b) => b.confidence - a.confidence).forEach(result => {
        if (!seenIds.has(result.part.id)) {
            uniqueResults.push(result);
            seenIds.add(result.part.id);
        }
    });
    
    return uniqueResults.slice(0, 5); // Return top 5 results
}
