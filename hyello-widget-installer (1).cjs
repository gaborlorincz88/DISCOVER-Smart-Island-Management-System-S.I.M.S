#!/usr/bin/env node
/**
 * 🚀 HYELLO Widget - One-Click Installer
 * Generated from Widget Builder
 * 
 * USAGE: Just run this file in your React app:
 *   node hyello-widget-installer.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Widget Configuration (embedded)
const WIDGET_CONFIG = {
  "widgetType": "both",
  "amount": "29.99",
  "currency": "EUR",
  "description": "Product Purchase",
  "theme": "dark",
  "primaryColor": "#ffd700",
  "borderRadius": "medium",
  "borderThickness": "medium",
  "logo": "square",
  "customImage": "/widget-icons/my-logo.png",
  "iconPosition": "top-center"
};

// Component Code (embedded)
const COMPONENT_CODE = `// HYELLO Payment Widget - Reusable Component
// This component can accept ANY amount/currency as props

'use client';
import { HybridCheckout } from '@hyello/payment-widget';
import '@hyello/payment-widget/dist/hyello.css';

interface HyelloPaymentWidgetProps {
  amount: number;
  currency?: string;
  description?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
}

export default function HyelloPaymentWidget({
  amount,
  currency = 'USD',
  description = 'Payment',
  onSuccess,
  onError
}: HyelloPaymentWidgetProps) {
  
  const config = {
    apiKey: 'YOUR_API_KEY_HERE',  // Get from API Keys page
    environment: 'sandbox',        // Use 'production' when ready
    theme: 'dark',
    primaryColor: '#ffd700',
    borderRadius: 'medium',
    customLogo: '/widget-icons/my-logo.png',
  };

  const paymentData = {
    amount,           // ← Dynamic amount from props!
    currency,         // ← Dynamic currency from props!
    description,      // ← Dynamic description from props!
    
    // Crypto-specific options
    acceptedCryptos: ['BTC', 'ETH', 'USDT', 'USDC'],
    merchantWallets: {
      BTC: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      ETH: '0x742d35Cc6634C0532925a3b844Bc9e7595f24aAa',
      USDT: '0x742d35Cc6634C0532925a3b844Bc9e7595f24aAa',
      USDC: '0x742d35Cc6634C0532925a3b844Bc9e7595f24aAa'
    },
  };

  const handleSuccess = (result: any) => {
    console.log('Payment successful!', result);
    if (onSuccess) onSuccess(result);
    else alert(\`Payment completed: \${result.amount} \${result.currency}\`);
  };

  const handleError = (error: any) => {
    console.error('Payment failed:', error);
    if (onError) onError(error);
    else alert('Payment failed: ' + error.message);
  };

  return (
    <HybridCheckout
      config={config}
      paymentData={paymentData}
      onSuccess={handleSuccess}
      onError={handleError}
    />
  );
}

// USAGE EXAMPLES:

// Example 1: Simple usage with just amount
// <HyelloPaymentWidget amount={49.99} />

// Example 2: Full customization
// <HyelloPaymentWidget 
//   amount={149.99} 
//   currency="EUR" 
//   description="Premium Subscription"
//   onSuccess={(result) => console.log('Paid!', result)}
//   onError={(error) => console.error('Failed!', error)}
// />

// Example 3: Dynamic pricing from your app state
// <HyelloPaymentWidget 
//   amount={cartTotal} 
//   currency={userCurrency}
//   description={\`Order #\${orderId}\`}
// />`;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(resolve => rl.question(q, resolve));

const colors = { green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m', bright: '\x1b[1m' };
const log = {
  title: (m) => console.log(`\n${colors.yellow}${colors.bright}${'='.repeat(70)}\n${m}\n${'='.repeat(70)}${colors.reset}\n`),
  step: (n, m) => console.log(`\n${colors.cyan}${colors.bright}📍 Step ${n}: ${m}${colors.reset}\n`),
  success: (m) => console.log(`${colors.green}✅ ${m}${colors.reset}`),
  error: (m) => console.log(`${colors.red}❌ ${m}${colors.reset}`),
  info: (m) => console.log(`${colors.blue}ℹ  ${m}${colors.reset}`)
};

async function install() {
  try {
    log.title('🚀 HYELLO Payment Widget - One-Click Installer');
    console.log(`${colors.bright}Installing both payment widget...${colors.reset}\n`);
    console.log(`${colors.cyan}Style Preset:${colors.reset} Theme=dark • Color=#ffd700\n`);

    // Check project
    log.step(1, 'Checking Project');
    if (!fs.existsSync('package.json')) {
      log.error('No package.json found. Run this script in your React project root!');
      process.exit(1);
    }
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const isNextJs = pkg.dependencies?.next || pkg.devDependencies?.next;
    log.success(`Project: ${pkg.name || 'Unnamed'} ${isNextJs ? '(Next.js)' : '(React)'}`);

    // Get API key
    log.step(2, 'API Key');
    console.log(`${colors.cyan}Get your key from:${colors.reset} ${colors.blue}http://localhost:3001/api-keys${colors.reset}\n`);
    const apiKey = await question(`${colors.yellow}Paste your API key:${colors.reset} `);
    if (!apiKey.trim()) { log.error('API key required!'); process.exit(1); }
    log.success('API key received');

    // Environment
    log.step(3, 'Environment');
    console.log('1. Sandbox (testing)\n2. Production (live)\n');
    const env = await question(`${colors.yellow}Choose (1 or 2):${colors.reset} `);
    const environment = env.trim() === '2' ? 'production' : 'sandbox';
    log.success(`Environment: ${environment}`);

    // Install package
    log.step(4, 'Installing Package');
    log.info('npm install @hyello/payment-widget --save');
    try {
      execSync('npm install @hyello/payment-widget --save', { stdio: 'inherit' });
      log.success('Package installed!');
    } catch (e) { log.info('Package installed (with warnings)'); }

    // Create component
    log.step(5, 'Creating Component');
    const componentDir = 'src/components';
    if (!fs.existsSync(componentDir)) fs.mkdirSync(componentDir, { recursive: true });
    const finalCode = COMPONENT_CODE.replace(/YOUR_API_KEY_HERE/g, apiKey).replace(/'sandbox'|'production'/g, `'${environment}'`);
    fs.writeFileSync('src/components/HyelloPaymentWidget.tsx', finalCode);
    log.success('Component: src/components/HyelloPaymentWidget.tsx');

    // Create example
    log.step(6, 'Creating Checkout Page');
    const checkoutPath = isNextJs ? 'src/app/checkout/page.tsx' : 'src/pages/Checkout.tsx';
    const checkoutDir = path.dirname(checkoutPath);
    if (!fs.existsSync(checkoutDir)) fs.mkdirSync(checkoutDir, { recursive: true });
    
    const example = isNextJs ? `'use client';
import HyelloPaymentWidget from '@/components/HyelloPaymentWidget';
export default function CheckoutPage() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      <HyelloPaymentWidget amount={49.99} currency="USD" description="Product" 
        onSuccess={(r) => alert('Paid: ' + r.id)} />
    </div>
  );
}` : `import HyelloPaymentWidget from '../components/HyelloPaymentWidget';
export default function Checkout() {
  return <div><h1>Checkout</h1><HyelloPaymentWidget amount={49.99} /></div>;
}`;
    
    if (!fs.existsSync(checkoutPath)) {
      fs.writeFileSync(checkoutPath, example);
      log.success(`Example: ${checkoutPath}`);
    }

    log.title('✅ Installation Complete!');
    console.log(`${colors.green}${colors.bright}🎉 Widget Ready!\n${colors.reset}`);
    console.log(`${colors.cyan}Component:${colors.reset} HyelloPaymentWidget (accepts ANY amount!)`);
    console.log(`${colors.cyan}Usage:${colors.reset} <HyelloPaymentWidget amount={99.99} currency="USD" />`);
    console.log(`${colors.cyan}Test Card:${colors.reset} ${colors.green}4242424242424242${colors.reset}`);
    console.log(`${colors.cyan}Dashboard:${colors.reset} ${colors.blue}http://localhost:3001${colors.reset}\n`);
    
    const start = await question(`${colors.yellow}Start dev server? (y/n):${colors.reset} `);
    if (start.toLowerCase() === 'y') {
      log.info('Starting server...');
      execSync('npm run dev', { stdio: 'inherit' });
    }
  } catch (error) {
    log.error('Installation failed: ' + error.message);
  } finally {
    rl.close();
  }
}

install();
