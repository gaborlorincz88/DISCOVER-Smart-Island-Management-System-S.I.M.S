import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiBaseUrl } from '../services/config';

interface BusCountdownProps {
  routeId: string;
  stopName: string;
}

const BusCountdown: React.FC<BusCountdownProps> = ({ routeId, stopName }) => {
  const { t } = useTranslation();
  const [nextDeparture, setNextDeparture] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimetable = async () => {
      // Guard against fetching with invalid props
      if (!routeId || !stopName) {
        return;
      }

      try {
        // Reset state for new request
        setNextDeparture(null);
        setError(null);
        setCountdown('');

        const response = await fetch(`${getApiBaseUrl()}/api/bus-routes/${encodeURIComponent(routeId)}/stop/${encodeURIComponent(stopName)}`);
        
        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Received non-JSON response:', text);
            throw new Error(t('bus.timetable_error'));
        }

        const data = await response.json();
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const nextTime = (data.times || [])
          .map((timeEntry: any) => {
            const time = typeof timeEntry === 'string' ? timeEntry : (timeEntry && typeof timeEntry.time === 'string' ? timeEntry.time : null);
            if (!time) return null;
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
          })
          .filter((n: number | null) => n !== null)
          .find((time: number) => time > currentTime);

        if (nextTime) {
          const hours = Math.floor(nextTime / 60);
          const minutes = nextTime % 60;
          setNextDeparture(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        } else {
          setNextDeparture(t('bus.no_more_buses'));
        }
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchTimetable();
  }, [routeId, stopName, t]);

  useEffect(() => {
    // Check if nextDeparture is a time (contains ':') or a message
    if (!nextDeparture || !nextDeparture.includes(':')) {
      setCountdown(nextDeparture || '');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const [hours, minutes] = nextDeparture.split(':').map(Number);
      const departureTime = new Date();
      departureTime.setHours(hours, minutes, 0, 0);

      const diff = departureTime.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown(t('bus.departed'));
        clearInterval(interval);
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [nextDeparture, t]);

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="mt-4">
      <h4 className="text-md font-semibold">{t('bus.next_departure')}</h4>
      <p className="text-lg">{countdown}</p>
    </div>
  );
};

export default BusCountdown;
