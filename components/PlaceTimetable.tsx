import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiBaseUrl } from '../services/config';

interface PlaceTimetableProps {
  placeId: string | number;
  placeName?: string; // Optional, not needed for full timetable
}

interface TimeSlot {
  time: string;
  minutes: number;
  isNext: boolean;
  countdown?: string;
}

interface StopTimetable {
  stopName: string;
  times: string[];
}

const PlaceTimetable: React.FC<PlaceTimetableProps> = ({ placeId }) => {
  const { t } = useTranslation();
  const [stops, setStops] = useState<StopTimetable[]>([]);
  const [operator, setOperator] = useState<string | null>(null);
  // timezone is read from the timetable JSON but not displayed anymore
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedDayType, setSelectedDayType] = useState<string | null>(null);
  const [isPublicHoliday, setIsPublicHoliday] = useState<boolean>(false);
  const [seasonLabel, setSeasonLabel] = useState<string | null>(null);
  const [timeAnnotations, setTimeAnnotations] = useState<Map<string, any>>(new Map());
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [countdowns, setCountdowns] = useState<Map<string, string>>(new Map());

  // Helper: get local date parts in the target timezone using Intl
  const getLocalDateParts = (timeZone: string) => {
    try {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hour12: false
      });
      const parts = fmt.formatToParts(now);
      const map: any = {};
      parts.forEach(p => { map[p.type] = p.value; });
  const year = Number(map.year);
  const month = map.month; // MM
  const day = map.day; // DD
  const hour = Number(map.hour);
  const minute = Number(map.minute);
      const weekdayShort = map.weekday; // e.g. Mon, Tue
      const ymd = `${year}-${month}-${day}`;
      // Map weekday short to number (0=Sun..6=Sat)
      const wkMap: any = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
      const weekday = wkMap[weekdayShort] ?? new Date().getDay();
  return { ymd, weekday, hour, minute, month, day };
    } catch (err) {
      // Fallback to local system date
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return { ymd: `${y}-${m}-${d}`, weekday: now.getDay(), hour: now.getHours(), minute: now.getMinutes() };
    }
  };

  useEffect(() => {
    const fetchTimetable = async () => {
      if (!placeId) {
        return;
      }

      try {
        setError(null);
        console.log('🚢 Fetching timetable for placeId:', placeId);
        console.log('🚢 API URL:', `${getApiBaseUrl()}/api/places/${encodeURIComponent(placeId)}/timetable`);
        
        // Fetch full timetable (all stops)
        const response = await fetch(`${getApiBaseUrl()}/api/places/${encodeURIComponent(placeId)}/timetable`);
        
        console.log('🚢 Response status:', response.status, response.statusText);
        console.log('🚢 Response headers:', Object.fromEntries(response.headers.entries()));
        
        const contentType = response.headers.get('content-type');
        if (!response.ok) {
          const text = await response.text();
          console.error('🚢 Error response:', text);
          if (response.status === 404) {
            throw new Error('No timetable file found for this place');
          }
          throw new Error(t('bus.timetable_error') || 'Failed to load timetable');
        }
        
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('🚢 Received non-JSON response:', text);
          throw new Error(t('bus.timetable_error') || 'Failed to load timetable');
        }

        const data = await response.json();
        console.log('🚢 Timetable data received:', data);

        // Two supported schemas:
        // - simple: either object mapping stop->times or array of {name,times}
        // - rich: includes seasons, timezone, operator, and day-type mappings
        let stopsData: StopTimetable[] = [];
        // Reset operator (timezone is intentionally not displayed)
        const meta = data && (data.metadata || {});
        setOperator(data && data.operator ? String(data.operator) : (meta && meta.operator ? String(meta.operator) : null));

        // compute service-local date parts once (used for matching rules)
        const tzForCalc = data && (data.timezone || meta.timezone) ? (data.timezone || meta.timezone) : 'Europe/Malta';
        const localParts = getLocalDateParts(tzForCalc);
        const { ymd: localYmd, weekday: localWeekday, hour: localHour, month: localMonth, day: localDay } = localParts;

        // helper: normalize a raw times array which may contain strings or objects with rules
        const normalizeTimes = (rawTimes: any[], stopName: string, annotationsMap: Map<string, any>) => {
          const out: string[] = [];
          const mmddTarget = `${String(localMonth).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`;
          const ymdTarget = localYmd;
          const weekday = localWeekday;

          const dayNameFromNum = (n: number) => {
            const wkMap: any = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
            return wkMap[n] || '';
          };

          const ruleMatches = (rule: any) => {
            if (!rule) return false;
            // days check
            if (rule.days) {
              if (rule.days === 'daily') {
                // pass
              } else if (Array.isArray(rule.days)) {
                const matched = rule.days.some((d: any) => {
                  if (typeof d === 'number') return d === weekday;
                  const dStr = String(d);
                  return dStr.slice(0,3).toLowerCase() === dayNameFromNum(weekday).slice(0,3).toLowerCase();
                });
                if (!matched) return false;
              } else if (typeof rule.days === 'string') {
                if (rule.days !== 'daily') {
                  const dStr = String(rule.days);
                  if (dStr.slice(0,3).toLowerCase() !== dayNameFromNum(weekday).slice(0,3).toLowerCase()) return false;
                }
              }
            }

            // date range check
            if (rule.from && rule.to) {
              const f = String(rule.from);
              const t = String(rule.to);
              if (f.length === 5 && t.length === 5) {
                // MM-DD recurring
                const fromNum = Number(f.replace('-', ''));
                const toNum = Number(t.replace('-', ''));
                const curNum = Number(mmddTarget.replace('-', ''));
                if (fromNum <= toNum) {
                  if (!(curNum >= fromNum && curNum <= toNum)) return false;
                } else {
                  if (!(curNum >= fromNum || curNum <= toNum)) return false;
                }
              } else if (f.length === 10 && t.length === 10) {
                if (!(ymdTarget >= f && ymdTarget <= t)) return false;
              }
            }

            return true;
          };

          (rawTimes || []).forEach((entry: any) => {
            if (typeof entry === 'string') {
              out.push(entry);
            } else if (entry && typeof entry === 'object' && entry.time) {
              if (!entry.when || entry.when.length === 0) {
                out.push(entry.time);
              } else {
                const anyMatch = entry.when.some((r: any) => ruleMatches(r));
                if (anyMatch) {
                  out.push(entry.time);
                  annotationsMap.set(`${stopName}-${entry.time}`, entry);
                }
              }
            }
          });

          return out;
        };

        // annotation collector for all branches
        const allAnnotations = new Map<string, any>();

        // Detect season label (Summer/Winter) from any object time rules present in the raw data
        const detectSeasonLabel = (raw: any) => {
          try {
            const mmdd = `${String(localParts.month).padStart(2, '0')}-${String(localParts.day).padStart(2, '0')}`;
            const curNum = Number(mmdd.replace('-', ''));
            const monthNum = Number(localParts.month);
            let found: string | null = null;

            const checkRule = (rule: any) => {
              if (!rule || !rule.from || !rule.to) return false;
              const f = String(rule.from);
              const t = String(rule.to);
              if (f.length === 5 && t.length === 5) {
                const fromNum = Number(f.replace('-', ''));
                const toNum = Number(t.replace('-', ''));
                let inRange = false;
                if (fromNum <= toNum) {
                  inRange = curNum >= fromNum && curNum <= toNum;
                } else {
                  inRange = curNum >= fromNum || curNum <= toNum;
                }
                if (inRange) {
                  // classify by month: May(05)-Sep(09) => Summer, else Winter
                  if (monthNum >= 5 && monthNum <= 9) found = 'Summer timetable';
                  else found = 'Winter timetable';
                  return true;
                }
              } else if (f.length === 10 && t.length === 10) {
                const ymdTarget = localParts.ymd;
                if (ymdTarget >= f && ymdTarget <= t) {
                  if (monthNum >= 5 && monthNum <= 9) found = 'Summer timetable';
                  else found = 'Winter timetable';
                  return true;
                }
              }
              return false;
            };

            // Walk the raw object and look for any entry objects with .when arrays
            const walk = (node: any) => {
              if (!node || found) return;
              if (Array.isArray(node)) {
                for (const e of node) {
                  if (found) break;
                  if (e && typeof e === 'object' && Array.isArray(e.when)) {
                    for (const r of e.when) {
                      if (checkRule(r)) break;
                    }
                  } else if (Array.isArray(e) || typeof e === 'object') {
                    walk(e);
                  }
                }
              } else if (typeof node === 'object') {
                for (const v of Object.values(node)) {
                  if (found) break;
                  walk(v);
                }
              }
            };

            walk(raw);
            return found;
          } catch (e) {
            return null;
          }
        };

        const detected = detectSeasonLabel(data);
        setSeasonLabel(detected);

        if (data && data.seasons) {
          // Rich schema - normalize flexible season/day_types shapes
          const rawSeasons: any = data.seasons;

          const normalizeSeasons = (raw: any) => {
            const out: Record<string, any> = {};
            if (Array.isArray(raw)) {
              raw.forEach((s: any, idx: number) => {
                const id = s.id || s.name || `season_${idx}`;
                // day types may be under s.day_types or s.dayTypes or directly as keys
                const dayTypes = s.day_types || s.dayTypes || (() => {
                  const copy = { ...s };
                  delete copy.id;
                  delete copy.name;
                  delete copy.notes;
                  return copy;
                })();
                out[id] = {};
                Object.keys(dayTypes || {}).forEach((dt) => {
                  const val = dayTypes[dt];
                  out[id][dt] = (val && val.stops) ? val.stops : val;
                });
              });
            } else if (raw && typeof raw === 'object') {
              Object.entries(raw).forEach(([sid, s]: any) => {
                if (s && s.day_types) {
                  out[sid] = {};
                  Object.entries(s.day_types).forEach(([dt, val]: any) => {
                    out[sid][dt] = (val && val.stops) ? val.stops : val;
                  });
                } else {
                  // assume s already maps dayType -> stops
                  out[sid] = s;
                }
              });
            }
            return out;
          };

          const seasonsObj = normalizeSeasons(rawSeasons);
          const seasonKeys = Object.keys(seasonsObj || {});
          const seasonKey = seasonKeys.includes('all_year') ? 'all_year' : seasonKeys[0];
          setSelectedSeason(seasonKey || null);

          const tz = data.timezone || meta.timezone || 'Europe/Malta';
          const { ymd, weekday, hour, month, day } = getLocalDateParts(tz);

          // determine day type: prefer public_holidays if present
          let dayType = null as string | null;
          const holidays = data.public_holidays || data.publicHolidays || meta.public_holidays || meta.publicHolidays || [];
          const holidayListPresent = Array.isArray(holidays) && holidays.length > 0;

          // allow holidays to be specified as YYYY-MM-DD or MM-DD (recurring every year)
          const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          // prefer explicit public_holiday match when holidays list provided (match full date or month-day)
          if (holidayListPresent && (holidays.includes(ymd) || holidays.includes(mmdd))) {
            dayType = 'sunday_public_holiday';
          } else if (weekday === 0) {
            // it's Sunday: only treat as public holiday if season explicitly has that day-type or if a holiday list exists
            const season = seasonsObj[seasonKey] || {};
            if (holidayListPresent && season['sunday_public_holiday']) {
              dayType = 'sunday_public_holiday';
            } else if (season['sunday_public_holiday']) {
              dayType = 'sunday_public_holiday';
            } else if (season['sunday']) {
              dayType = 'sunday';
            } else {
              dayType = 'weekday';
            }
          } else if (weekday === 6) {
            dayType = 'saturday';
          } else {
            dayType = 'weekday';
          }

          // If night_service exists and current hour is in early morning range, prefer it
          if (hour >= 0 && hour < 6 && seasonsObj[seasonKey] && seasonsObj[seasonKey].night_service) {
            dayType = 'night_service';
          }

          setSelectedDayType(dayType);
          // mark whether today is considered a public holiday for display purposes
          const isHolidayNow = (holidayListPresent && holidays.includes(ymd)) || dayType === 'sunday_public_holiday';
          setIsPublicHoliday(Boolean(isHolidayNow));

          const season = seasonsObj[seasonKey] || {};
          let scheduleForDay: any = (season && season[dayType]) ? season[dayType] : null;
          if (!scheduleForDay) {
            // If today was detected as a public holiday, prefer weekend schedules (saturday or sunday)
            if (dayType === 'sunday_public_holiday') {
              scheduleForDay = season['sunday_public_holiday'] || season['saturday'] || season['sunday'] || season['weekday'] || season[Object.keys(season)[0]] || {};
            } else {
              // fallback: weekday -> saturday -> first available
              scheduleForDay = season['weekday'] || season['saturday'] || season[Object.keys(season)[0]] || {};
            }
          }

          // scheduleForDay is expected to be an object mapping stopName -> times[]
          // Support times as either strings or objects with applicability rules.
          stopsData = Object.entries(scheduleForDay).map(([stopName, times]) => {
            const rawTimes = Array.isArray(times) ? times : [];
            const filtered: string[] = [];

            const mmddTarget = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const ymdTarget = ymd;

            const wkNames: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };

            const dayNameFromNum = (n: number) => Object.keys(wkNames).find(k => wkNames[k] === n) || '';

            const ruleMatches = (rule: any) => {
              if (!rule) return false;
              // days check
              if (rule.days) {
                if (rule.days === 'daily') {
                  // pass
                } else if (Array.isArray(rule.days)) {
                  const daysArr = rule.days;
                  const matched = daysArr.some((d: any) => {
                    if (typeof d === 'number') return d === weekday;
                    return String(d).toLowerCase().startsWith(dayNameFromNum(weekday).toLowerCase().slice(0,3));
                  });
                  if (!matched) return false;
                } else if (typeof rule.days === 'string') {
                  if (rule.days !== 'daily') {
                    // single weekday string
                    const d = rule.days;
                    if (!d.toLowerCase().startsWith(dayNameFromNum(weekday).toLowerCase().slice(0,3))) return false;
                  }
                }
              }

              // date range check: support MM-DD (recurring) or YYYY-MM-DD
              if (rule.from && rule.to) {
                const f = String(rule.from);
                const t = String(rule.to);
                if (f.length === 5 && t.length === 5) {
                  // MM-DD range (recurring)
                  const toNum = Number(t.replace('-', ''));
                  const fromNum = Number(f.replace('-', ''));
                  const curNum = Number(mmddTarget.replace('-', ''));
                  if (fromNum <= toNum) {
                    if (!(curNum >= fromNum && curNum <= toNum)) return false;
                  } else {
                    // wrap year
                    if (!(curNum >= fromNum || curNum <= toNum)) return false;
                  }
                } else if (f.length === 10 && t.length === 10) {
                  // full date range
                  if (!(ymdTarget >= f && ymdTarget <= t)) return false;
                }
              }

              return true;
            };

            rawTimes.forEach((entry: any) => {
              if (typeof entry === 'string') {
                filtered.push(entry);
              } else if (entry && typeof entry === 'object' && entry.time) {
                // If no when rules provided, treat as unconditional
                if (!entry.when || entry.when.length === 0) {
                  filtered.push(entry.time);
                } else {
                  const anyMatch = entry.when.some((r: any) => ruleMatches(r));
                  if (anyMatch) {
                    filtered.push(entry.time);
                    allAnnotations.set(`${stopName}-${entry.time}`, entry);
                  }
                }
              }
            });

            return { stopName, times: filtered };
          });

        
        } else if (Array.isArray(data)) {
          // Format 2: Array of stop objects
          stopsData = data.map((stop: any) => ({
            stopName: stop.name,
            times: normalizeTimes(stop.times || stop.schedule || [], stop.name, allAnnotations)
          }));
        } else {
          // Format 1: Object with stop names as keys
          // Skip known metadata keys such as metadata/operator/timezone/public_holidays/seasons
          const metaKeys = new Set(['metadata','operator','timezone','public_holidays','publicHolidays','seasons','day_types','dayTypes']);
          stopsData = Object.entries(data)
            .filter(([k, v]) => !metaKeys.has(k) && Array.isArray(v))
            .map(([stopName, times]) => ({
              stopName,
              times: normalizeTimes(Array.isArray(times) ? times : [], stopName, allAnnotations)
            }));
        }

        // publish collected annotations for the UI
        setTimeAnnotations(allAnnotations);

        console.log('🚢 Processed stops data:', stopsData, { season: selectedSeason, dayType: selectedDayType, operator: data.operator, timezone: data.timezone });
        setStops(stopsData);
        
        // Calculate current time in minutes
        const now = new Date();
        setCurrentTime(now.getHours() * 60 + now.getMinutes());
      } catch (err: any) {
        console.error('🚢 Error fetching timetable:', err);
        setError(err.message);
      }
    };

    fetchTimetable();
    // Refresh every minute
    const interval = setInterval(fetchTimetable, 60000);
    return () => clearInterval(interval);
  }, [placeId, t]);

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.getHours() * 60 + now.getMinutes());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate countdowns for all times across all stops
  useEffect(() => {
    if (stops.length === 0) return;

    const updateCountdowns = () => {
      const now = new Date();
      const newCountdowns = new Map<string, string>();

  stops.forEach((stop: StopTimetable) => {
        stop.times.forEach((timeEntry: any) => {
          // Defensive: support time entries that might be objects {time: 'HH:MM', ...}
          let timeStr = typeof timeEntry === 'string' ? timeEntry : (timeEntry && typeof timeEntry.time === 'string' ? timeEntry.time : null);
          if (!timeStr) return; // skip invalid entries
          const [hours, minutes] = timeStr.split(':').map(Number);
          const departureTime = new Date();
          departureTime.setHours(hours, minutes, 0, 0);

          // If time is tomorrow, add 24 hours
          if (departureTime.getTime() < now.getTime()) {
            departureTime.setDate(departureTime.getDate() + 1);
          }

          const diff = departureTime.getTime() - now.getTime();

          if (diff <= 0) {
            newCountdowns.set(`${stop.stopName}-${timeStr}`, t('bus.departed') || 'Departed');
          } else {
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            
            if (h > 0) {
              newCountdowns.set(`${stop.stopName}-${timeStr}`, `${h}h ${m}m`);
            } else if (m > 0) {
              newCountdowns.set(`${stop.stopName}-${timeStr}`, `${m}m ${s}s`);
            } else {
              newCountdowns.set(`${stop.stopName}-${timeStr}`, `${s}s`);
            }
          }
        });
      });

      setCountdowns(newCountdowns);
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, [stops, t]);

  // Get display times for a stop: 1 missed + 4 next (similar to bus stops)
  const getDisplayTimes = (times: string[]): TimeSlot[] => {
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
    });
    // Filter out any nulls produced by invalid entries
    const validTimeSlots = timeSlots.filter(Boolean) as TimeSlot[];

    // Handle early morning wrap-around
    const isEarlyMorning = currentTime < 360; // Before 6 AM
    const EVENING_THRESHOLD = 1080; // 6 PM = 18:00

    // Find the next departure
    let nextIndex = -1;
    if (isEarlyMorning) {
      nextIndex = timeSlots.findIndex(slot => {
        if (slot.minutes > currentTime && slot.minutes < EVENING_THRESHOLD) {
          return true;
        }
        return false;
      });
      if (nextIndex === -1) {
        nextIndex = timeSlots.findIndex(slot => slot.minutes > currentTime);
      }
    } else {
      nextIndex = timeSlots.findIndex(slot => slot.minutes > currentTime);
    }

    if (nextIndex === -1) {
      // No more today, show 1 missed and first 4 of tomorrow
      const lastMissed = validTimeSlots.slice(-1);
      const firstTomorrow = validTimeSlots.slice(0, 4);
      const displaySlots = [...lastMissed, ...firstTomorrow];
      if (firstTomorrow.length > 0) {
        const nextBusIndex = displaySlots.findIndex(slot => slot.time === firstTomorrow[0].time);
        if (nextBusIndex !== -1) {
          displaySlots[nextBusIndex].isNext = true;
        }
      }
      return displaySlots;
    }

    // Get 1 missed bus and 4 next buses
    let missedBuses: TimeSlot[] = [];
    if (isEarlyMorning) {
      const pastBuses = validTimeSlots.filter(slot => {
        return slot.minutes <= currentTime || (slot.minutes > EVENING_THRESHOLD);
      });
      missedBuses = pastBuses.slice(-1);
    } else {
      if (nextIndex > 0) {
        missedBuses = [timeSlots[nextIndex - 1]];
      }
    }

    // Get next bus and 3 after (total: 1 missed + 1 next + 3 after = 5 buses)
  const endIndex = Math.min(validTimeSlots.length, nextIndex + 4); // next + 3 after = 4 total upcoming
  const upcomingBuses = validTimeSlots.slice(nextIndex, endIndex);

  const displaySlots = [...missedBuses, ...upcomingBuses];

    // Mark the next bus
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

  if (error) {
    return (
      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (stops.length === 0) {
    return (
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400 text-sm">{t('bus.no_timetable') || 'No timetable available'}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 mb-6">
      <h4 className="text-lg font-semibold mb-4 text-[rgb(var(--text-primary))] text-center flex items-center justify-center gap-2">
        <span className="text-2xl">🚢</span>
        Ferry Timetable
      </h4>
      { (operator || selectedDayType || seasonLabel) && (
        <div className="text-center text-sm text-[rgb(var(--text-secondary))] mb-4">
          {operator && <span className="mr-3">{operator}</span>}
          {seasonLabel ? (
            <span>{seasonLabel}</span>
          ) : selectedDayType ? (
            <span>{(() => {
              // Friendly labels for day types
              const map: Record<string, string> = {
                'weekday': 'Weekdays Timetable',
                'saturday': 'Saturday Timetable',
                'sunday_public_holiday': 'Public Holiday Timetable',
                'sunday': 'Sunday Timetable',
                'night_service': 'Night Service Timetable'
              };
              return map[selectedDayType] || selectedDayType.replace(/_/g, ' ');
            })()}</span>
          ) : null}
        </div>
      ) }
      <div className="space-y-6">
  {stops.map((stop: StopTimetable) => {
          const displayTimes = getDisplayTimes(stop.times);
          
          return (
            <div key={stop.stopName} className="space-y-2">
              <h5 className="text-md font-semibold text-[rgb(var(--text-primary))] mb-3">
                {stop.stopName}
              </h5>
              
              {displayTimes.map((slot, index) => {
                const countdown = countdowns.get(`${stop.stopName}-${slot.time}`);
                const [hours, minutes] = slot.time.split(':').map(Number);
                const slotTimeMinutes = hours * 60 + minutes;
                const isEarlyMorning = currentTime < 360;
                const EVENING_THRESHOLD = 1080;
                const isPast = slotTimeMinutes <= currentTime || (isEarlyMorning && slotTimeMinutes > EVENING_THRESHOLD);
                
                return (
                  <div
                    key={`${stop.stopName}-${slot.time}-${index}`}
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
                          ${isPast ? 'text-yellow-600 dark:text-yellow-400' : 
                            slot.isNext ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                           }
                        `}>
                          {slot.time}
                        </div>
                        
                        {slot.isNext && (
                          <span className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full animate-pulse">
                            Next Ferry
                          </span>
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
          );
        })}
      </div>
    </div>
  );
};

export default PlaceTimetable;
