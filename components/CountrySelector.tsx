

import React from 'react';
import { CountryData, Coordinates } from '../types';

interface CountrySelectorProps {
  countries: CountryData[];
  onSelectCountry: (coordinates: Coordinates) => void;
}

const CountrySelector: React.FC<CountrySelectorProps> = ({ countries, onSelectCountry }) => {
  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCountryCode = event.target.value;
    const country = countries.find(c => c.code === selectedCountryCode);
    if (country) {
      onSelectCountry(country.coordinates);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg text-center mx-auto max-w-md">
      <h2 className="text-2xl font-bold mb-2 text-gray-800">Welcome, Explorer!</h2>
      <p className="text-gray-600 mb-4">
        We couldn't get your location. Please select a country to start discovering places.
      </p>
      <select
        onChange={handleSelect}
        defaultValue=""
        className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-lg"
      >
        <option value="" disabled>Choose a country...</option>
        {countries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </select>
       <p className="text-gray-500 mt-4 text-sm">
        After selecting, you can pan the map and click "Search This Area".
      </p>
    </div>
  );
};

export default CountrySelector;
