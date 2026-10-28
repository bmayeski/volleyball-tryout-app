// calculations.js

/**
 * Calculates a 1.0 - 5.0 score based on a Standard Deviation Bell Curve.
 */
function calculateBellCurveScore(category, myRawValue, allPeerValues) {
    const subjective = ['Passing', 'Serving', 'Hitting', 'Setting', 'Defense', 'Receive'];
    
    // Subjective scores are already on a 1-5 scale, so we just return them.
    if (subjective.includes(category)) return parseFloat(myRawValue).toFixed(1);

    const lowerIsBetter = ['Mile Time', 'Sprint Time', 'Sprint'];
    
    // 1. Clean and parse peer data
    let validPeers = allPeerValues.map(val => parseRawValue(category, val)).filter(v => !isNaN(v));
    
    if (validPeers.length < 3) return "3.0"; // Not enough data for a curve

    // 2. Calculate the Mean (Average)
    const sum = validPeers.reduce((a, b) => a + b, 0);
    const mean = sum / validPeers.length;

    // 3. Calculate the Standard Deviation
    const squaredDifferences = validPeers.map(val => Math.pow(val - mean, 2));
    const avgSquaredDifference = squaredDifferences.reduce((a, b) => a + b, 0) / validPeers.length;
    const standardDeviation = Math.sqrt(avgSquaredDifference);

    // 4. Calculate Z-Score (How many standard deviations away from the mean is this athlete?)
    let myVal = parseRawValue(category, myRawValue);
    if (isNaN(myVal)) return "-";
    
    // If everyone got the exact same score, prevent division by zero
    if (standardDeviation === 0) return "3.0";

    let zScore = (myVal - mean) / standardDeviation;

    // 5. Convert Z-Score to a 1.0 - 5.0 scale (Anchor the mean at 2.5)
    // We will say 1 Standard Deviation = 1 full point on the scale.
    let finalScore;
    if (lowerIsBetter.includes(category)) {
        // For running, a NEGATIVE z-score (faster than average) is good!
        finalScore = 2.5 - (zScore * 1.0); 
    } else {
        // For jumping, a POSITIVE z-score (higher than average) is good!
        finalScore = 2.5 + (zScore * 1.0);
    }

    // 6. Cap the scores between 1.0 and 5.0
    if (finalScore > 5.0) finalScore = 5.0;
    if (finalScore < 1.0) finalScore = 1.0;

    return finalScore.toFixed(1);
}

// Helper to convert times (MM:SS) and heights into base numbers for math
function parseRawValue(category, val) {
    if (category === 'Mile Time') {
        if (typeof val === 'string' && val.includes(':')) {
            let p = val.split(':');
            return (parseInt(p[0]) * 60) + parseInt(p[1]); // Returns total seconds
        }
    }
    return parseFloat(val);
}