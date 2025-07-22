// js/utils.js

import { TIME_SLOTS, TIME_SLOTS_MINUTES } from './constants.js';

/**
 * Gets the Arabic name of a day by its index (0=Sunday, 1=Monday, etc.).
 * @param {number} dayIndex
 * @returns {string} Day name
 */
export const getDayName = (dayIndex) => {
    const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    return days[dayIndex];
};

/**
 * Parses a time range string "HH:MM-HH:MM" into start and end times.
 * @param {string} timeRange e.g., "8:00-9:40"
 * @returns {{start: string, end: string} | null} Parsed times or null if invalid
 */
export const parseTimeRange = (timeRange) => {
    if (typeof timeRange !== 'string' || !timeRange.includes('-')) {
        // console.warn("Invalid time range string:", timeRange);
        return null; // Return null for invalid input
    }
    const [start, end] = timeRange.split('-');
    return { start: start.trim(), end: end.trim() };
};

/**
 * Converts a time string "HH:MM" to minutes from midnight.
 * @param {string} timeStr e.g., "08:00"
 * @returns {number | null} Minutes from midnight or null if invalid
 */
export const toMinutes = (timeStr) => {
    if (typeof timeStr !== 'string' || !timeStr.includes(':')) {
        // console.warn("Invalid time string passed to toMinutes:", timeStr); // Use warn instead of error for less critical issues
        return null; // Return null for invalid input
    }
    const parts = timeStr.split(':').map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
        // console.warn("Invalid time format in toMinutes:", timeStr);
        return null;
    }
    return parts[0] * 60 + parts[1];
};

/**
 * Checks if two time intervals conflict.
 * @param {string} time1Start
 * @param {string} time1End
 * @param {string} time2Start
 * @param {string} time2End
 * @returns {boolean} True if conflicts, false otherwise
 */
export const isTimeConflict = (time1Start, time1End, time2Start, time2End) => {
    const t1s = toMinutes(time1Start);
    const t1e = toMinutes(time1End);
    const t2s = toMinutes(time2Start);
    const t2e = toMinutes(time2End);

    if (t1s === null || t1e === null || t2s === null || t2e === null) {
        // console.warn("Skipping time conflict check due to invalid time string.");
        return false;
    }

    return Math.max(t1s, t2s) < Math.min(t1e, t2e);
};

/**
 * Generates a unique ID for new data entries.
 * @returns {string} Unique ID
 */
export const generateUniqueId = () => {
    return '_' + Math.random().toString(36).substr(2, 9);
};

// ======================================================
// UI Related Utilities (مثل ShowAlert)
// ======================================================
// Note: conflictAlertsDiv سيتم استيراده من uiManager.js أو تمريره كمعامل
let currentAlertDiv = null; // لتخزين عنصر div التنبيه

// وظيفة لضبط عنصر div التنبيه بعد تحميل DOM
export const setAlertDiv = (divElement) => {
    currentAlertDiv = divElement;
};

/**
 * Displays an alert message to the user.
 * @param {string} message - The message to display
 * @param {'danger' | 'success' | 'info' | 'warning'} type - The type of alert for styling
 */
export const showAlert = (message, type = 'danger') => {
    if (!currentAlertDiv) {
        console.warn("Alert div not set in utils.js. Cannot show alert:", message);
        return;
    }
    currentAlertDiv.innerHTML = message;
    currentAlertDiv.className = `alert alert-${type}`;
    currentAlertDiv.style.display = 'block';
    if (window.alertTimeout) clearTimeout(window.alertTimeout);
    window.alertTimeout = setTimeout(() => {
        currentAlertDiv.style.display = 'none';
    }, 8000); // Hide after 8 seconds
};

// وظيفة لإعادة حساب الدقائق للفترات الزمنية
export const calculateTimeSlotsMinutes = () => {
    TIME_SLOTS_MINutes.splice(0, TIME_SLOTS_MINUTES.length); // إفراغ المصفوفة
    TIME_SLOTS.forEach(slot => {
        const parsed = parseTimeRange(slot);
        if (parsed) {
            TIME_SLOTS_MINUTES.push({
                start: toMinutes(parsed.start),
                end: toMinutes(parsed.end)
            });
        }
    });
};
