// calculations.js

/**
 * Calculates a 1.0 - 5.0 score based on a Standard Deviation Bell Curve.
 */
function calculateBellCurveScore(metricName, myRawValue, allPeerValues) {
    // 1. Get the metric definition from global state
    const metricDef = globalMetricsData.find(m => m.name === metricName);
    
    // 2. Identify the type dynamically
    const isSubjective = metricDef ? metricDef.measurement_type === 'scale_0_to_5' : false;
    const isLowerBetter = metricDef ? metricDef.measurement_type === 'time' : false;
    
    // Subjective scores are already on a 1-5 scale, so we just return them.
    if (isSubjective) return parseFloat(myRawValue).toFixed(1);

    // 3. Clean and parse peer data
    let validPeers = allPeerValues.map(val => parseRawValue(metricName, val)).filter(v => !isNaN(v));
    
    if (validPeers.length < 3) return "3.0"; // Not enough data for a curve

    // Calculate the Mean
    const sum = validPeers.reduce((a, b) => a + b, 0);
    const mean = sum / validPeers.length;

    // Calculate the Standard Deviation
    const squaredDifferences = validPeers.map(val => Math.pow(val - mean, 2));
    const avgSquaredDifference = squaredDifferences.reduce((a, b) => a + b, 0) / validPeers.length;
    const standardDeviation = Math.sqrt(avgSquaredDifference);

    // Calculate Z-Score
    let myVal = parseRawValue(metricName, myRawValue);
    if (isNaN(myVal)) return "-";
    
    if (standardDeviation === 0) return "3.0";

    let zScore = (myVal - mean) / standardDeviation;

    let finalScore;
    if (isLowerBetter) {
        // For running/time, a NEGATIVE z-score (faster than average) is good!
        finalScore = 2.5 - (zScore * 1.0); 
    } else {
        // For everything else, a POSITIVE z-score (higher/more than average) is good!
        finalScore = 2.5 + (zScore * 1.0);
    }

    if (finalScore > 5.0) finalScore = 5.0;
    if (finalScore < 1.0) finalScore = 1.0;

    return finalScore.toFixed(1);
}

// Helper to reliably convert times (MM:SS) and heights into base math numbers
function parseRawValue(metricName, val) {
    const metricDef = globalMetricsData.find(m => m.name === metricName);
    const mType = metricDef ? metricDef.measurement_type : 'unknown';

    if (mType === 'time') {
        if (typeof val === 'string' && val.includes(':')) {
            let p = val.split(':');
            return (parseInt(p[0]) * 60) + parseInt(p[1]); 
        }
    }
    // Also catch inches formats like 8'11" if manually typed
    if (typeof val === 'string' && val.includes("'")) {
         let match = val.match(/(\d+)['\s]+([\d.]+)/);
         if (match) {
             return (parseInt(match[1]) * 12) + parseFloat(match[2]);
         }
    }
    return parseFloat(val);
}