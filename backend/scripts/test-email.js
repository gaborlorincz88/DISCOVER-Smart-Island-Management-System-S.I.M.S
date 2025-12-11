const verificationEmailService = require('../services/verificationEmailService');

console.log('Testing email service...\n');

async function testEmail() {
  try {
    // Test sending an email
    const result = await verificationEmailService.sendVerificationEmail(
      'gaborlorincz18@gmail.com', // Test email
      'test-token-12345',
      'Test User'
    );
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ Error sending email:');
    console.error('Message:', error.message);
    console.error('Full error:', error);
  }
}

testEmail();


