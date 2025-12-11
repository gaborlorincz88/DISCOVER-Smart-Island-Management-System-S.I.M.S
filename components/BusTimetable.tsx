import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiBaseUrl } from '../services/config';

interface BusTimetableProps {
  routeId: string;
  stopName: string;
}

interface TimeSlot {
  time: string;
  minutes: number;
  isNext: boolean;
  countdown?: string;
}

const BusTimetable: React.FC<BusTimetableProps> = ({ routeId, stopName }) => {
  const { t } = useTranslation();
  const [times, setTimes] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [countdowns, setCountdowns] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchTimetable = async () => {
      if (!routeId || !stopName) {
        return;
      }

      try {
        setError(null);
        // Fix vistoria typo in routeId before making API call
        let correctedRouteId = routeId;
        if (routeId.toLowerCase().includes('vistoria')) {
          correctedRouteId = routeId.replace(/vistoria/gi, 'victoria');
        }
        const response = await fetch(`${getApiBaseUrl()}/api/bus-routes/${encodeURIComponent(correctedRouteId)}/stop/${encodeURIComponent(stopName)}`);
        
        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Received non-JSON response:', text);
          throw new Error(t('bus.timetable_error'));
        }

        const data = await response.json();
        setTimes(data.times || []);
        
        // Calculate current time in minutes
        const now = new Date();
        setCurrentTime(now.getHours() * 60 + now.getMinutes());
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchTimetable();
    // Refresh every minute
    const interval = setInterval(fetchTimetable, 60000);
    return () => clearInterval(interval);
  }, [routeId, stopName, t]);

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.getHours() * 60 + now.getMinutes());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate countdowns for all times
  useEffect(() => {
    if (times.length === 0) return;

    const updateCountdowns = () => {
      const now = new Date();
      const newCountdowns = new Map<string, string>();

      times.forEach((timeEntry: any) => {
        const timeStr = typeof timeEntry === 'string' ? timeEntry : (timeEntry && typeof timeEntry.time === 'string' ? timeEntry.time : null);
        if (!timeStr) return;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const departureTime = new Date();
        departureTime.setHours(hours, minutes, 0, 0);

        // If time is tomorrow, add 24 hours
        if (departureTime.getTime() < now.getTime()) {
          departureTime.setDate(departureTime.getDate() + 1);
        }

        const diff = departureTime.getTime() - now.getTime();

        if (diff <= 0) {
          newCountdowns.set(timeStr, t('bus.departed') || 'Departed');
        } else {
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          
          if (h > 0) {
            newCountdowns.set(timeStr, `${h}h ${m}m`);
          } else if (m > 0) {
            newCountdowns.set(timeStr, `${m}m ${s}s`);
          } else {
            newCountdowns.set(timeStr, `${s}s`);
          }
        }
      });

      setCountdowns(newCountdowns);
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, [times, t]);

  // Find the next bus and get missed buses, next, and 3 after
  const getDisplayTimes = (): TimeSlot[] => {
    if (times.length === 0) return [];

    const timeSlots: TimeSlot[] = times.map((timeEntry: any) => {
      const time = typeof timeEntry === 'string' ? timeEntry : (timeEntry && typeof timeEntry.time === 'string' ? timeEntry.time : null);
      if (!time) return null as any;
      const [hours, minutes] = time.split(':').map(Number);
      const timeMinutes = hours * 60 + minutes;
      return {
        time,
        minutes: timeMinutes,
        isNext: false
      };
    }).filter(Boolean) as TimeSlot[];

    // Handle early morning wrap-around: if it's before 6 AM, late evening buses (after 6 PM) are from yesterday
    const isEarlyMorning = currentTime < 360; // Before 6 AM
    const EVENING_THRESHOLD = 1080; // 6 PM = 18:00

    // Find the actual next bus (skip late evening buses if it's early morning)
    let nextIndex = -1;
    if (isEarlyMorning) {
      // When it's early morning, find the first bus that's either:
      // 1. After current time AND before 6 PM (today's bus)
      // 2. Or if no such bus exists, the first bus after current time
      nextIndex = timeSlots.findIndex(slot => {
        if (slot.minutes > currentTime && slot.minutes < EVENING_THRESHOLD) {
          return true; // This is today's next bus
        }
        return false;
      });
      // If no bus found before 6 PM, just get the first bus after current time
      if (nextIndex === -1) {
        nextIndex = timeSlots.findIndex(slot => slot.minutes > currentTime);
      }
    } else {
      // Normal case: find first bus after current time
      nextIndex = timeSlots.findIndex(slot => slot.minutes > currentTime);
    }
    
    if (nextIndex === -1) {
      // No more buses today, show 1 missed and first 6 of tomorrow (total 7)
      const lastMissed = timeSlots.slice(-1); // Show 1 missed
      const firstTomorrow = timeSlots.slice(0, 6); // Show next + 5 after
      const displaySlots = [...lastMissed, ...firstTomorrow];
      // Mark the first bus of tomorrow as next
      if (firstTomorrow.length > 0) {
        const nextBusIndex = displaySlots.findIndex(slot => slot.time === firstTomorrow[0].time);
        if (nextBusIndex !== -1) {
          displaySlots[nextBusIndex].isNext = true;
        }
      }
      return displaySlots;
    }

    // Get missed buses (only 1 bus before the next bus)
    let missedBuses: TimeSlot[] = [];
    if (isEarlyMorning) {
      // When it's early morning, missed buses are:
      // 1. Buses before current time (same day, like 00:30 when it's 01:18)
      // 2. Late evening buses from yesterday (after 6 PM)
      const pastBuses = timeSlots.filter(slot => {
        return slot.minutes <= currentTime || (slot.minutes > EVENING_THRESHOLD);
      });
      // Take only 1 most recent missed bus
      missedBuses = pastBuses.slice(-1);
    } else {
      // Normal case: get only 1 missed bus before the next bus
      if (nextIndex > 0) {
        missedBuses = [timeSlots[nextIndex - 1]];
      }
    }

    // Get next bus and 5 after (total: 1 missed + 1 next + 5 after = 7 buses)
    const endIndex = Math.min(timeSlots.length, nextIndex + 6); // next + 5 after = 6 total upcoming
    const upcomingBuses = timeSlots.slice(nextIndex, endIndex);

    // Combine missed buses + upcoming buses (total of 7 buses)
    const displaySlots = [...missedBuses, ...upcomingBuses];

    // Mark the next bus (first bus in upcomingBuses)
    if (upcomingBuses.length > 0) {
      const nextBusInDisplay = displaySlots.findIndex(slot => 
        slot.time === upcomingBuses[0].time
      );
      if (nextBusInDisplay !== -1) {
        displaySlots[nextBusInDisplay].isNext = true;
      }
    }

    return displaySlots;
  };

  const displayTimes = getDisplayTimes();

  if (error) {
    return (
      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (displayTimes.length === 0) {
    return (
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400 text-sm">{t('bus.no_timetable') || 'No timetable available'}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 mb-6">
      <h4 className="text-lg font-semibold mb-4 text-[rgb(var(--text-primary))] text-center flex items-center justify-center gap-2">
        <span className="text-2xl">🚌</span>
        Timetable
      </h4>
      
      <div className="space-y-2">
        {displayTimes.map((slot, index) => {
          const countdown = countdowns.get(slot.time);
          // Check if this bus time has already passed
          // Compare the time in minutes with current time
          const timeStr = typeof slot.time === 'string' ? slot.time : (slot && (slot as any).time ? (slot as any).time : null);
          if (!timeStr) return null;
          const [hours, minutes] = timeStr.split(':').map(Number);
          const slotTimeMinutes = hours * 60 + minutes;
          // Handle early morning wrap-around: late evening buses (after 6 PM) are from yesterday
          const isEarlyMorning = currentTime < 360; // Before 6 AM
          const EVENING_THRESHOLD = 1080; // 6 PM = 18:00
          const isPast = slotTimeMinutes <= currentTime || (isEarlyMorning && slotTimeMinutes > EVENING_THRESHOLD);
          
          return (
            <div
              key={`${slot.time}-${index}`}
              className={`
                p-4 rounded-lg border-2 transition-all duration-200
                ${slot.isNext
                  ? 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border-blue-400 dark:border-blue-500 shadow-lg transform scale-[1.02]'
                  : isPast
                  ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 border-yellow-400 dark:border-yellow-500 shadow-lg transform scale-[1.02]'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`
                    text-2xl font-bold min-w-[60px]
                    ${slot.isNext
                      ? 'text-blue-600 dark:text-blue-400'
                      : isPast
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-gray-700 dark:text-gray-300'
                    }
                  `}>
                    {slot.time}
                  </div>
                  
                  {slot.isNext && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full animate-pulse">
                        Next Bus
                      </span>
                    </div>
                  )}
                  
                  {isPast && !slot.isNext && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                      Missed
                    </span>
                  )}
                </div>
                
                {countdown && !isPast && (
                  <div className={`
                    text-right
                    ${slot.isNext
                      ? 'text-blue-600 dark:text-blue-400 font-semibold text-lg'
                      : 'text-gray-600 dark:text-gray-400 text-sm'
                    }
                  `}>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Departure in:
                    </div>
                    <div className="font-mono font-bold">
                      {countdown}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BusTimetable;



