
import React from 'react';

const PricingTier: React.FC<{ title: string; price: string; features: string[]; isFeatured?: boolean }> = ({ title, price, features, isFeatured }) => (
  <div className={`border rounded-lg p-6 flex flex-col bg-[rgb(var(--card-bg))] ${isFeatured ? 'border-cyan-500 border-2' : 'border-[rgb(var(--border-color))]'}`}>
    {isFeatured && <span className="bg-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-full self-start mb-4">MOST POPULAR</span>}
    <h3 className="text-2xl font-bold text-[rgb(var(--text-primary))]">{title}</h3>
    <p className="mt-2 text-4xl font-extrabold text-[rgb(var(--text-primary))]">{price}<span className="text-lg font-medium text-[rgb(var(--text-secondary))]">/mo</span></p>
    <ul className="mt-6 space-y-4 text-[rgb(var(--text-secondary))] flex-grow">
      {features.map((feature, i) => (
        <li key={i} className="flex items-start">
          <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
    <button className={`mt-8 w-full py-3 px-6 rounded-lg font-semibold transition-colors ${isFeatured ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-[rgb(var(--bg-hover))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--border-color))]'}`}>
      Get Started
    </button>
  </div>
);


const ForBusinessesPage: React.FC<{ onPageChange: (page: 'app' | 'business') => void; }> = ({ onPageChange }) => {
  return (
    <div className="bg-[rgb(var(--bg-primary))] min-h-screen">
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-base font-semibold text-cyan-500 tracking-wide uppercase">For Businesses</h2>
          <p className="mt-2 text-3xl font-extrabold text-[rgb(var(--text-primary))] tracking-tight sm:text-4xl">
            Put Your Business on the Map
          </p>
          <p className="mt-5 max-w-prose mx-auto text-xl text-[rgb(var(--text-secondary))]">
            Attract thousands of explorers and tourists visiting Malta by featuring your business directly in the AI Travel Buddy app.
            Showcase your location with a custom icon, direct website link, and more.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <PricingTier 
            title="Basic"
            price="$29"
            features={[
              'Listing in one category',
              'Standard category icon',
              'Appear in search results',
              'Basic analytics'
            ]}
          />
          <PricingTier 
            title="Pro"
            price="$79"
            isFeatured={true}
            features={[
              'Everything in Basic, plus:',
              'Customizable map icon & size',
              'Direct "Visit Website" button',
              'Priority placement in search',
              'AI-generated description review'
            ]}
          />
          <PricingTier 
            title="Enterprise"
            price="Custom"
            features={[
              'Everything in Pro, plus:',
              'Multiple location management',
              'Dedicated account manager',
              'Custom API integrations',
              'Advanced analytics & reporting'
            ]}
          />
        </div>

        <div className="mt-20 text-center">
            <h3 className="text-2xl font-bold text-[rgb(var(--text-primary))] mb-4">Ready to get started?</h3>
            <p className="text-lg text-[rgb(var(--text-secondary))] mb-6">Contact our team to find the perfect plan for your business.</p>
            <a href="mailto:sales@aitravelbuddy.example.com" className="inline-block bg-cyan-500 text-white font-bold py-4 px-10 rounded-lg shadow-lg hover:bg-cyan-600 transition-transform hover:scale-105">
                Contact Us
            </a>
             <button onClick={() => onPageChange('app')} className="mt-8 block mx-auto text-cyan-500 hover:text-cyan-400 hover:underline transition-colors">
                &larr; Back to the map
            </button>
        </div>

      </div>
    </div>
  );
};

export default ForBusinessesPage;