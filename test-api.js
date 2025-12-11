// Test the user alarms API to see if politeness scoring is working
const fetch = require('node-fetch');

async function testAPI() {
    try {
        const response = await fetch('http://localhost:3003/api/user-alarms?showAll=true');
        const alarms = await response.json();
        
        console.log('Total alarms:', alarms.length);
        
        // Find the alarm with inappropriate content
        const inappropriateAlarm = alarms.find(alarm => 
            alarm.title.includes('shit') || alarm.description.includes('assholes')
        );
        
        if (inappropriateAlarm) {
            console.log('\nFound inappropriate alarm:');
            console.log('Title:', inappropriateAlarm.title);
            console.log('Description:', inappropriateAlarm.description);
            console.log('Politeness Score:', inappropriateAlarm.politenessScore);
            console.log('Moderation Reasons:', inappropriateAlarm.moderationReasons);
            console.log('Is Moderated:', inappropriateAlarm.isModerated);
        } else {
            console.log('No inappropriate alarm found');
        }
        
    } catch (error) {
        console.error('Error testing API:', error.message);
    }
}

testAPI();
