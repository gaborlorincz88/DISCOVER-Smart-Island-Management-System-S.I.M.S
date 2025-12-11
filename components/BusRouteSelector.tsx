import React, { useState, useEffect, useRef } from 'react';
import { getApiBaseUrl } from '../services/config';

interface BusRoute {
    id: string;
    name: string;
    displayedName?: string;
}

interface BusRouteSelectorProps {
    selectedBusRoute: string | null;
    onBusRouteChange: (routeId: string | null) => void;
    onDropdownToggle?: (isOpen: boolean) => void;
}

const BusRouteSelector: React.FC<BusRouteSelectorProps> = ({ selectedBusRoute, onBusRouteChange, onDropdownToggle }) => {
    const [busRoutes, setBusRoutes] = useState<BusRoute[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Detect theme from document or default to dark
    useEffect(() => {
        const updateTheme = () => {
            const isDark = document.documentElement.classList.contains('dark') || 
                          document.documentElement.getAttribute('data-theme') === 'dark' ||
                          !document.documentElement.getAttribute('data-theme');
            setTheme(isDark ? 'dark' : 'light');
        };

        updateTheme();
        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-theme']
        });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const fetchBusRoutes = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`${getApiBaseUrl()}/api/bus-routes`);
                const data = await response.json();
                setBusRoutes(data);
            } catch (error) {
                console.error('Failed to fetch bus routes:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchBusRoutes();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                onDropdownToggle?.(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    const selectedRoute = busRoutes.find(route => route.id === selectedBusRoute);
    const displayText = selectedRoute ? (selectedRoute.displayedName || selectedRoute.name) : (isLoading ? 'Loading...' : 'None');

    const handleSelect = (routeId: string | null) => {
        onBusRouteChange(routeId);
        setIsOpen(false);
        onDropdownToggle?.(false);
    };

    // Calculate dropdown height - show at least 8 routes, max 12 (384px to 576px)
    const visibleRoutes = Math.min(Math.max(8, busRoutes.length + 1), 12);
    const dropdownHeight = visibleRoutes * 48; // 48px per item

    const arrowIcon = (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            style={{ fill: theme === 'dark' ? '#94a3b8' : '#475569' }}
        >
            <path d="M6 9L1 4h10z" />
        </svg>
    );

    return (
        <div id="bus-route-selector-container" data-dropdown-open={isOpen ? "true" : "false"}>
            <label className="block text-lg font-medium text-[rgb(var(--text-secondary))] text-center mb-2">
                Select Bus Route
            </label>
            <div className="w-full">
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={() => {
                        const newIsOpen = !isOpen;
                        setIsOpen(newIsOpen);
                        onDropdownToggle?.(newIsOpen);
                    }}
                    disabled={isLoading}
                    className="w-full pl-4 pr-10 py-2.5 text-sm md:text-base border border-[rgb(var(--border-color))] rounded-full bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] cursor-pointer transition-all duration-200 hover:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-left flex items-center justify-between"
                >
                    <span className="truncate">{displayText}</span>
                    <span className="flex-shrink-0 ml-2">{arrowIcon}</span>
                </button>

                {isOpen && (
                    <div
                        ref={dropdownRef}
                        className="w-full mt-2 rounded-lg bg-[rgb(var(--input-bg))] border border-[rgb(var(--border-color))] shadow-lg"
                        style={{
                            height: `${dropdownHeight}px`,
                            overflowY: 'auto',
                            boxShadow: theme === 'dark' 
                                ? '0 10px 25px rgba(0, 0, 0, 0.5)' 
                                : '0 10px 25px rgba(0, 0, 0, 0.15)'
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => handleSelect(null)}
                            className={`w-full text-left px-4 py-3 text-sm md:text-base text-[rgb(var(--text-primary))] hover:bg-cyan-500/10 transition-colors duration-150 ${
                                !selectedBusRoute ? 'bg-cyan-500/20 font-semibold' : ''
                            }`}
                            style={{ minHeight: '48px', display: 'flex', alignItems: 'center' }}
                        >
                            None
                        </button>
                        {busRoutes.map(route => (
                            <button
                                key={route.id}
                                type="button"
                                onClick={() => handleSelect(route.id)}
                                className={`w-full text-left px-4 py-3 text-sm md:text-base text-[rgb(var(--text-primary))] hover:bg-cyan-500/10 transition-colors duration-150 border-t border-[rgb(var(--border-color))] ${
                                    selectedBusRoute === route.id ? 'bg-cyan-500/20 font-semibold' : ''
                                }`}
                                style={{ minHeight: '48px', display: 'flex', alignItems: 'center' }}
                            >
                                {route.displayedName || route.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusRouteSelector;
