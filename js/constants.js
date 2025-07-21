// js/constants.js

export let DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]; // يمكن تخصيصها مستقبلاً
export let TIME_SLOTS = [ // ستصبح قابلة للتخصيص
    "8:00-9:40", "10:00-11:40", "12:00-13:40", "14:00-15:40", "16:00-17:40"
]; // Standard slot duration: 100 minutes

export let TIME_SLOTS_MINUTES = []; // ستُحسب ديناميكياً

export const STORAGE_KEYS = {
    PROFESSORS: 'professors',
    ROOMS: 'rooms',
    COURSES: 'courses',
    SCHEDULES: 'schedules',
    CURRENT_SCHEDULE: 'currentSchedule',
    CUSTOM_TIME_SLOTS: 'customTimeSlots',
    ACADEMIC_PERIOD: 'academicPeriod'
};
