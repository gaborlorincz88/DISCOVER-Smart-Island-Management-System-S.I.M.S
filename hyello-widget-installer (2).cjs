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
const COMPONENT_CODE = `// HYELLO Payment Widget - Standalone Component
// NO NPM packages required! Works immediately after installation.
// Accepts ANY amount/currency as props

'use client';
import { useState } from 'react';

interface HyelloPaymentWidgetProps {
  amount: number;
  currency?: string;
  description?: string;
  apiBaseUrl?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
}

export default function HyelloPaymentWidget({
  amount,
  currency = 'USD',
  description = 'Payment',
  apiBaseUrl = 'http://localhost:3000',
  onSuccess,
  onError
}: HyelloPaymentWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [walletAddress, setWalletAddress] = useState('');

  const API_KEY = 'YOUR_API_KEY_HERE';
  const THEME = 'dark';
  const PRIMARY_COLOR = '#ffd700';
  const BORDER_RADIUS = 'medium';
  const BORDER_THICKNESS = 'medium';

  const handleCardPayment = async () => {
    setLoading(true);
    try {
      // Step 1: Tokenize card
      const tokenResponse = await fetch(\`\${apiBaseUrl}/v1/cards\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${API_KEY}\`
        },
        body: JSON.stringify({
          number: cardNumber.replace(/\s/g, ''),
          exp_month: parseInt(expiry.split('/')[0]),
          exp_year: parseInt('20' + expiry.split('/')[1]),
          cvc: cvv,
          name: cardholderName
        })
      });

      if (!tokenResponse.ok) throw new Error('Card tokenization failed');
      const tokenData = await tokenResponse.json();

      // Step 2: Authorize payment
      const authResponse = await fetch(\`\${apiBaseUrl}/v1/authorize\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${API_KEY}\`,
          'Idempotency-Key': \`idem_\${Date.now()}_\${Math.random()}\`
        },
        body: JSON.stringify({
          card_token: tokenData.token,
          amount: Math.round(amount * 100),
          currency: currency,
          description: description,
          capture: true
        })
      });

      if (!authResponse.ok) throw new Error('Payment authorization failed');
      const result = await authResponse.json();

      if (onSuccess) onSuccess(result);
      else alert(\`Payment successful! Transaction: \${result.authorization_id}\`);
    } catch (error: any) {
      if (onError) onError(error);
      else alert('Payment failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCryptoPayment = async () => {
    setLoading(true);
    try {
      const cryptoResponse = await fetch(\`\${apiBaseUrl}/v1/crypto/payment\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${API_KEY}\`
        },
        body: JSON.stringify({
          crypto: selectedCrypto,
          amount: amount,
          currency: currency,
          description: description,
          customer_wallet: walletAddress
        })
      });

      if (!cryptoResponse.ok) throw new Error('Crypto payment failed');
      const result = await cryptoResponse.json();

      if (onSuccess) onSuccess(result);
      else alert(\`Crypto payment initiated! \${result.payment_address}\`);
    } catch (error: any) {
      if (onError) onError(error);
      else alert('Payment failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const borderRadiusMap = { none: '0px', small: '4px', medium: '8px', large: '16px' };
  const borderThicknessMap = { none: '0px', thin: '1px', medium: '2px', thick: '3px' };
  const radius = borderRadiusMap[BORDER_RADIUS as keyof typeof borderRadiusMap] || '8px';
  const thickness = borderThicknessMap[BORDER_THICKNESS as keyof typeof borderThicknessMap] || '2px';
  const isDark = THEME === 'dark';

  return (
    <div className="hyello-widget p-6 rounded-xl shadow-2xl" style={{
      background: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(20px)',
      borderRadius: radius,
      borderWidth: thickness,
      borderStyle: 'solid',
      borderColor: PRIMARY_COLOR + '40',
      maxWidth: '400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
          Secure Checkout
        </h3>
        <p className="text-sm mt-1" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          Secure Payment Processing
        </p>
      </div>

      {/* Amount */}
      <div className="text-center mb-6 p-4 rounded-lg" style={{
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: PRIMARY_COLOR + '20'
      }}>
        <div className="text-3xl font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
          {currency === 'USD' ? '\$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency}{amount.toFixed(2)}
        </div>
        <div className="text-sm mt-1" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {description}
        </div>
      </div>

      {/* Card Payment Form */}
      <div className="space-y-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
            Card Number
          </label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => {
              const val = e.target.value.replace(/\s/g, '').replace(/(.{4})/g, '\$1 ').trim();
              setCardNumber(val);
            }}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
              color: isDark ? '#fff' : '#000',
              borderColor: PRIMARY_COLOR + '30',
              borderRadius: radius
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
              Expiry
            </label>
            <input
              type="text"
              value={expiry}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val.length >= 2) val = val.slice(0,2) + '/' + val.slice(2,4);
                setExpiry(val);
              }}
              placeholder="MM/YY"
              maxLength={5}
              className="w-full px-4 py-3 border rounded-lg"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                color: isDark ? '#fff' : '#000',
                borderColor: PRIMARY_COLOR + '30',
                borderRadius: radius
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
              CVV
            </label>
            <input
              type="text"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0,4))}
              placeholder="123"
              maxLength={4}
              className="w-full px-4 py-3 border rounded-lg"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                color: isDark ? '#fff' : '#000',
                borderColor: PRIMARY_COLOR + '30',
                borderRadius: radius
              }}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
            Cardholder Name
          </label>
          <input
            type="text"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-4 py-3 border rounded-lg"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
              color: isDark ? '#fff' : '#000',
              borderColor: PRIMARY_COLOR + '30',
              borderRadius: radius
            }}
          />
        </div>

        <button
          onClick={handleCardPayment}
          disabled={loading}
          className="w-full py-4 font-bold shadow-lg transition-all hover:opacity-90"
          style={{
            backgroundColor: PRIMARY_COLOR,
            color: '#000',
            borderRadius: radius,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : \`Pay \${currency === 'USD' ? '\$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency}\${amount.toFixed(2)}\`}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2 my-4">
        <div className="h-px flex-1" style={{ background: PRIMARY_COLOR + '30' }}></div>
        <span className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          OR PAY WITH CRYPTO
        </span>
        <div className="h-px flex-1" style={{ background: PRIMARY_COLOR + '30' }}></div>
      </div>

      {/* Crypto Payment */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
            Select Cryptocurrency
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['BTC', 'ETH', 'USDT', 'USDC'].map((crypto) => (
              <button
                key={crypto}
                onClick={() => setSelectedCrypto(crypto)}
                className="p-3 rounded-lg border-2 transition-all text-left"
                style={{
                  background: selectedCrypto === crypto ? PRIMARY_COLOR + '20' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)'),
                  borderColor: selectedCrypto === crypto ? PRIMARY_COLOR : PRIMARY_COLOR + '30',
                  borderRadius: radius
                }}
              >
                <div className="text-sm font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                  {crypto === 'BTC' ? '₿ Bitcoin' : crypto === 'ETH' ? 'Ξ Ethereum' : crypto === 'USDT' ? '₮ Tether' : '💵 USDC'}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
            Your Wallet Address
          </label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f24aAa"
            className="w-full px-4 py-3 border rounded-lg font-mono text-xs"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
              color: isDark ? '#fff' : '#000',
              borderColor: PRIMARY_COLOR + '30',
              borderRadius: radius
            }}
          />
        </div>

        <button
          onClick={handleCryptoPayment}
          disabled={loading}
          className="w-full py-4 font-bold shadow-lg transition-all hover:opacity-90"
          style={{
            backgroundColor: PRIMARY_COLOR,
            color: '#000',
            borderRadius: radius,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : \`Pay \${amount.toFixed(8)} \${selectedCrypto}\`}
        </button>
      </div>

      {/* Security Badges */}
      <div className="flex items-center justify-center gap-4 mt-6 text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
        <span>🔒 SSL</span>
        <span>🛡️ PCI</span>
        <span>✅ 3DS</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// USAGE EXAMPLES - Copy & paste these into your app!
// ═══════════════════════════════════════════════════════════════

// Example 1: Simple product checkout
// <HyelloPaymentWidget amount={49.99} />

// Example 2: Custom currency
// <HyelloPaymentWidget amount={149.99} currency="EUR" description="Premium Plan" />

// Example 3: Shopping cart with dynamic pricing
// <HyelloPaymentWidget 
//   amount={cartTotal} 
//   currency={userCurrency}
//   description={\`Order #\${orderId}\`}
//   onSuccess={(result) => router.push('/thank-you')}
// />

// Example 4: Production API (when deployed)
// <HyelloPaymentWidget 
//   amount={99.99}
//   apiBaseUrl="https://api.hyello.com"
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

    // Skip NPM install - component is standalone!
    log.step(4, 'Skipping NPM Install');
    log.info('Component is standalone - no external packages needed!');
    log.success('No dependencies required!');

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
    console.log(`${colors.green}${colors.bright}🎉 Standalone Widget Ready!\n${colors.reset}`);
    console.log(`${colors.cyan}Component:${colors.reset} src/components/HyelloPaymentWidget.tsx`);
    console.log(`${colors.cyan}Type:${colors.reset} Standalone (NO npm packages needed!)`);
    console.log(`${colors.cyan}Usage:${colors.reset} <HyelloPaymentWidget amount={99.99} currency="USD" />`);
    console.log(`${colors.cyan}Test Card:${colors.reset} ${colors.green}4242424242424242${colors.reset}`);
    console.log(`${colors.cyan}API Backend:${colors.reset} ${colors.blue}http://localhost:3000${colors.reset} (must be running!)`);
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
