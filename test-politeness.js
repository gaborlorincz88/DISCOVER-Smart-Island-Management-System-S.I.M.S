const { containsInappropriateContent, getPolitenessScore } = require('./backend/services/politenessFilter.js');

// Test the problematic content
const testContent = "Super shit place dont eat here assholes";

console.log('Testing content:', testContent);
console.log('---');

const result = containsInappropriateContent(testContent);
console.log('Inappropriate check:', result);

const score = getPolitenessScore(testContent);
console.log('Politeness score:', score);

console.log('---');
console.log('Should be flagged for moderation:', score > 20);
console.log('Should be rejected:', score > 80);
