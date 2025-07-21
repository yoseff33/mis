// js/script.js

// ======================================================
// Global Constants & Helpers
// ======================================================
let DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]; // يمكن تخصيصها مستقبلاً
let TIME_SLOTS = [ // ستصبح قابلة للتخصيص
    "8:00-9:40", "10:00-11:40", "12:00-13:40", "14:00-15:40", "16:00-17:40"
]; // Standard slot duration: 100 minutes

let TIME_SLOTS_MINUTES = []; // ستُحسب ديناميكياً

const calculateTimeSlotsMinutes = () => {
    TIME_SLOTS_MINUTES = TIME_SLOTS.map(parseTimeRange).map(t => ({
        start: toMinutes(t.start),
        end: toMinutes(t.end)
    }));
};


/**
 * Gets the Arabic name of a day by its index (0=Sunday, 1=Monday, etc.).
 * @param {number} dayIndex
 * @returns {string} Day name
 */
const getDayName = (dayIndex) => {
    const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    return days[dayIndex];
};

/**
 * Parses a time range string "HH:MM-HH:MM" into start and end times.
 * @param {string} timeRange e.g., "8:00-9:40"
 * @returns {{start: string, end: string} | null} Parsed times or null if invalid
 */
const parseTimeRange = (timeRange) => {
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
const toMinutes = (timeStr) => {
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
const isTimeConflict = (time1Start, time1End, time2Start, time2End) => {
    const t1s = toMinutes(time1Start);
    const t1e = toMinutes(time1End);
    const t2s = toMinutes(time2Start);
    const t2e = toMinutes(time2End);

    // If any time conversion failed, treat as no conflict (or handle as an error upstream)
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
const generateUniqueId = () => {
    return '_' + Math.random().toString(36).substr(2, 9);
};

// ======================================================
// Data Management (LocalStorage CRUD)
// ======================================================
const STORAGE_KEYS = {
    PROFESSORS: 'professors',
    ROOMS: 'rooms',
    COURSES: 'courses',
    SCHEDULES: 'schedules',
    CURRENT_SCHEDULE: 'currentSchedule',
    CUSTOM_TIME_SLOTS: 'customTimeSlots', // مفتاح جديد للفترات الزمنية المخصصة
    ACADEMIC_PERIOD: 'academicPeriod' // مفتاح جديد للفترة الأكاديمية
};

let professors = [];
let rooms = [];
let courses = [];
let schedules = [];
let currentSchedule = [];
let academicPeriod = { year: new Date().getFullYear(), semester: 'الأول' }; // الفترة الأكاديمية الافتراضية

const loadData = () => {
    professors = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFESSORS)) || [];
    rooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOMS)) || [];
    courses = JSON.parse(localStorage.getItem(STORAGE_KEYS.COURSES)) || [];
    schedules = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES)) || [];
    currentSchedule = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_SCHEDULE)) || [];
    const savedTimeSlots = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_TIME_SLOTS));
    if (savedTimeSlots && savedTimeSlots.length > 0) {
        TIME_SLOTS = savedTimeSlots;
    }
    academicPeriod = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACADEMIC_PERIOD)) || academicPeriod;

    calculateTimeSlotsMinutes(); // حساب الدقائق بعد تحميل TIME_SLOTS
    console.log("Data loaded:", { professors, rooms, courses, currentSchedule, schedules, TIME_SLOTS, academicPeriod });
};

const saveData = () => {
    localStorage.setItem(STORAGE_KEYS.PROFESSORS, JSON.stringify(professors));
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
    localStorage.setItem(STORAGE_KEYS.CURRENT_SCHEDULE, JSON.stringify(currentSchedule));
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
    localStorage.setItem(STORAGE_KEYS.CUSTOM_TIME_SLOTS, JSON.stringify(TIME_SLOTS));
    localStorage.setItem(STORAGE_KEYS.ACADEMIC_PERIOD, JSON.stringify(academicPeriod));
    console.log("Data saved.");
};

// CRUD for Professors
const getProfessors = () => professors;
const addProfessor = (professor) => {
    professor.id = generateUniqueId();
    professors.push(professor);
    saveData();
};
const updateProfessor = (id, updatedFields) => {
    const index = professors.findIndex(p => p.id === id);
    if (index > -1) {
        professors[index] = { ...professors[index], ...updatedFields };
        saveData();
    }
};
const deleteProfessor = (id) => {
    professors = professors.filter(p => p.id !== id);
    // Also remove any courses taught by this professor or scheduled appointments
    courses = courses.map(c => c.professorId === id ? { ...c, professorId: null } : c);
    currentSchedule = currentSchedule.filter(appt => appt.professorId !== id);
    saveData();
};

// CRUD for Rooms
const getRooms = () => rooms;
const addRoom = (room) => {
    room.id = generateUniqueId();
    rooms.push(room);
    saveData();
};
const updateRoom = (id, updatedFields) => {
    const index = rooms.findIndex(r => r.id === id);
    if (index > -1) {
        rooms[index] = { ...rooms[index], ...updatedFields };
        saveData();
    }
};
const deleteRoom = (id) => {
    rooms = rooms.filter(r => r.id !== id);
    // Also remove any scheduled appointments in this room
    currentSchedule = currentSchedule.filter(appt => appt.roomId !== id);
    saveData();
};

// CRUD for Courses
const getCourses = () => courses;
const addCourse = (course) => {
    course.id = generateUniqueId();
    courses.push(course);
    saveData();
};
const updateCourse = (id, updatedFields) => {
    const index = courses.findIndex(c => c.id === id);
    if (index > -1) {
        courses[index] = { ...courses[index], ...updatedFields };
        saveData();
    }
};
const deleteCourse = (id) => {
    courses = courses.filter(c => c.id !== id);
    currentSchedule = currentSchedule.filter(appt => appt.courseId !== id);
    saveData();
};

// Schedule Management
const getCurrentSchedule = () => currentSchedule;
const setCurrentSchedule = (schedule) => {
    currentSchedule = schedule;
    saveData();
};

const saveScheduleVersion = (name) => {
    if (currentSchedule.length === 0) {
        showAlert('لا يوجد جدول حالي لحفظه كنسخة.', 'warning');
        return;
    }
    const currentAcademicPeriod = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACADEMIC_PERIOD)) || { year: 'غير محدد', semester: 'غير محدد' };
    schedules.push({
        id: generateUniqueId(),
        name: name,
        timestamp: new Date(),
        schedule: [...currentSchedule],
        academicYear: currentAcademicPeriod.year, // حفظ السنة
        academicSemester: currentAcademicPeriod.semester // حفظ الفصل
    });
    saveData();
    showAlert(`تم حفظ نسخة من الجدول باسم: ${name}`, 'success');
};

const getSavedSchedules = () => schedules;

const loadScheduleVersion = (id) => {
    const saved = schedules.find(s => s.id === id);
    if (saved) {
        setCurrentSchedule(saved.schedule);
        showAlert(`تم تحميل الجدول: ${saved.name}`, 'success');
        return true;
    }
    return false;
};

// CSV/Excel Upload (requires PapaParse for CSV, SheetJS for XLSX)
const uploadFile = (file, type) => {
    return new Promise((resolve, reject) => {
        const fileExtension = file.name.split('.').pop().toLowerCase();

        if (fileExtension === 'csv') {
            if (typeof PapaParse === 'undefined') {
                reject("مكتبة PapaParse غير محملة. لا يمكن قراءة ملفات CSV.");
                return;
            }
            PapaParse.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.errors.length) {
                        console.error("CSV Parsing Errors:", results.errors);
                        reject("حدث خطأ أثناء قراءة الملف.");
                        return;
                    }
                    processUploadedData(results.data, type, resolve, reject);
                },
                error: (err) => {
                    reject(`فشل قراءة الملف: ${err.message}`);
                }
            });
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            if (typeof XLSX === 'undefined') {
                reject("مكتبة SheetJS (XLSX) غير محملة. لا يمكن قراءة ملفات Excel.");
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Read as array of arrays

                    if (json.length < 2) { // Minimum 2 rows: header + at least one data row
                        reject("ملف Excel فارغ أو لا يحتوي على بيانات كافية.");
                        return;
                    }

                    const header = json[0];
                    const rows = json.slice(1);
                    const jsonData = rows.map(row => {
                        const obj = {};
                        header.forEach((h, i) => {
                            obj[h.trim()] = row[i]; // Trim header keys
                        });
                        return obj;
                    });

                    processUploadedData(jsonData, type, resolve, reject);
                } catch (error) {
                    reject(`خطأ في معالجة ملف Excel: ${error.message}`);
                }
            };
            reader.onerror = (err) => {
                reject(`فشل قراءة ملف Excel: ${err.message}`);
            };
            reader.readAsArrayBuffer(file);

        } else {
            reject("صيغة ملف غير مدعومة. يرجى رفع ملف CSV أو Excel (.xlsx, .xls).");
        }
    });
};

const processUploadedData = (data, type, resolve, reject) => {
    try {
        let newEntries = [];
        switch (type) {
            case 'professors':
                newEntries = data.map(row => ({
                    id: generateUniqueId(),
                    name: String(row.name || 'غير معروف'),
                    availableTimes: String(row.availableTimes || '').split(';').map(s => s.trim()).filter(s => s),
                    priority: parseInt(row.priority) || 0,
                    preferences: row.preferences ? JSON.parse(String(row.preferences)) : {}
                }));
                professors = [...professors, ...newEntries];
                break;
            case 'rooms':
                newEntries = data.map(row => ({
                    id: generateUniqueId(),
                    name: String(row.name || 'غير معروف'),
                    type: String(row.type || 'lecture'),
                    availableTimes: String(row.availableTimes || '').split(';').map(s => s.trim()).filter(s => s),
                    locationGroup: String(row.locationGroup || '')
                }));
                rooms = [...rooms, ...newEntries];
                break;
            case 'courses':
                newEntries = data.map(row => ({
                    id: generateUniqueId(),
                    name: String(row.name || 'غير معروف'),
                    sectionName: String(row.sectionName || ''),
                    department: String(row.department || ''), // إضافة القسم
                    professorId: String(row.professorId || null),
                    hours: parseInt(row.hours) || 0,
                    labHours: parseInt(row.labHours) || 0,
                    preferredTimes: String(row.preferredTimes || '').split(';').map(s => s.trim()).filter(s => s),
                    notes: String(row.notes || '')
                }));
                courses = [...courses, ...newEntries];
                break;
            default:
                reject("نوع بيانات غير معروف.");
                return;
        }
        saveData();
        resolve(`تم رفع ملف ${type} بنجاح. تم إضافة ${newEntries.length} سجل جديد.`);
    } catch (e) {
        console.error("Error processing uploaded data:", e);
        reject(`فشل معالجة البيانات من الملف: ${e.message}`);
    }
};

const initializeDummyData = () => {
    professors = [
        { id: 'p1', name: "د. أحمد", availableTimes: ["الأحد:08:00-09:40", "الاثنين:10:00-11:40", "الأربعاء:14:00-15:40"], priority: 1, preferences: { noFriday: true } },
        { id: 'p2', name: "د. سارة", availableTimes: ["الاثنين:08:00-09:40", "الثلاثاء:10:00-11:40", "الخميس:12:00-13:40"], priority: 2, preferences: {} },
        { id: 'p3', name: "د. خالد", availableTimes: ["الأحد:12:00-13:40", "الثلاثاء:08:00-09:40", "الخميس:10:00-11:40"], priority: 3, preferences: {} },
        { id: 'p4', name: "د. فاطمة", availableTimes: ["الأحد:10:00-11:40", "الأربعاء:08:00-09:40", "الخميس:14:00-15:40"], priority: 4, preferences: { noMonday: true } },

    ];
    rooms = [
        { id: 'r1', name: "قاعة 101", type: "lecture", availableTimes: ["الأحد:08:00-18:00", "الاثنين:08:00-18:00", "الثلاثاء:08:00-18:00", "الأربعاء:08:00-18:00", "الخميس:08:00-18:00"], locationGroup: "مبنى أ" },
        { id: 'r2', name: "معمل B", type: "lab", availableTimes: ["الأحد:08:00-18:00", "الاثنين:08:00-18:00", "الثلاثاء:08:00-18:00", "الأربعاء:08:00-18:00", "الخميس:08:00-18:00"], locationGroup: "مبنى ب" },
        { id: 'r3', name: "قاعة 205", type: "lecture", availableTimes: ["الأحد:08:00-18:00", "الاثنين:08:00-18:00", "الثلاثاء:08:00-18:00", "الأربعاء:08:00-18:00", "الخميس:08:00-18:00"], locationGroup: "مبنى أ" },
        { id: 'r4', name: "معمل C", type: "lab", availableTimes: ["الأحد:08:00-18:00", "الاثنين:08:00-18:00", "الثلاثاء:08:00-18:00", "الأربعاء:08:00-18:00", "الخميس:08:00-18:00"], locationGroup: "مبنى ج" },
        { id: 'r5', name: "قاعة 300", type: "lecture", availableTimes: ["الأحد:08:00-18:00", "الاثنين:08:00-18:00", "الثلاثاء:08:00-18:00", "الأربعاء:08:00-18:00", "الخميس:08:00-18:00"], locationGroup: "مبنى د" },

    ];
    courses = [
        { id: 'c1', name: "مقدمة في البرمجة", sectionName: "أ", department: "علوم حاسب", professorId: 'p1', hours: 3, labHours: 1, preferredTimes: ["الأحد:08:00-09:40"], notes: "مادة أساسية" },
        { id: 'c1b', name: "مقدمة في البرمجة", sectionName: "ب", department: "علوم حاسب", professorId: 'p2', hours: 3, labHours: 1, preferredTimes: ["الثلاثاء:08:00-09:40"], notes: "مادة أساسية" },
        { id: 'c2', name: "هياكل البيانات", sectionName: "أ", department: "علوم حاسب", professorId: 'p2', hours: 2, labHours: 0, preferredTimes: ["الثلاثاء:10:00-11:40"], notes: "" },
        { id: 'c3', name: "شبكات الحاسوب", sectionName: "أ", department: "هندسة برمجيات", professorId: 'p1', hours: 3, labHours: 0, preferredTimes: [], notes: "" },
        { id: 'c4', name: "قواعد البيانات", sectionName: "أ", department: "نظم معلومات", professorId: 'p3', hours: 3, labHours: 1, preferredTimes: [], notes: "" },
        { id: 'c5', name: "ذكاء اصطناعي", sectionName: "أ", department: "علوم حاسب", professorId: 'p2', hours: 2, labHours: 0, preferredTimes: [], notes: "" },
        { id: 'c6', name: "تحليل وتصميم نظم", sectionName: "أ", department: "نظم معلومات", professorId: 'p3', hours: 3, labHours: 0, preferredTimes: [], notes: "مشروع" },
        { id: 'c7', name: "الخوارزميات", sectionName: "أ", department: "هندسة برمجيات", professorId: 'p4', hours: 3, labHours: 0, preferredTimes: [], notes: "متقدمة" },
        { id: 'c8', name: "أمن المعلومات", sectionName: "أ", department: "أمن سيبراني", professorId: 'p4', hours: 2, labHours: 1, preferredTimes: [], notes: "عملي" },
    ];
    currentSchedule = [];
    schedules = [];
    // لا تقوم بتهيئة customTimeSlots هنا، دعها تُحمل من localStorage أو تستخدم الافتراضي
    // لا تقوم بتهيئة academicPeriod هنا، دعها تُحمل من localStorage أو تستخدم الافتراضي
    saveData();
    console.log("Dummy data initialized and saved.");
};

// ======================================================
// Conflict Validation
// ======================================================
/**
 * Checks for conflicts for a given appointment within a schedule.
 * @param {object} newAppointment - The appointment to check ({id, courseId, professorId, roomId, day, timeRange, ...})
 * @param {Array} schedule - The current schedule to check against
 * @returns {Array<string>} List of conflict messages
 */
const checkConflicts = (newAppointment, schedule) => {
    const conflicts = [];
    const professorsData = getProfessors();
    const roomsData = getRooms();

    const { id: newApptId, courseId, professorId, roomId, day, timeRange } = newAppointment;

    // Basic validation for essential fields
    if (!timeRange || !day || !professorId || !roomId) {
        conflicts.push("بيانات الموعد غير مكتملة (نطاق الوقت، اليوم، الدكتور، القاعة).");
        return conflicts;
    }

    const newApptTime = parseTimeRange(timeRange);
    if (!newApptTime) {
        conflicts.push(`نطاق الوقت '${timeRange}' غير صالح للموعد.`);
        return conflicts;
    }
    const { start: newStart, end: newEnd } = newApptTime;

    // Check professor availability and preferences
    const professor = professorsData.find(p => p.id === professorId);
    if (professor) {
        // Check if professor's preferred not-to-teach days
        if (professor.preferences?.noFriday && day === "الجمعة") {
            conflicts.push(`الدكتور ${professor.name} يفضل عدم التدريس يوم الجمعة.`);
        }
        if (professor.preferences?.noMonday && day === "الاثنين") { // Example for another preference
            conflicts.push(`الدكتور ${professor.name} يفضل عدم التدريس يوم الاثنين.`);
        }

        // Check professor's general available times
        const professorAvailableInSlot = professor.availableTimes.some(pt => {
            const [ptDay, ptRangeStr] = pt.split(':');
            const ptRange = parseTimeRange(ptRangeStr);

            if (!ptRange) return false; // Skip invalid available times

            return ptDay === day && !isTimeConflict(newStart, newEnd, ptRange.start, ptRange.end);
        });

        // Only add conflict if professor is NOT flexible AND not available
        if (!professorAvailableInSlot && !professor.preferences?.flexibleScheduling) {
            conflicts.push(`الدكتور ${professor.name} غير متاح في ${day} ${timeRange}.`);
        }
    } else {
        conflicts.push(`الدكتور بالمعرف ${professorId} غير موجود.`);
    }

    // Check room availability
    const room = roomsData.find(r => r.id === roomId);
    if (room) {
        const roomAvailableInSlot = room.availableTimes.some(rt => {
            const [rtDay, rtRangeStr] = rt.split(':');
            const rtRange = parseTimeRange(rtRangeStr);

            if (!rtRange) return false; // Skip invalid available times

            return rtDay === day && !isTimeConflict(newStart, newEnd, rtRange.start, rtRange.end);
        });
        if (!roomAvailableInSlot) {
            conflicts.push(`القاعة/المعمل ${room.name} غير متاح في ${day} ${timeRange}.`);
        }
    } else {
        conflicts.push(`القاعة/المعمل بالمعرف ${roomId} غير موجود.`);
    }

    // Check conflicts with other appointments in the schedule
    schedule.forEach(existingAppointment => {
        // Skip self-comparison for the same appointment (if it's being updated or is the original one in drag/drop)
        if (existingAppointment.id === newApptId) return;

        if (existingAppointment.day === day) {
            const existingApptTime = parseTimeRange(existingAppointment.timeRange);
            if (!existingApptTime) return; // Skip invalid existing appointments

            const { start: existingStart, end: existingEnd } = existingApptTime;

            // Professor conflict
            if (existingAppointment.professorId === professorId && isTimeConflict(newStart, newEnd, existingStart, existingEnd)) {
                conflicts.push(`تعارض وقت للدكتور ${professor?.name || professorId} بين "${newAppointment.courseName || newAppointment.courseId}" و "${existingAppointment.courseName || existingAppointment.courseId}" في ${day} ${existingAppointment.timeRange}.`);
            }

            // Room conflict
            if (existingAppointment.roomId === roomId && isTimeConflict(newStart, newEnd, existingStart, existingEnd)) {
                conflicts.push(`تعارض وقت للقاعة ${room?.name || roomId} بين "${newAppointment.courseName || newAppointment.courseId}" و "${existingAppointment.courseName || existingAppointment.courseId}" في ${day} ${existingAppointment.timeRange}.`);
            }
        }
    });

    return conflicts;
};

/**
 * Validates the entire schedule for any conflicts.
 * @param {Array} schedule - The schedule to validate
 * @returns {Array<string>} List of all conflict messages
 */
const validateFullSchedule = (schedule) => {
    const allConflicts = [];

    // Use a temporary copy to avoid modifying the original schedule
    const tempSchedule = JSON.parse(JSON.stringify(schedule));

    tempSchedule.forEach((appt1, index1) => {
        // Check conflicts for appt1 against all other appointments
        const conflictsForAppt1 = checkConflicts(appt1, tempSchedule.filter((_, idx) => idx !== index1));
        conflictsForAppt1.forEach(conflict => {
            allConflicts.push(`[موعد ${appt1.courseName || appt1.courseId}] ${conflict}`);
        });
    });
    return [...new Set(allConflicts)]; // Return unique conflict messages
};

// ======================================================
// Scheduling Algorithms (Enhanced)
// ======================================================

/**
 * Generates an automatic schedule based on current data.
 * @returns {{schedule: Array, unassignedCourses: Array, conflicts: Array}} Generated schedule and any issues
 */
const generateSchedule = () => {
    const professorsData = getProfessors();
    const roomsData = getRooms();
    const coursesData = getCourses();

    let newSchedule = [];
    let unassignedCourses = []; // To track courses that couldn't be fully scheduled

    if (professorsData.length === 0 || roomsData.length === 0 || coursesData.length === 0) {
        showAlert("الرجاء إدخال بيانات الدكاترة والقاعات والمواد أولاً لتوليد الجدول.", "warning");
        return { schedule: [], unassignedCourses: [], conflicts: [] };
    }

    // Prepare scheduling units based on course hours.
    // Each 100-minute slot is considered one scheduling unit.
    const schedulingUnits = [];
    coursesData.forEach(course => {
        const totalDurationMinutes = (course.hours * 60) + (course.labHours * 60);
        // Ensure at least one slot if hours > 0, otherwise 0 slots
        const numSlots = totalDurationMinutes > 0 ? Math.max(1, Math.ceil(totalDurationMinutes / 100)) : 0;

        for (let i = 0; i < numSlots; i++) {
            schedulingUnits.push({
                courseId: course.id,
                courseName: course.name,
                sectionName: course.sectionName,
                department: course.department, // إضافة القسم
                professorId: course.professorId,
                isLabSession: i < Math.ceil((course.labHours * 60) / 100), // Mark if this unit is specifically for lab
                preferredTimes: course.preferredTimes,
                notes: course.notes,
                originalCourseHours: course.hours,
                originalLabHours: course.labHours,
                unitIndex: i + 1
            });
        }
    });

    // Sort scheduling units for prioritization:
    // 1. Units with preferred times (harder to place)
    // 2. Lab sessions (fewer dedicated rooms)
    // 3. Courses with higher professor priority (assigned earlier)
    // 4. Group by department (conceptual - simplified for this implementation)
    schedulingUnits.sort((a, b) => {
        const profA = professorsData.find(p => p.id === a.professorId);
        const profB = professorsData.find(p => p.id === b.professorId);

        // Prioritize by department (conceptual: try to schedule one department block then another)
        // For full department-specific scheduling, this needs more complex grouping and iterative attempts.
        if (a.department && b.department && a.department !== b.department) {
            // Simple alphabetical sort for departments for consistency
            const departmentCompare = a.department.localeCompare(b.department);
            if (departmentCompare !== 0) return departmentCompare;
        }


        // Prioritize preferred times (units with preferred times come first)
        if (a.preferredTimes.length > 0 && b.preferredTimes.length === 0) return -1;
        if (a.preferredTimes.length === 0 && b.preferredTimes.length > 0) return 1;

        // Prioritize lab sessions (lab sessions come before non-lab)
        if (a.isLabSession && !b.isLabSession) return -1;
        if (!a.isLabSession && b.isLabSession) return 1;

        // Prioritize higher professor priority (lower number is higher priority)
        if (profA && profB) {
            return profA.priority - profB.priority;
        }
        return 0; // No change in order if priorities are same or profs not found
    });

    // Attempt to schedule each unit
    for (const unit of schedulingUnits) {
        let assigned = false;
        const professor = professorsData.find(p => p.id === unit.professorId);
        if (!professor) {
            unassignedCourses.push({ ...unit, reason: "الدكتور غير موجود للمادة." });
            continue;
        }

        let possibleSlots = [];
        // First, add preferred slots if any
        if (unit.preferredTimes && unit.preferredTimes.length > 0) {
            for (const prefTime of unit.preferredTimes) {
                const [day, timeRange] = prefTime.split(':');
                if (day && timeRange && DAYS.includes(day) && TIME_SLOTS.includes(timeRange)) {
                    possibleSlots.push({ day, timeRange, preferred: true });
                }
            }
        }
        // Then, add all other possible slots (if not already added as preferred)
        for (const day of DAYS) {
            // Respect professor's "not to teach" preferences
            if (professor.preferences?.noFriday && day === "الجمعة") continue;
            if (professor.preferences?.noMonday && day === "الاثنين") continue; // Example for another preference

            for (const timeRange of TIME_SLOTS) {
                if (!possibleSlots.some(s => s.day === day && s.timeRange === timeRange)) {
                    possibleSlots.push({ day, timeRange, preferred: false });
                }
            }
        }

        // Sort possible slots: preferred first, then earliest times
        possibleSlots.sort((a, b) => {
            if (a.preferred && !b.preferred) return -1;
            if (!a.preferred && b.preferred) return 1;
            return toMinutes(parseTimeRange(a.timeRange).start) - toMinutes(parseTimeRange(b.timeRange).start);
        });

        // Try to place the unit in the sorted possible slots
        for (const slot of possibleSlots) {
            const { day, timeRange } = slot;
            const { start: slotStart, end: slotEnd } = parseTimeRange(timeRange) || {}; // Handle null from parseTimeRange

            if (!slotStart || !slotEnd) { // Skip invalid time ranges
                console.warn(`Skipping invalid time slot: ${timeRange}`);
                continue;
            }

            let suitableRooms = roomsData.filter(r =>
                (unit.isLabSession ? r.type === "lab" : r.type === "lecture") && // Match room type (lab/lecture)
                r.availableTimes.some(rt => { // Check room's general available times
                    const [rtDay, rtRangeStr] = rt.split(':');
                    const rtRange = parseTimeRange(rtRangeStr);

                    if (!rtRange) return false; // Skip invalid room available times

                    return rtDay === day && !isTimeConflict(slotStart, slotEnd, rtRange.start, rtRange.end);
                })
            );

            // Prioritize rooms based on location group to reduce professor travel
            suitableRooms.sort((a, b) => {
                const lastApptForProf = newSchedule.slice().reverse().find(appt => appt.professorId === professor.id && appt.day === day);
                const lastApptRoom = lastApptForProf ? roomsData.find(r => r.id === lastApptForProf.roomId) : null;

                if (lastApptRoom && a.locationGroup && b.locationGroup) {
                    const aMatchesLast = a.locationGroup === lastApptRoom.locationGroup;
                    const bMatchesLast = b.locationGroup === lastApptRoom.locationGroup;
                    if (aMatchesLast && !bMatchesLast) return -1;
                    if (!aMatchesLast && bMatchesLast) return 1;
                }
                return 0.5 - Math.random(); // Randomize otherwise for scenario diversity
            });

            for (const room of suitableRooms) {
                const potentialAppointment = {
                    id: generateUniqueId(),
                    courseId: unit.courseId,
                    courseName: unit.courseName,
                    sectionName: unit.sectionName,
                    department: unit.department, // إضافة القسم
                    professorId: professor.id,
                    professorName: professor.name,
                    roomId: room.id,
                    roomName: room.name,
                    type: unit.isLabSession ? "lab" : "lecture",
                    day: day,
                    timeRange: timeRange,
                    notes: unit.notes
                };

                const conflicts = checkConflicts(potentialAppointment, newSchedule);
                if (conflicts.length === 0) {
                    newSchedule.push(potentialAppointment);
                    assigned = true;
                    break;
                }
            }
            if (assigned) break;
        }

        if (!assigned) {
            unassignedCourses.push({
                ...unit,
                reason: `لم يتم العثور على وقت/قاعة مناسبة لوحدة المادة: ${unit.courseName} (دكتور: ${professor.name})`
            });
        }
    }

    // Sort final schedule for consistent display (by day, then by time)
    newSchedule.sort((a, b) => {
        const dayOrder = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
        if (dayOrder !== 0) return dayOrder;
        const timeA = parseTimeRange(a.timeRange);
        const timeB = parseTimeRange(b.timeRange);
        if (!timeA || !timeB) return 0;
        return toMinutes(timeA.start) - toMinutes(timeB.start);
    });

    setCurrentSchedule(newSchedule);
    console.log("Generated Schedule:", newSchedule);
    const fullScheduleConflicts = validateFullSchedule(newSchedule);
    return { schedule: newSchedule, unassignedCourses: unassignedCourses, conflicts: fullScheduleConflicts };
};

/**
 * يحاول تحسين الجدول الحالي بتقليل الفجوات في جداول الدكاترة. (ميزة مبسطة)
 * هذه خوارزمية غير شاملة وليست مثالية، لكنها خطوة أولى نحو التحسين.
 */
const optimizeScheduleForGaps = () => {
    showAlert('جاري محاولة تحسين الجدول لتقليل الفجوات...', 'info');
    let schedule = getCurrentSchedule();
    let professorsData = getProfessors();
    let changesMade = false;

    let tempSchedule = JSON.parse(JSON.stringify(schedule)); // استخدم نسخة للعمل عليها

    const profDailySchedule = {};
    professorsData.forEach(prof => {
        profDailySchedule[prof.id] = {};
        DAYS.forEach(day => {
            profDailySchedule[prof.id][day] = [];
        });
    });

    tempSchedule.forEach(appt => {
        if (profDailySchedule[appt.professorId] && profDailySchedule[appt.professorId][appt.day]) {
            profDailySchedule[appt.professorId][appt.day].push(appt);
        }
    });

    for (const profId in profDailySchedule) {
        for (const day of DAYS) {
            let appointments = profDailySchedule[profId][day].sort((a, b) => {
                const timeA = parseTimeRange(a.timeRange);
                const timeB = parseTimeRange(b.timeRange);
                if (!timeA || !timeB) return 0;
                return toMinutes(timeA.start) - toMinutes(timeB.start);
            });

            if (appointments.length > 1) {
                for (let i = 0; i < appointments.length; i++) {
                    const currentAppt = appointments[i];
                    const currentTimeSlotIndex = TIME_SLOTS.indexOf(currentAppt.timeRange);

                    for (let j = 0; j < currentTimeSlotIndex; j++) {
                        const potentialNewTimeRange = TIME_SLOTS[j];
                        const potentialNewTimeSlot = parseTimeRange(potentialNewTimeRange);

                        if (!potentialNewTimeSlot) continue;

                        const potentialAppt = {
                            ...currentAppt,
                            day: day,
                            timeRange: potentialNewTimeRange
                        };

                        const conflicts = checkConflicts(potentialAppt, tempSchedule.filter(a => a.id !== currentAppt.id));

                        if (conflicts.length === 0 && potentialNewTimeRange !== currentAppt.timeRange) {
                            const originalIndexInTemp = tempSchedule.findIndex(a => a.id === currentAppt.id);
                            if (originalIndexInTemp > -1) {
                                tempSchedule[originalIndexInTemp] = potentialAppt;
                                changesMade = true;
                                appointments[i] = potentialAppt;
                                appointments.sort((a, b) => toMinutes(parseTimeRange(a.timeRange).start) - toMinutes(parseTimeRange(b.timeRange).start));
                                showAlert(`تم تحسين موعد ${currentAppt.courseName} للدكتور ${currentAppt.professorName} في ${day} إلى ${potentialNewTimeRange}.`, 'info');
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    if (changesMade) {
        setCurrentSchedule(tempSchedule);
        renderScheduleGrid();
        showAlert('تمت محاولة تحسين الجدول بنجاح!', 'success');
    } else {
        showAlert('لم يتم العثور على تحسينات لتقليل الفجوات في الجدول الحالي.', 'info');
    }
};

/**
 * يحاول إصلاح جميع التعارضات في الجدول الحالي تلقائيًا. (ميزة مبسطة - قد لا تحل جميع التعارضات)
 * يعتمد على تكرار محاولات نقل المواعيد المتعارضة إلى أوقات بديلة.
 */
const fixAllConflictsAutomatically = () => {
    showAlert('جاري محاولة إصلاح جميع التعارضات تلقائيًا...', 'info');
    let schedule = getCurrentSchedule();
    let conflictsResolvedCount = 0;
    const maxIterations = 5; // عدد المحاولات لتجنب الحلقات اللانهائية

    for (let iter = 0; iter < maxIterations; iter++) {
        let initialConflicts = validateFullSchedule(schedule);
        if (initialConflicts.length === 0) {
            break; // لا توجد تعارضات، انتهينا
        }

        let changesMadeInIteration = false;
        let tempScheduleCopy = [...schedule]; // نعمل على نسخة مؤقتة

        for (const conflictMsg of initialConflicts) {
            // محاولة استخراج معرف الموعد المتعارض
            const courseMatch = conflictMsg.match(/\[موعد ([^\]]+)\]/);
            if (!courseMatch || !courseMatch[1]) continue;

            const conflictingCourseIdOrName = courseMatch[1];
            // البحث عن الموعد المتعارض في الجدول
            const conflictingAppt = tempScheduleCopy.find(appt =>
                appt.courseName === conflictingCourseIdOrName || appt.courseId === conflictingCourseIdOrName
            );

            if (conflictingAppt) {
                // إزالة الموعد المتعارض مؤقتًا من الجدول للبحث عن بدائل له
                const scheduleWithoutConflictingAppt = tempScheduleCopy.filter(a => a.id !== conflictingAppt.id);
                const suggestions = suggestAlternativeTimes(conflictingAppt);

                if (suggestions.length > 0) {
                    // اختيار أول اقتراح كحل (يمكن تحسين هذا لاختيار أفضل اقتراح)
                    const chosenSuggestion = suggestions[0];
                    const updatedAppt = {
                        ...conflictingAppt,
                        day: chosenSuggestion.day,
                        timeRange: chosenSuggestion.timeRange
                    };

                    // التحقق مرة أخرى لتجنب إنشاء تعارضات جديدة
                    const newConflicts = checkConflicts(updatedAppt, scheduleWithoutConflictingAppt);
                    if (newConflicts.length === 0) {
                        tempScheduleCopy = [...scheduleWithoutConflictingAppt, updatedAppt];
                        changesMadeInIteration = true;
                        conflictsResolvedCount++;
                        showAlert(`تم إصلاح تعارض لـ ${conflictingAppt.courseName} بنقله إلى ${chosenSuggestion.day} ${chosenSuggestion.timeRange}.`, 'info');
                    }
                }
            }
        }
        schedule = tempScheduleCopy; // تحديث الجدول ليتضمن التغييرات
        if (!changesMadeInIteration) {
            break; // لم يتم إجراء أي تغييرات في هذه الجولة، قد نكون عالقين أو لا يمكن حل المزيد
        }
    }

    setCurrentSchedule(schedule);
    renderScheduleGrid();
    const finalConflicts = validateFullSchedule(schedule);

    if (finalConflicts.length === 0) {
        showAlert('تم إصلاح جميع التعارضات بنجاح!', 'success');
    } else {
        showAlert(`تم إصلاح ${conflictsResolvedCount} تعارضات. لا يزال هناك ${finalConflicts.length} تعارضات متبقية لم يتم حلها تلقائيًا.`, 'warning');
    }
};



/**
 * Evaluates the quality of a given schedule based on various criteria.
 * @param {Array} schedule - The schedule to evaluate
 * @returns {{score: number, details: object}} Evaluation score and details
 */
const evaluateSchedule = (schedule) => {
    let score = 100;
    const evaluationDetails = {};
    const professorsData = getProfessors();
    const roomsData = getRooms();

    // 1. Professor teaching days: Penalize for spreading teaching over too many days
    const professorDays = {};
    schedule.forEach(appt => {
        if (!professorDays[appt.professorId]) professorDays[appt.professorId] = new Set();
        professorDays[appt.professorId].add(appt.day);
    });

    for (const profId in professorDays) {
        const profName = professorsData.find(p => p.id === profId)?.name || 'غير معروف';
        const numDays = professorDays[profId].size;
        evaluationDetails[`أيام تدريس ${profName}`] = `${numDays} أيام`;
        if (numDays > 3) { // Ideal is 2-3 days
            score -= (numDays - 3) * 5;
        }
    }

    // 2. Gaps between lectures for the same professor on the same day: Penalize long breaks
    const profDailySchedule = {};
    schedule.forEach(appt => {
        if (!profDailySchedule[appt.professorId]) profDailySchedule[appt.professorId] = {};
        if (!profDailySchedule[appt.professorId][appt.day]) profDailySchedule[appt.professorId][appt.day] = [];
        profDailySchedule[appt.professorId][appt.day].push(appt);
    });

    for (const profId in profDailySchedule) {
        for (const day in profDailySchedule[profId]) {
            const appointments = profDailySchedule[profId][day].sort((a, b) => {
                const timeA = parseTimeRange(a.timeRange);
                const timeB = parseTimeRange(b.timeRange);
                if (!timeA || !timeB) return 0;
                return toMinutes(timeA.start) - toMinutes(timeB.start);
            });

            for (let i = 0; i < appointments.length - 1; i++) {
                const appt1Time = parseTimeRange(appointments[i].timeRange);
                const appt2Time = parseTimeRange(appointments[i + 1].timeRange);
                if (!appt1Time || !appt2Time) continue;

                const end1Minutes = toMinutes(appt1Time.end);
                const start2Minutes = toMinutes(appt2Time.start);
                const gap = start2Minutes - end1Minutes;

                if (gap > 60 && gap < 180) { // 1 to 3 hours gap
                    score -= 2;
                    evaluationDetails[`فجوات متوسطة للدكتور ${appointments[i].professorName} في ${day}`] = (evaluationDetails[`فجوات متوسطة للدكتور ${appointments[i].professorName} في ${day}`] || 0) + 1;
                } else if (gap >= 180) { // 3+ hours gap
                    score -= 5;
                    evaluationDetails[`فجوات كبيرة للدكتور ${appointments[i].professorName} في ${day}`] = (evaluationDetails[`فجوات كبيرة للدكتور ${appointments[i].professorName} في ${day}`] || 0) + 1;
                }
            }
        }
    }

    // 3. Room utilization/occupancy: Penalize under/over-utilized rooms
    const roomUsage = {};
    const totalPossibleSlotsPerRoom = DAYS.length * TIME_SLOTS.length; // Total slots available in a week
    roomsData.forEach(room => roomUsage[room.id] = { count: 0, name: room.name, totalSlots: totalPossibleSlotsPerRoom });

    schedule.forEach(appt => {
        if (roomUsage[appt.roomId]) {
            roomUsage[appt.roomId].count++;
        }
    });

    for (const roomId in roomUsage) {
        const usagePercentage = (roomUsage[roomId].count / roomUsage[roomId].totalSlots) * 100;
        evaluationDetails[`إشغال ${roomUsage[roomId].name}`] = `${usagePercentage.toFixed(1)}%`;
        if (usagePercentage < 15) { // Penalize heavily for under-utilized rooms
            score -= 5;
        } else if (usagePercentage > 85) { // Penalize for over-utilized rooms
            score -= 3;
        }
    }

    // 4. Lab distribution: Penalize if labs are heavily concentrated on few days
    const labUsageByDay = {};
    schedule.forEach(appt => {
        if (appt.type === "lab") {
            if (!labUsageByDay[appt.day]) labUsageByDay[appt.day] = 0;
            labUsageByDay[appt.day]++;
        }
    });

    let maxLabsInDay = 0;
    for (const day in labUsageByDay) {
        maxLabsInDay = Math.max(maxLabsInDay, labUsageByDay[day]);
    }
    evaluationDetails[`أقصى عدد معامل في يوم واحد`] = maxLabsInDay;
    if (maxLabsInDay > 4) { // If too many labs on one day
        score -= (maxLabsInDay - 4) * 3;
    }

    // 5. Reduce room switching for professors: Penalize frequent changes in locationGroup
    const professorDailyRoomChanges = {};
    professorsData.forEach(prof => professorDailyRoomChanges[prof.id] = {});

    schedule.forEach(appt => {
        const profId = appt.professorId;
        const day = appt.day;
        const room = roomsData.find(r => r.id === appt.roomId);
        if (room && room.locationGroup) {
            if (!professorDailyRoomChanges[profId][day]) {
                professorDailyRoomChanges[profId][day] = new Set();
            }
            professorDailyRoomChanges[profId][day].add(room.locationGroup);
        }
    });

    let totalRoomSwitches = 0;
    for (const profId in professorDailyRoomChanges) {
        const profName = professorsData.find(p => p.id === profId)?.name || 'غير معروف';
        for (const day in professorDailyRoomChanges[profId]) {
            const uniqueLocations = professorDailyRoomChanges[profId][day].size;
            if (uniqueLocations > 1) { // More than one distinct location means switching
                totalRoomSwitches += (uniqueLocations - 1); // Each switch after the first location costs points
                evaluationDetails[`تنقل د. ${profName} في ${day}`] = `${uniqueLocations} مواقع`;
            }
        }
    }
    evaluationDetails[`إجمالي مرات تنقل الدكاترة بين المباني`] = totalRoomSwitches;
    score -= totalRoomSwitches * 2; // Penalize each room switch

    // 6. Balance course load per day: Penalize uneven distribution of slots across days
    const dailySlotCount = {};
    DAYS.forEach(day => dailySlotCount[day] = 0);
    schedule.forEach(appt => dailySlotCount[appt.day]++);

    const sortedDayLoads = Object.values(dailySlotCount).sort((a,b) => a - b);
    if (sortedDayLoads.length > 0) {
        const minLoad = sortedDayLoads[0];
        const maxLoad = sortedDayLoads[sortedDayLoads.length - 1];
        const loadDifference = maxLoad - minLoad;
        evaluationDetails[`توازن توزيع الحصص اليومي (الفرق بين الأعلى والأقل)`] = loadDifference;
        score -= loadDifference * 1; // Minor penalty for imbalance
    }


    // 7. Final conflicts (major penalty)
    const conflicts = validateFullSchedule(schedule);
    if (conflicts.length > 0) {
        score -= conflicts.length * 20; // Heavier penalty for unresolved conflicts
        evaluationDetails['تعارضات'] = conflicts.length;
        evaluationDetails['تفاصيل التعارضات'] = conflicts;
    }

    score = Math.max(0, score); // Score cannot go below 0
    return { score: Math.round(score), details: evaluationDetails };
};

/**
 * Generates multiple schedule scenarios and evaluates them.
 * @param {number} numScenarios - Number of scenarios to generate
 * @returns {Array<Object>} List of scenarios with their schedules and evaluations
 */
const generateMultipleScenarios = (numScenarios = 3) => {
    const scenarios = [];
    for (let i = 0; i < numScenarios; i++) {
        console.log(`Generating scenario ${i + 1}...`);
        const { schedule, unassignedCourses, conflicts } = generateSchedule();
        const evaluation = evaluateSchedule(schedule);
        scenarios.push({
            id: `scenario-${i + 1}`,
            name: `سيناريو ${i + 1}`,
            schedule: schedule,
            evaluation: evaluation,
            unassignedCourses: unassignedCourses,
            conflicts: conflicts
        });
    }
    scenarios.sort((a, b) => b.evaluation.score - a.evaluation.score); // Sort by score descending
    return scenarios;
};

/**
 * Suggests alternative times for a problematic appointment based on current schedule constraints.
 * @param {object} problematicAppointment - The appointment that has a conflict
 * @returns {Array<object>} List of suggested alternative slots
 */
const suggestAlternativeTimes = (problematicAppointment) => {
    const professorsData = getProfessors();
    const roomsData = getRooms();
    const coursesData = getCourses();
    // Create a copy of the current schedule and remove the problematic appointment
    // to check for conflicts as if it were moved.
    const tempSchedule = [...getCurrentSchedule()].filter(appt => appt.id !== problematicAppointment.id);

    const course = coursesData.find(c => c.id === problematicAppointment.courseId);
    const professor = professorsData.find(p => p.id === problematicAppointment.professorId);
    const problematicRoom = roomsData.find(r => r.id === problematicAppointment.roomId);

    const suggestions = [];

    for (const day of DAYS) {
        // Respect professor's "not to teach" preferences
        if (professor?.preferences?.noFriday && day === "الجمعة") continue;
        if (professor?.preferences?.noMonday && day === "الاثنين") continue; // Example for another preference

        for (const timeRange of TIME_SLOTS) {
            const newApptTime = parseTimeRange(timeRange);
            if (!newApptTime) continue; // Skip invalid time ranges
            const { start: slotStart, end: slotEnd } = newApptTime;

            // Check if professor is available in this new slot
            let professorAvailable = professor?.availableTimes.some(pt => {
                const [ptDay, ptRangeStr] = pt.split(':');
                const ptRange = parseTimeRange(ptRangeStr);
                if (!ptRange) return false;
                return ptDay === day && !isTimeConflict(slotStart, slotEnd, ptRange.start, ptRange.end);
            }) || false;

            // Check if room is available in this new slot
            let roomAvailable = problematicRoom?.availableTimes.some(rt => {
                const [rtDay, rtRangeStr] = rt.split(':');
                const rtRange = parseTimeRange(rtRangeStr);
                if (!rtRange) return false;
                return rtDay === day && !isTimeConflict(slotStart, slotEnd, rtRange.start, rtRange.end);
            }) || false;

            // Create a potential appointment object for conflict checking
            const potentialAppointment = {
                id: generateUniqueId(), // Use a temporary ID for checking
                courseId: problematicAppointment.courseId,
                courseName: problematicAppointment.courseName,
                sectionName: problematicAppointment.sectionName,
                department: problematicAppointment.department, // إضافة القسم
                professorId: problematicAppointment.professorId,
                professorName: problematicAppointment.professorName,
                roomId: problematicRoom ? problematicRoom.id : null,
                roomName: problematicRoom ? problematicRoom.name : 'غير معروفة',
                type: course?.labHours > 0 ? "lab" : "lecture",
                day: day,
                timeRange: timeRange,
                notes: problematicAppointment.notes
            };

            // Check for conflicts with other appointments in the temporary schedule
            const conflicts = checkConflicts(potentialAppointment, tempSchedule);

            // If no conflicts and both professor and room are generally available, it's a valid suggestion
            if (professorAvailable && roomAvailable && conflicts.length === 0) {
                suggestions.push({
                    day: day,
                    timeRange: timeRange,
                    room: problematicRoom?.name || 'نفس القاعة', // Could suggest other rooms if applicable
                    reason: "لا يوجد تعارض"
                });
            }
        }
    }
    return suggestions;
};


// ======================================================
// UI Management
// ======================================================

// DOM Elements (Selected for direct use, others can be accessed as needed)
const mainContent = document.querySelector('main');
const navLinks = document.querySelectorAll('nav ul li a');
const scheduleGrid = document.getElementById('schedule-grid');
const conflictAlertsDiv = document.getElementById('conflict-alerts');

const professorForm = document.getElementById('professor-form');
const roomForm = document.getElementById('room-form');
const courseForm = document.getElementById('course-form');

const professorListDiv = document.getElementById('professor-list');
const roomListDiv = document.getElementById('room-list');
const courseListDiv = document.getElementById('course-list');

const uploadProfessorsInput = document.getElementById('upload-professors');
const uploadRoomsInput = document.getElementById('upload-rooms');
const uploadCoursesInput = document.getElementById('upload-courses');

const generateScheduleBtn = document.getElementById('generate-schedule');
const saveCurrentScheduleBtn = document.getElementById('save-current-schedule');
const loadSavedSchedulesBtn = document.getElementById('load-saved-schedules');
const fixAllConflictsBtn = document.getElementById('fix-all-conflicts-btn'); // زر جديد

const reportsSection = document.getElementById('reports');
const professorSchedulesSection = document.getElementById('professor-schedules');

const exportPdfBtn = document.getElementById('export-pdf');
const exportExcelBtn = document.getElementById('export-excel');
const exportImageBtn = document.getElementById('export-image');

// Modal Elements
const editAppointmentModal = document.getElementById('edit-appointment-modal');
const closeButton = editAppointmentModal ? editAppointmentModal.querySelector('.close-button') : null;
const editAppointmentForm = document.getElementById('edit-appointment-form');
const deleteApptBtn = document.getElementById('delete-appt-btn');

const editApptOriginalId = document.getElementById('edit-appt-original-id');
const editApptCourseName = document.getElementById('edit-appt-course-name');
const editApptProfessorId = document.getElementById('edit-appt-professor-id');
const editApptRoomId = document.getElementById('edit-appt-room-id');
const editApptDay = document.getElementById('edit-appt-day');
const editApptTimeRange = document.getElementById('edit-appt-time-range');
const editApptNotes = document.getElementById('edit-appt-notes');

const globalSearchInput = document.getElementById('global-search');

// عناصر الفترات الزمنية المخصصة
const customTimeSlotsTextArea = document.getElementById('custom-time-slots');
const timeSlotsForm = document.getElementById('time-slots-form');

// عناصر الفترة الأكاديمية
const academicPeriodForm = document.getElementById('academic-period-form');
const currentAcademicYearInput = document.getElementById('current-academic-year');
const currentAcademicSemesterInput = document.getElementById('current-academic-semester');

// عناصر الـ datalist للاقتراحات الذكية
const profNamesSuggestions = document.getElementById('prof-names-suggestions');
const roomNamesSuggestions = document.getElementById('room-names-suggestions');
const courseNamesSuggestions = document.getElementById('course-names-suggestions');
const departmentSuggestions = document.getElementById('department-suggestions');


// UI Helpers
/**
 * Shows a specific section of the page and updates navigation.
 * @param {string} sectionId - The ID of the section to show
 */
const showSection = (sectionId) => {
    document.querySelectorAll('section').forEach(section => {
        section.classList.remove('active-section');
    });
    document.getElementById(sectionId)?.classList.add('active-section'); // Use optional chaining for safety

    navLinks.forEach(link => {
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Re-render content specific to the activated section
    if (sectionId === 'schedule-view') {
        renderScheduleGrid();
    } else if (sectionId === 'data-entry') {
        renderDataEntryForms();
        const currentSearchTerm = globalSearchInput ? globalSearchInput.value : '';
        renderProfessorList(currentSearchTerm);
        renderRoomList(currentSearchTerm);
        renderCourseList(currentSearchTerm);
        populateDatalists(); // تحديث اقتراحات الإدخال اليدوي
    } else if (sectionId === 'reports') {
        renderReports();
    } else if (sectionId === 'professor-schedules') {
        renderProfessorSchedules();
    } else if (sectionId === 'settings') {
        // تحديث واجهة إعدادات الفترات الزمنية
        if (customTimeSlotsTextArea) {
            customTimeSlotsTextArea.value = TIME_SLOTS.join('\n');
        }
        // تحديث واجهة إعدادات الفترة الأكاديمية
        if (currentAcademicYearInput) {
            currentAcademicYearInput.value = academicPeriod.year;
        }
        if (currentAcademicSemesterInput) {
            currentAcademicSemesterInput.value = academicPeriod.semester;
        }
    }
};

/**
 * Displays an alert message to the user.
 * @param {string} message - The message to display
 * @param {'danger' | 'success' | 'info' | 'warning'} type - The type of alert for styling
 */
const showAlert = (message, type = 'danger') => {
    if (!conflictAlertsDiv) return;
    conflictAlertsDiv.innerHTML = message;
    conflictAlertsDiv.className = `alert alert-${type}`;
    conflictAlertsDiv.style.display = 'block';
    if (window.alertTimeout) clearTimeout(window.alertTimeout);
    window.alertTimeout = setTimeout(() => {
        conflictAlertsDiv.style.display = 'none';
    }, 8000); // Hide after 8 seconds
};

// Data Entry Rendering
const renderDataEntryForms = () => {
    const professorsData = getProfessors();
    const courseProfessorSelect = document.getElementById('course-professor-id');
    if (courseProfessorSelect) {
        courseProfessorSelect.innerHTML = '<option value="">اختر دكتور</option>';
        professorsData.forEach(prof => {
            const option = document.createElement('option');
            option.value = prof.id;
            option.textContent = prof.name;
            courseProfessorSelect.appendChild(option);
        });
    }
};

const populateDatalists = () => {
    // اقتراحات أسماء الدكاترة
    if (profNamesSuggestions) {
        profNamesSuggestions.innerHTML = getProfessors().map(prof => `<option value="${prof.name}">`).join('');
    }
    // اقتراحات أسماء القاعات
    if (roomNamesSuggestions) {
        roomNamesSuggestions.innerHTML = getRooms().map(room => `<option value="${room.name}">`).join('');
    }
    // اقتراحات أسماء المواد
    if (courseNamesSuggestions) {
        courseNamesSuggestions.innerHTML = getCourses().map(course => `<option value="${course.name}">`).join('');
    }
    // اقتراحات أسماء الأقسام
    if (departmentSuggestions) {
        const uniqueDepartments = [...new Set(getCourses().map(course => course.department).filter(dep => dep))];
        departmentSuggestions.innerHTML = uniqueDepartments.map(dep => `<option value="${dep}">`).join('');
    }
};


const renderProfessorList = (searchTerm = '') => { // إضافة searchTerm
    const professorsData = getProfessors();
    if (!professorListDiv) return;

    professorListDiv.innerHTML = '<h3>قائمة الدكاترة</h3>';
    if (professorsData.length === 0) {
        professorListDiv.innerHTML += '<p class="text-secondary">لا يوجد دكاترة بعد. استخدم النموذج أعلاه لإضافة دكتور.</p>';
        return;
    }
    const ul = document.createElement('ul');
    const lowerCaseSearchTerm = searchTerm.toLowerCase(); // تحويل كلمة البحث لحالة صغيرة

    // تصفية البيانات بناءً على كلمة البحث
    const filteredProfessors = professorsData.filter(prof =>
        prof.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        prof.availableTimes.some(time => time.toLowerCase().includes(lowerCaseSearchTerm))
    );

    if (filteredProfessors.length === 0 && searchTerm !== '') {
        ul.innerHTML = '<p class="text-secondary">لا توجد نتائج بحث مطابقة.</p>';
    } else {
        filteredProfessors.forEach(prof => { // استخدام البيانات المصفاة
            const li = document.createElement('li');
            const availableTimesFormatted = prof.availableTimes.length > 0 ? prof.availableTimes.join(', ') : 'لا يوجد';
            const preferencesText = [];
            if (prof.preferences?.noFriday) preferencesText.push('لا جمعة');
            if (prof.preferences?.noMonday) preferencesText.push('لا اثنين');
            const preferencesDisplay = preferencesText.length > 0 ? ` (${preferencesText.join(', ')})` : '';

            li.innerHTML = `
                <div>
                    <strong>${prof.name}</strong> (أولوية: ${prof.priority})${preferencesDisplay}<br>
                    <span>الأوقات المتاحة: ${availableTimesFormatted}</span>
                </div>
                <div>
                    <button class="edit-btn" data-id="${prof.id}" data-type="professor"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="delete-btn" data-id="${prof.id}" data-type="professor"><i class="fas fa-trash-alt"></i> حذف</button>
                </div>
            `;
            ul.appendChild(li);
        });
    }
    professorListDiv.appendChild(ul);
};

const renderRoomList = (searchTerm = '') => { // إضافة searchTerm
    const roomsData = getRooms();
    if (!roomListDiv) return;

    roomListDiv.innerHTML = '<h3>قائمة القاعات والمعامل</h3>';
    if (roomsData.length === 0) {
        roomListDiv.innerHTML += '<p class="text-secondary">لا توجد قاعات بعد. استخدم النموذج أعلاه لإضافة قاعة/معمل.</p>';
        return;
    }
    const ul = document.createElement('ul');
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    // تصفية البيانات
    const filteredRooms = roomsData.filter(room =>
        room.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        room.type.toLowerCase().includes(lowerCaseSearchTerm) ||
        (room.locationGroup && room.locationGroup.toLowerCase().includes(lowerCaseSearchTerm)) ||
        room.availableTimes.some(time => time.toLowerCase().includes(lowerCaseSearchTerm))
    );

    if (filteredRooms.length === 0 && searchTerm !== '') {
        ul.innerHTML = '<p class="text-secondary">لا توجد نتائج بحث مطابقة.</p>';
    } else {
        filteredRooms.forEach(room => { // استخدام البيانات المصفاة
            const li = document.createElement('li');
            const availableTimesFormatted = room.availableTimes.length > 0 ? room.availableTimes.join(', ') : 'لا يوجد';
            const locationGroupText = room.locationGroup ? ` (موقع: ${room.locationGroup})` : '';
            li.innerHTML = `
                <div>
                    <strong>${room.name}</strong> (${room.type === 'lecture' ? 'قاعة' : 'معمل'})${locationGroupText}<br>
                    <span>الأوقات المتاحة: ${availableTimesFormatted}</span>
                </div>
                <div>
                    <button class="edit-btn" data-id="${room.id}" data-type="room"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="delete-btn" data-id="${room.id}" data-type="room"><i class="fas fa-trash-alt"></i> حذف</button>
                </div>
            `;
            ul.appendChild(li);
        });
    }
    roomListDiv.appendChild(ul);
};

const renderCourseList = (searchTerm = '') => { // إضافة searchTerm
    const coursesData = getCourses();
    const professorsData = getProfessors();
    if (!courseListDiv) return;

    courseListDiv.innerHTML = '<h3>قائمة المواد</h3>';
    if (coursesData.length === 0) {
        courseListDiv.innerHTML += '<p class="text-secondary">لا توجد مواد بعد. استخدم النموذج أعلاه لإضافة مادة.</p>';
        return;
    }
    const ul = document.createElement('ul');
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    // تصفية البيانات
    const filteredCourses = coursesData.filter(course => {
        const profName = professorsData.find(p => p.id === course.professorId)?.name || 'غير محدد';
        return course.name.toLowerCase().includes(lowerCaseSearchTerm) ||
               (course.sectionName && course.sectionName.toLowerCase().includes(lowerCaseSearchTerm)) || // البحث باسم الشعبة
               (course.department && course.department.toLowerCase().includes(lowerCaseSearchTerm)) || // البحث باسم القسم
               profName.toLowerCase().includes(lowerCaseSearchTerm) ||
               (course.notes && course.notes.toLowerCase().includes(lowerCaseSearchTerm)) ||
               course.preferredTimes.some(time => time.toLowerCase().includes(lowerCaseSearchTerm));
    });


    if (filteredCourses.length === 0 && searchTerm !== '') {
        ul.innerHTML = '<p class="text-secondary">لا توجد نتائج بحث مطابقة.</p>';
    } else {
        filteredCourses.forEach(course => { // استخدام البيانات المصفاة
            const profName = professorsData.find(p => p.id === course.professorId)?.name || 'غير محدد';
            const preferredTimesText = course.preferredTimes.length > 0 ? `(مفضلة: ${course.preferredTimes.join(', ')})` : '';
            const sectionDisplay = course.sectionName ? ` (شعبة: ${course.sectionName})` : ''; // عرض الشعبة
            const departmentDisplay = course.department ? ` (قسم: ${course.department})` : ''; // عرض القسم
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>${course.name}${sectionDisplay}</strong> ${departmentDisplay} (دكتور: ${profName})<br>
                    <span>ساعات: ${course.hours} نظري, ${course.labHours} عملي ${preferredTimesText}</span><br>
                    <span>ملاحظات: ${course.notes || '-'}</span>
                </div>
                <div>
                    <button class="edit-btn" data-id="${course.id}" data-type="course"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="delete-btn" data-id="${course.id}" data-type="course"><i class="fas fa-trash-alt"></i> حذف</button>
                </div>
            `;
            ul.appendChild(li);
        });
    }
    courseListDiv.appendChild(ul);
};

// Modal functions for appointment editing
const openEditModal = (appointmentData) => {
    if (!editAppointmentModal) return;

    // Populate modal fields with appointment data
    editApptOriginalId.value = appointmentData.id;
    editApptCourseName.value = `${appointmentData.courseName || `مادة ${appointmentData.courseId}`} ${appointmentData.sectionName ? '(' + appointmentData.sectionName + ')' : ''}`;
    editApptNotes.value = appointmentData.notes || '';

    // Populate Professor Select
    editApptProfessorId.innerHTML = '';
    getProfessors().forEach(prof => {
        const option = document.createElement('option');
        option.value = prof.id;
        option.textContent = prof.name;
        if (prof.id === appointmentData.professorId) {
            option.selected = true;
        }
        editApptProfessorId.appendChild(option);
    });

    // Populate Room Select
    editApptRoomId.innerHTML = '';
    getRooms().forEach(room => {
        const option = document.createElement('option');
        option.value = room.id;
        option.textContent = room.name;
        if (room.id === appointmentData.roomId) {
            option.selected = true;
        }
        editApptRoomId.appendChild(option);
    });

    // Populate Day Select
    editApptDay.innerHTML = '';
    DAYS.forEach(day => {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = day;
        if (day === appointmentData.day) {
            option.selected = true;
        }
        editApptDay.appendChild(option);
    });

    // Populate Time Range Select
    editApptTimeRange.innerHTML = '';
    TIME_SLOTS.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot;
        option.textContent = slot;
        if (slot === appointmentData.timeRange) {
            option.selected = true;
        }
        editApptTimeRange.appendChild(option);
    });

    editAppointmentModal.style.display = 'block';
};

const closeEditModal = () => {
    if (editAppointmentModal) {
        editAppointmentModal.style.display = 'none';
    }
};


// Schedule Grid Rendering (Drag & Drop)
let draggedItem = null; // The DOM element being dragged
let draggedAppointmentId = null; // The unique ID of the appointment data

/**
 * Renders the interactive schedule grid.
 */
const renderScheduleGrid = () => {
    const currentScheduleData = getCurrentSchedule();
    const professorsData = getProfessors();
    const roomsData = getRooms();

    if (!scheduleGrid) return;
    scheduleGrid.innerHTML = ''; // Clear previous content

    // Set up CSS Grid columns based on days
    scheduleGrid.style.gridTemplateColumns = `minmax(120px, 1fr) repeat(${DAYS.length}, 1fr)`;

    // Create empty top-left header cell
    scheduleGrid.appendChild(createGridHeaderCell(''));

    // Create day headers
    DAYS.forEach(day => {
        scheduleGrid.appendChild(createGridHeaderCell(day));
    });

    // Create time slot rows and cells
    TIME_SLOTS.forEach(timeSlot => {
        scheduleGrid.appendChild(createGridHeaderCell(timeSlot)); // Time slot header

        DAYS.forEach(day => {
            const cell = document.createElement('div');
            cell.classList.add('schedule-cell');
            cell.dataset.day = day;
            cell.dataset.time = timeSlot;

            // Filter appointments that belong to this cell's day and time slot
            const appointmentsInCell = currentScheduleData.filter(appt =>
                appt.day === day && appt.timeRange === timeSlot
            );

            appointmentsInCell.forEach(appt => {
                const courseDiv = document.createElement('div');
                courseDiv.classList.add('course-item');
                courseDiv.draggable = true;
                courseDiv.dataset.appointmentId = appt.id; // Store unique ID for identification

                // Add class based on appointment type (for CSS styling)
                if (appt.type === 'lab') {
                    courseDiv.classList.add('lab');
                } else {
                    courseDiv.classList.add('lecture');
                }
                // Add professor-specific class for potential color-coding (example)
                courseDiv.classList.add(`prof-${appt.professorId}`);

                const prof = professorsData.find(p => p.id === appt.professorId);
                const room = roomsData.find(r => r.id === appt.roomId);

                courseDiv.innerHTML = `
                    <strong>${appt.courseName || 'مادة غير معروفة'} ${appt.sectionName ? '(' + appt.sectionName + ')' : ''}</strong><br>
                    <span>د: ${prof ? prof.name : 'غير معروف'}</span><br>
                    <span>ق: ${room ? room.name : 'غير معروف'}</span>
                `;
                cell.appendChild(courseDiv);

                // Add click listener to open edit modal
                courseDiv.addEventListener('click', () => {
                    openEditModal(appt); // Pass the actual appointment object for editing
                });
            });

            // Add drag and drop event listeners to cells
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('drop', handleDrop);
            scheduleGrid.appendChild(cell);
        });
    });
    addDragStartListeners(); // Add dragstart listeners to course items
    displayScheduleConflicts(); // Re-validate and display conflicts after rendering
};

/**
 * Creates a header cell for the schedule grid.
 * @param {string} text - The text content for the header cell
 * @returns {HTMLDivElement} The created header cell element
 */
const createGridHeaderCell = (text) => {
    const cell = document.createElement('div');
    cell.classList.add('schedule-cell', 'schedule-header');
    cell.textContent = text;
    return cell;
};

/**
 * Adds dragstart listeners to all .course-item elements.
 */
const addDragStartListeners = () => {
    document.querySelectorAll('.course-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = e.target;
            draggedAppointmentId = item.dataset.appointmentId; // Get the unique ID from dataset
            draggedItem.classList.add('dragging');
            e.dataTransfer.setData('text/plain', draggedAppointmentId); // Set data for transfer (optional)
        });
        item.addEventListener('dragend', () => {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            draggedAppointmentId = null;
            // Remove 'drag-over' class from any cells that might still have it
            document.querySelectorAll('.schedule-cell.drag-over-ok, .schedule-cell.drag-over-conflict').forEach(cell => {
                cell.classList.remove('drag-over-ok', 'drag-over-conflict');
            });
        });
    });
};

/**
 * Handles the dragover event for schedule cells, providing visual feedback.
 * @param {DragEvent} e
 */
const handleDragOver = (e) => {
    e.preventDefault(); // Allow drop
    const targetCell = e.currentTarget;
    const newDay = targetCell.dataset.day;
    const newTime = targetCell.dataset.time;

    if (!draggedAppointmentId || !newDay || !newTime) return;

    const currentScheduleData = getCurrentSchedule();
    const originalAppointment = currentScheduleData.find(appt => appt.id === draggedAppointmentId);

    if (!originalAppointment) return;

    const updatedAppointment = { ...originalAppointment, day: newDay, timeRange: newTime };
    const tempSchedule = currentScheduleData.filter(appt => appt.id !== draggedAppointmentId);
    const conflicts = checkConflicts(updatedAppointment, tempSchedule);

    // إزالة الفئات القديمة
    document.querySelectorAll('.schedule-cell.drag-over-ok, .schedule-cell.drag-over-conflict').forEach(cell => {
        cell.classList.remove('drag-over-ok', 'drag-over-conflict');
    });

    if (conflicts.length === 0) {
        targetCell.classList.add('drag-over-ok');
    } else {
        targetCell.classList.add('drag-over-conflict');
        // يمكن عرض تلميح أداة مع رسائل التعارض هنا
        // مثلاً: targetCell.title = conflicts.join('\n');
    }
};

/**
 * Handles the dragleave event for schedule cells.
 * @param {DragEvent} e
 */
const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over-ok', 'drag-over-conflict');
};

/**
 * Handles the drop event for schedule cells, updates appointment position.
 * @param {DragEvent} e
 */
const handleDrop = (e) => {
    e.preventDefault();
    const targetCell = e.currentTarget;
    targetCell.classList.remove('drag-over-ok', 'drag-over-conflict'); // إزالة الفئات عند الإفلات

    if (draggedItem && draggedAppointmentId) {
        const newDay = targetCell.dataset.day;
        const newTime = targetCell.dataset.time;

        if (!newDay || !newTime) {
            showAlert('لا يمكن إفلات الموعد هنا: معلومات اليوم أو الوقت غير موجودة.', 'warning');
            return;
        }

        const currentScheduleData = getCurrentSchedule();
        const originalAppointment = currentScheduleData.find(appt => appt.id === draggedAppointmentId);

        if (!originalAppointment) {
            showAlert('الموعد الأصلي لم يتم العثور عليه للتعديل.', 'danger');
            return;
        }

        const updatedAppointment = { ...originalAppointment, day: newDay, timeRange: newTime };

        const tempSchedule = currentScheduleData.filter(appt => appt.id !== draggedAppointmentId);
        const conflicts = checkConflicts(updatedAppointment, tempSchedule);

        if (conflicts.length > 0) {
            showAlert(`فشل تعديل الجدول بسبب تعارضات: ${conflicts.join(' | ')}`, 'danger');
            const suggestions = suggestAlternativeTimes(updatedAppointment);
            if (suggestions.length > 0) {
                showAlert(`اقتراحات لأوقات بديلة: ${suggestions.map(s => `[${s.day} ${s.timeRange} في ${s.room}]`).join(' | ')}`, 'info');
            } else {
                showAlert('لا توجد أوقات بديلة مقترحة.', 'info');
            }
        } else {
            const finalSchedule = [...tempSchedule, updatedAppointment];
            setCurrentSchedule(finalSchedule);
            renderScheduleGrid();
            showAlert('تم تعديل الجدول بنجاح!', 'success');
        }
    }
};

/**
 * Displays and highlights conflicts in the schedule grid.
 */
const displayScheduleConflicts = () => {
    const currentScheduleData = getCurrentSchedule();
    const conflicts = validateFullSchedule(currentScheduleData);
    const conflictsDiv = document.getElementById('conflict-alerts');

    // Remove any previous conflict highlights
    document.querySelectorAll('.course-item').forEach(item => item.classList.remove('conflict'));
    document.querySelectorAll('.schedule-cell').forEach(cell => cell.classList.remove('conflict'));

    if (conflicts.length > 0) {
        conflictsDiv.innerHTML = `<h4><i class="fas fa-exclamation-triangle"></i> تنبيهات التعارض في الجدول:</h4><ul>${conflicts.map(c => `<li>${c}</li>`).join('')}</ul>`;
        conflictsDiv.classList.remove('alert-success');
        conflictsDiv.classList.add('alert-danger');
        conflictsDiv.style.display = 'block';

        // Highlight conflicting items/cells
        conflicts.forEach(conflictMsg => {
            // Attempt to find and highlight the specific conflicted appointment by its ID or name
            const courseMatch = conflictMsg.match(/\[موعد ([^\]]+)\]/); // Matches [موعد CourseName]
            if (courseMatch && courseMatch[1]) {
                const conflictingIdOrName = courseMatch[1];
                document.querySelectorAll(`.course-item`).forEach(item => {
                    const appt = currentScheduleData.find(a => a.id === item.dataset.appointmentId);
                    if (appt && (appt.courseName === conflictingIdOrName || appt.courseId === conflictingIdOrName)) {
                        item.classList.add('conflict');
                        item.closest('.schedule-cell')?.classList.add('conflict');
                    }
                });
            }
            // Also try to highlight for conflicts between two courses if message includes "بين X و Y"
            const betweenCoursesMatch = conflictMsg.match(/بين "(.+?)" و "(.+?)" في/);
            if (betweenCoursesMatch && betweenCoursesMatch.length >= 3) {
                const course1Name = betweenCoursesMatch[1].trim();
                const course2Name = betweenCoursesMatch[2].trim();
                document.querySelectorAll(`.course-item`).forEach(item => {
                    const appt = currentScheduleData.find(a => a.id === item.dataset.appointmentId);
                    if (appt && (appt.courseName === course1Name || appt.courseName === course2Name)) {
                        item.classList.add('conflict');
                        item.closest('.schedule-cell')?.classList.add('conflict');
                    }
                });
            }
        });

    } else {
        conflictsDiv.innerHTML = '<h4><i class="fas fa-check-circle"></i> لا توجد تعارضات في الجدول الحالي.</h4>';
        conflictsDiv.classList.remove('alert-danger');
        conflictsDiv.classList.add('alert-success');
        conflictsDiv.style.display = 'block';
        if (window.alertTimeout) clearTimeout(window.alertTimeout); // Clear previous hide timeout
        window.alertTimeout = setTimeout(() => {
            conflictsDiv.style.display = 'none';
        }, 3000);
    }
};

// Reports Rendering (unchanged, but ensuring Chart.js re-renders correctly)
const renderReports = () => {
    const currentScheduleData = getCurrentSchedule();
    const evaluation = evaluateSchedule(currentScheduleData);

    if (!reportsSection) return;

    reportsSection.innerHTML = `
        <h2><i class="fas fa-chart-bar"></i> تقارير وإحصائيات</h2>
        <div class="evaluation-summary">
            <p><strong>تقييم جودة الجدول:</strong> <span class="score-badge ${evaluation.score >= 80 ? 'high-score' : evaluation.score >= 50 ? 'medium-score' : 'low-score'}">${evaluation.score}/100</span></p>
        </div>
        <h3>تفاصيل التقييم:</h3>
        <div class="evaluation-details-grid">
            ${Object.entries(evaluation.details).map(([key, value]) => `
                <div class="evaluation-item">
                    <strong>${key}:</strong> ${Array.isArray(value) ? value.join('; ') : value}
                </div>
            `).join('')}
        </div>
        <div class="chart-container">
            <h3>نسبة إشغال القاعات</h3>
            <canvas id="roomOccupancyCanvas"></canvas>
            <p class="chart-note">(يظهر الرسم البياني أدناه نسب إشغال القاعات بناءً على عدد الحصص المجدولة مقابل إجمالي الفترات المتاحة.)</p>
        </div>
        <div class="chart-container">
            <h3>توزيع أحمال الدكاترة</h3>
            <canvas id="professorLoadCanvas"></canvas>
            <p class="chart-note">(يظهر الرسم البياني أدناه عدد الحصص المجدولة لكل دكتور.)</p>
        </div>
    `;

    renderRoomOccupancyChart(evaluation.details);
    renderProfessorLoadChart(currentScheduleData);
};

const renderRoomOccupancyChart = (evaluationDetails) => {
    const roomLabels = [];
    const roomData = [];
    for (const key in evaluationDetails) {
        if (key.startsWith('إشغال')) {
            roomLabels.push(key.replace('إشغال ', ''));
            roomData.push(parseFloat(evaluationDetails[key]));
        }
    }

    const ctx = document.getElementById('roomOccupancyCanvas');
    if (ctx) {
        // Destroy existing chart instance if any to prevent redraw issues
        if (ctx.chart) {
            ctx.chart.destroy();
        }
        ctx.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: roomLabels,
                datasets: [{
                    label: 'نسبة الإشغال (%)',
                    data: roomData,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'نسبة الإشغال (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'القاعة/المعمل'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'نسبة إشغال القاعات'
                    },
                    tooltip: {
                        rtl: true
                    }
                },
                layout: {
                    padding: {
                        left: 10, right: 10, top: 10, bottom: 10
                    }
                }
            }
        });
    }
};

const renderProfessorLoadChart = (schedule) => {
    const professorLoads = {};
    const professorsData = getProfessors();

    schedule.forEach(appt => {
        if (!professorLoads[appt.professorId]) {
            professorLoads[appt.professorId] = 0;
        }
        professorLoads[appt.professorId]++;
    });

    const profLabels = [];
    const profData = [];

    for (const profId in professorLoads) {
        const profName = professorsData.find(p => p.id === profId)?.name || 'غير معروف';
        profLabels.push(profName);
        profData.push(professorLoads[profId]);
    }

    const ctx = document.getElementById('professorLoadCanvas');
    if (ctx) {
         // Destroy existing chart instance if any
         if (ctx.chart) {
            ctx.chart.destroy();
        }
        ctx.chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: profLabels,
                datasets: [{
                    label: 'عدد الحصص',
                    data: profData,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
                        'rgba(199, 199, 199, 0.6)', 'rgba(83, 102, 255, 0.6)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)',
                        'rgba(199, 199, 199, 1)', 'rgba(83, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'توزيع أحمال الدكاترة (عدد الحصص)'
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed;
                                }
                                return label;
                            }
                        }
                    },
                    legend: {
                        rtl: true,
                        position: 'right',
                        labels: {
                            usePointStyle: true
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 10, right: 10, top: 10, bottom: 10
                    }
                }
            }
        });
    }
};

// Professor Schedules Rendering & Printing (unchanged)
const renderProfessorSchedules = () => {
    const professorsData = getProfessors();
    const currentScheduleData = getCurrentSchedule();

    if (!professorSchedulesSection) return;

    professorSchedulesSection.innerHTML = '<h2><i class="fas fa-user-tie"></i> جداول الدكاترة</h2>';

    if (professorsData.length === 0) {
        professorSchedulesSection.innerHTML += '<p class="text-secondary">لا يوجد دكاترة لعرض جداولهم.</p>';
        return;
    }

    professorsData.forEach(prof => {
        const profDiv = document.createElement('div');
        profDiv.classList.add('professor-schedule-card');
        profDiv.innerHTML = `<h3>جدول الدكتور: ${prof.name}</h3>`;

        const profSchedule = currentScheduleData.filter(appt => appt.professorId === prof.id);

        if (profSchedule.length === 0) {
            profDiv.innerHTML += '<p class="text-secondary">لا توجد محاضرات مجدولة لهذا الدكتور.</p>';
        } else {
            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>اليوم</th>
                        <th>الوقت</th>
                        <th>المادة</th>
                        <th>القاعة/المعمل</th>
                        <th>القسم</th>
                        <th>ملاحظات</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector('tbody');

            profSchedule.sort((a, b) => {
                const dayOrder = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
                if (dayOrder !== 0) return dayOrder;
                const timeA = parseTimeRange(a.timeRange);
                const timeB = parseTimeRange(b.timeRange);
                if (!timeA || !timeB) return 0;
                return toMinutes(timeA.start) - toMinutes(timeB.start);
            });

            profSchedule.forEach(appt => {
                const row = table.insertRow();
                row.insertCell().textContent = appt.day;
                row.insertCell().textContent = appt.timeRange;
                row.insertCell().textContent = `${appt.courseName} ${appt.sectionName ? '(' + appt.sectionName + ')' : ''}`;
                row.insertCell().textContent = appt.roomName;
                row.insertCell().textContent = appt.department || '-'; // عرض القسم
                row.insertCell().textContent = appt.notes || '-';
            });
            profDiv.appendChild(table);
        }

        const printBtn = document.createElement('button');
        printBtn.textContent = `طباعة جدول ${prof.name}`;
        printBtn.classList.add('print-button');
        printBtn.addEventListener('click', () => printProfessorSchedule(prof.id));
        profDiv.appendChild(printBtn);

        professorSchedulesSection.appendChild(profDiv);
    });
};

const printProfessorSchedule = (profId) => {
    const professor = getProfessors().find(p => p.id === profId);
    if (!professor) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>جدول الدكتور ' + professor.name + '</title>');
    printWindow.document.write('<link rel="stylesheet" href="css/style.css" type="text/css" />'); // Import CSS
    printWindow.document.write('<style>body { direction: rtl; text-align: right; font-family: \'Cairo\', sans-serif; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } table th, table td { border: 1px solid #ddd; padding: 8px; text-align: right; } table th { background-color: #f2f2f2; }</style>'); // Minimal inline style for printing
    printWindow.document.write('</head><body>');
    printWindow.document.write(`<h1>جدول الدكتور: ${professor.name}</h1>`);

    const profSchedule = getCurrentSchedule().filter(appt => appt.professorId === profId);

    if (profSchedule.length === 0) {
        printWindow.document.write('<p>لا توجد محاضرات مجدولة لهذا الدكتور.</p>');
    } else {
        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>اليوم</th>
                        <th>الوقت</th>
                        <th>المادة</th>
                        <th>القاعة/المعمل</th>
                        <th>القسم</th>
                        <th>ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
        `;
        profSchedule.sort((a, b) => {
            const dayOrder = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
            if (dayOrder !== 0) return dayOrder;
            const timeA = parseTimeRange(a.timeRange);
            const timeB = parseTimeRange(b.timeRange);
            if (!timeA || !timeB) return 0;
            return toMinutes(timeA.start) - toMinutes(timeB.start);
        });

        profSchedule.forEach(appt => {
            tableHtml += `
                <tr>
                    <td>${appt.day}</td>
                    <td>${appt.timeRange}</td>
                    <td>${appt.courseName} ${appt.sectionName ? '(' + appt.sectionName + ')' : ''}</td>
                    <td>${appt.roomName}</td>
                    <td>${appt.department || '-'}</td>
                    <td>${appt.notes || '-'}</td>
                </tr>
            `;
        });
        tableHtml += '</tbody></table>';
        printWindow.document.write(tableHtml);
    }
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
};


// ======================================================
// Export Functionality
// ======================================================

const exportScheduleToPDF = () => {
    const scheduleElement = document.getElementById('schedule-view'); // Target the whole section for broader capture
    if (!scheduleElement) {
        showAlert("لم يتم العثور على عنصر الجدول للتصدير.", 'danger');
        return;
    }

    showAlert('جاري تصدير الجدول إلى PDF...', 'info');

    if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        showAlert("مكتبات التصدير (jsPDF, html2canvas) غير محملة. يرجى التحقق من الاتصال بالإنترنت.", 'danger');
        return;
    }

    html2canvas(scheduleElement, { scale: 2, useCORS: true, logging: false }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: 'a4'
        });

        const imgWidth = pdf.internal.pageSize.getWidth();
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`جدول-المواعيد-${academicPeriod.year}-${academicPeriod.semester}.pdf`);
        showAlert('تم تصدير الجدول إلى PDF بنجاح.', 'success');
    }).catch(error => {
        console.error("خطأ في تصدير PDF:", error);
        showAlert("فشل تصدير الجدول إلى PDF. قد تكون هناك مشكلة في تحميل الصور أو الخطوط.", 'danger');
    });
};

const exportScheduleToExcel = () => {
    const schedule = getCurrentSchedule();
    if (schedule.length === 0) {
        showAlert("لا يوجد جدول للتصدير.", 'warning');
        return;
    }

    showAlert('جاري تصدير الجدول إلى Excel (xlsx)...', 'info');

    if (typeof XLSX === 'undefined') {
        showAlert("مكتبة SheetJS (XLSX) غير محملة. لا يمكن تصدير ملف Excel حقيقي.", 'danger');
        return;
    }

    const data = [
        ["اليوم", "الوقت", "المادة", "الدكتور", "القاعة/المعمل", "النوع", "القسم", "الشعبة", "ملاحظات"] // Header row
    ];

    schedule.forEach(appt => {
        data.push([
            appt.day,
            appt.timeRange,
            appt.courseName || appt.courseId,
            appt.professorName || appt.professorId,
            appt.roomName || appt.roomId,
            appt.type,
            appt.department || '', // إضافة القسم
            appt.sectionName || '',
            appt.notes || ''
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data); // Convert array of arrays to sheet
    const wb = XLSX.utils.book_new(); // Create a new workbook
    XLSX.utils.book_append_sheet(wb, ws, "الجدول الدراسي"); // Append sheet to workbook

    // Write workbook to a file
    XLSX.writeFile(wb, `جدول-المواعيد-${academicPeriod.year}-${academicPeriod.semester}.xlsx`);
    showAlert('تم تصدير الجدول إلى ملف Excel (.xlsx) بنجاح.', 'success');
};

const exportScheduleToImage = () => {
    const scheduleElement = document.getElementById('schedule-view'); // Target the whole section for broader capture
    if (!scheduleElement) {
        showAlert("لم يتم العثور على عنصر الجدول للتصدير.", 'danger');
        return;
    }

    showAlert('جاري تصدير الجدول إلى صورة...', 'info');

    if (typeof html2canvas === 'undefined') {
        showAlert("مكتبة html2canvas غير محملة. يرجى التحقق من الاتصال بالإنترنت.", 'danger');
        return;
    }

    html2canvas(scheduleElement, { scale: 2, useCORS: true, logging: false }).then(canvas => {
        const link = document.createElement('a');
        link.download = `جدول-المواعيد-${academicPeriod.year}-${academicPeriod.semester}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showAlert('تم تصدير الجدول إلى صورة بنجاح.', 'success');
    }).catch(error => {
        console.error("خطأ في تصدير الصورة:", error);
        showAlert("فشل تصدير الجدول إلى صورة. قد تكون هناك مشكلة في تحميل الصور أو الخطوط.", 'danger');
    });
};


// ======================================================
// Event Listeners and Initialization
// ======================================================
const setupEventListeners = () => {
    // Navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(e.target.dataset.section);
        });
    });

    // Professor Form Submission
    if (professorForm) {
        professorForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(professorForm);
            const newProf = {
                name: formData.get('profName'),
                availableTimes: formData.get('profAvailableTimes').split(',').map(s => s.trim()).filter(s => s),
                priority: parseInt(formData.get('profPriority')) || 0,
                preferences: {
                    noFriday: formData.get('profNoFriday') === 'on'
                }
            };
            addProfessor(newProf);
            renderProfessorList(globalSearchInput ? globalSearchInput.value : '');
            renderDataEntryForms(); // Update professor dropdown in course form
            professorForm.reset();
            showAlert('تم إضافة الدكتور بنجاح.', 'success');
        });
    }

    // Room Form Submission
    if (roomForm) {
        roomForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(roomForm);
            const newRoom = {
                name: formData.get('roomName'),
                type: formData.get('roomType'),
                availableTimes: formData.get('roomAvailableTimes').split(',').map(s => s.trim()).filter(s => s),
                locationGroup: formData.get('roomLocationGroup') || ''
            };
            addRoom(newRoom);
            renderRoomList(globalSearchInput ? globalSearchInput.value : '');
            roomForm.reset();
            showAlert('تم إضافة القاعة/المعمل بنجاح.', 'success');
        });
    }

    // Course Form Submission
    if (courseForm) {
        courseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(courseForm);
            const newCourse = {
                id: generateUniqueId(), // توليد ID هنا لأننا لا نستخدم دالة addCourse مباشرة الآن في هذا الجزء
                name: formData.get('courseName'),
                sectionName: formData.get('courseSectionName') || '',
                department: formData.get('courseDepartment') || '', // التقاط القسم
                professorId: formData.get('courseProfessorId'),
                hours: parseInt(formData.get('courseHours')) || 0,
                labHours: parseInt(formData.get('courseLabHours')) || 0,
                preferredTimes: formData.get('coursePreferredTimes') ? formData.get('coursePreferredTimes').split(',').map(s => s.trim()).filter(s => s) : [],
                notes: formData.get('courseNotes') || ''
            };
            addCourse(newCourse); // استخدام addCourse لضمان حفظ البيانات
            renderCourseList(globalSearchInput ? globalSearchInput.value : '');
            renderDataEntryForms();
            courseForm.reset();
            showAlert('تم إضافة المادة بنجاح.', 'success');
        });
    }

    // Event delegation for delete/edit buttons in data lists
    document.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) {
            const btn = e.target.closest('.delete-btn');
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            if (confirm(`هل أنت متأكد من حذف هذا الـ ${type}؟ هذا سيؤثر على الجداول الحالية.`)) {
                if (type === 'professor') deleteProfessor(id);
                else if (type === 'room') deleteRoom(id);
                else if (type === 'course') deleteCourse(id);
                const currentSearchTerm = globalSearchInput ? globalSearchInput.value : '';
                renderProfessorList(currentSearchTerm);
                renderRoomList(currentSearchTerm);
                renderCourseList(currentSearchTerm);
                renderDataEntryForms();
                renderScheduleGrid();
                showAlert(`تم حذف الـ ${type} بنجاح.`, 'success');
            }
        }
        if (e.target.closest('.edit-btn')) {
            const btn = e.target.closest('.edit-btn');
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            showAlert(`ميزة التعديل المباشر من القائمة لـ ${type} غير متاحة بعد. يرجى التعديل عبر النقر على الحصة في الجدول أو حذف وإعادة إضافة.`, 'info');
        }
    });

    // Upload File Inputs
    if (uploadProfessorsInput) {
        uploadProfessorsInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await uploadFile(file, 'professors');
                    showAlert('تم رفع ملف الدكاترة بنجاح.', 'success');
                    renderProfessorList(globalSearchInput ? globalSearchInput.value : '');
                    renderDataEntryForms();
                } catch (error) {
                    showAlert(`خطأ في رفع ملف الدكاترة: ${error}`, 'danger');
                } finally {
                    e.target.value = '';
                }
            }
        });
    }
    if (uploadRoomsInput) {
        uploadRoomsInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await uploadFile(file, 'rooms');
                    showAlert('تم رفع ملف القاعات بنجاح.', 'success');
                    renderRoomList(globalSearchInput ? globalSearchInput.value : '');
                } catch (error) {
                    showAlert(`خطأ في رفع ملف القاعات: ${error}`, 'danger');
                } finally {
                    e.target.value = '';
                }
            }
        });
    }
    if (uploadCoursesInput) {
        uploadCoursesInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await uploadFile(file, 'courses');
                    showAlert('تم رفع ملف المواد بنجاح.', 'success');
                    renderCourseList(globalSearchInput ? globalSearchInput.value : '');
                    renderDataEntryForms();
                } catch (error) {
                    showAlert(`خطأ في رفع ملف المواد: ${error}`, 'danger');
                } finally {
                    e.target.value = '';
                }
            }
        });
    }

    // Schedule Generation Button
    if (generateScheduleBtn) {
        generateScheduleBtn.addEventListener('click', () => {
            showAlert('جاري توليد الجدول، قد يستغرق بعض الوقت...', 'info');
            const { schedule, unassignedCourses, conflicts } = generateSchedule();
            renderScheduleGrid();
            if (conflicts.length === 0 && unassignedCourses.length === 0) {
                showAlert('تم توليد الجدول بنجاح!', 'success');
            } else {
                let msg = 'تم توليد الجدول مع بعض المشاكل: ';
                if (unassignedCourses.length > 0) msg += `<br> ${unassignedCourses.length} مواد/وحدات لم يتم جدولتها.`;
                if (conflicts.length > 0) msg += `<br> ${conflicts.length} تعارضات في الجدول النهائي.`;
                showAlert(msg, 'warning');
            }
        });
    }

    // زر تحسين الجدول
    const optimizeScheduleBtn = document.getElementById('optimize-schedule-btn');
    if (optimizeScheduleBtn) {
        optimizeScheduleBtn.addEventListener('click', optimizeScheduleForGaps);
    }

    // زر إصلاح جميع التعارضات
    if (fixAllConflictsBtn) {
        fixAllConflictsBtn.addEventListener('click', fixAllConflictsAutomatically);
    }

    // Save Current Schedule Version Button
    if (saveCurrentScheduleBtn) {
        saveCurrentScheduleBtn.addEventListener('click', () => {
            const scheduleName = prompt(`أدخل اسماً للجدول الذي تريد حفظه (الفصل: ${academicPeriod.semester}، السنة: ${academicPeriod.year}):`);
            if (scheduleName) {
                saveScheduleVersion(scheduleName);
            }
        });
    }

    // Load Saved Schedules Button
    if (loadSavedSchedulesBtn) {
        loadSavedSchedulesBtn.addEventListener('click', () => {
            const saved = getSavedSchedules();
            if (saved.length === 0) {
                showAlert('لا توجد جداول محفوظة بعد.', 'info');
                return;
            }

            let message = "اختر جدولاً للتحميل (أدخل الرقم):\n";
            saved.forEach((s, index) => {
                const periodInfo = s.academicYear && s.academicSemester ? ` (${s.academicSemester} ${s.academicYear})` : '';
                message += `${index + 1}. ${s.name} ${periodInfo} (${new Date(s.timestamp).toLocaleString()})\n`;
            });

            const choice = prompt(message);
            const index = parseInt(choice) - 1;

            if (!isNaN(index) && saved[index]) {
                loadScheduleVersion(saved[index].id);
                renderScheduleGrid();
            } else if (choice !== null && choice !== "") {
                showAlert('اختيار غير صالح أو تم الإلغاء.', 'warning');
            }
        });
    }

    // Export Buttons
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportScheduleToPDF);
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportScheduleToExcel);
    if (exportImageBtn) exportImageBtn.addEventListener('click', exportScheduleToImage);

    // Modal Close Button
    if (closeButton) {
        closeButton.addEventListener('click', closeEditModal);
    }
    // Close modal if clicked outside its content
    if (editAppointmentModal) {
        window.addEventListener('click', (event) => {
            if (event.target === editAppointmentModal) {
                closeEditModal();
            }
        });
    }

    // Edit Appointment Form Submission (inside modal)
    if (editAppointmentForm) {
        editAppointmentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const originalApptId = editApptOriginalId.value;
            const currentScheduleData = getCurrentSchedule();
            const originalAppointmentIndex = currentScheduleData.findIndex(appt => appt.id === originalApptId);

            if (originalAppointmentIndex === -1) {
                showAlert('لم يتم العثور على الموعد الأصلي للتعديل.', 'danger');
                closeEditModal();
                return;
            }

            const updatedFields = {
                professorId: editApptProfessorId.value,
                roomId: editApptRoomId.value,
                day: editApptDay.value,
                timeRange: editApptTimeRange.value,
                notes: editApptNotes.value
            };

            const updatedAppointment = { ...currentScheduleData[originalAppointmentIndex], ...updatedFields };

            const tempSchedule = currentScheduleData.filter(appt => appt.id !== originalApptId);
            const conflicts = checkConflicts(updatedAppointment, tempSchedule);

            if (conflicts.length > 0) {
                showAlert(`فشل حفظ التعديلات بسبب تعارضات: ${conflicts.join(' | ')}`, 'danger');
                const suggestions = suggestAlternativeTimes(updatedAppointment);
                if (suggestions.length > 0) {
                    showAlert(`اقتراحات لأوقات بديلة: ${suggestions.map(s => `[${s.day} ${s.timeRange} في ${s.room}]`).join(' | ')}`, 'info');
                } else {
                    showAlert('لا توجد أوقات بديلة مقترحة.', 'info');
                }
            } else {
                currentScheduleData[originalAppointmentIndex] = updatedAppointment;
                setCurrentSchedule(currentScheduleData);
                renderScheduleGrid();
                closeEditModal();
                showAlert('تم حفظ التعديلات بنجاح!', 'success');
            }
        });
    }

    // Delete Appointment Button (inside modal)
    if (deleteApptBtn) {
        deleteApptBtn.addEventListener('click', () => {
            if (confirm('هل أنت متأكد من حذف هذا الموعد؟')) {
                const apptIdToDelete = editApptOriginalId.value;
                const currentScheduleData = getCurrentSchedule();
                const updatedSchedule = currentScheduleData.filter(appt => appt.id !== apptIdToDelete);
                setCurrentSchedule(updatedSchedule);
                renderScheduleGrid();
                closeEditModal();
                showAlert('تم حذف الموعد بنجاح.', 'success');
            }
        });
    }

    // حقل البحث العام
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', () => {
            const searchTerm = globalSearchInput.value;
            renderProfessorList(searchTerm);
            renderRoomList(searchTerm);
            renderCourseList(searchTerm);
        });
    }

    // إدارة الفترات الزمنية المخصصة
    if (timeSlotsForm) {
        timeSlotsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newTimeSlots = customTimeSlotsTextArea.value.split('\n').map(s => s.trim()).filter(s => s && parseTimeRange(s));
            if (newTimeSlots.length > 0) {
                TIME_SLOTS = newTimeSlots;
                calculateTimeSlotsMinutes(); // إعادة حساب الدقائق
                saveData();
                renderScheduleGrid(); // إعادة عرض الجدول بالفترات الجديدة
                showAlert('تم تحديث الفترات الزمنية بنجاح!', 'success');
            } else {
                showAlert('الرجاء إدخال فترات زمنية صالحة.', 'danger');
            }
        });
    }

    // إدارة الفترة الأكاديمية
    if (academicPeriodForm) {
        academicPeriodForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newYear = parseInt(currentAcademicYearInput.value);
            const newSemester = currentAcademicSemesterInput.value;
            if (!isNaN(newYear) && newSemester) {
                academicPeriod = { year: newYear, semester: newSemester };
                saveData();
                showAlert('تم حفظ الفترة الأكاديمية بنجاح!', 'success');
            } else {
                showAlert('الرجاء إدخال سنة وفصل دراسي صحيحين.', 'danger');
            }
        });
    }
};

/**
 * Initializes the application: loads data, sets up dummy data if empty, and configures event listeners.
 */
const initializeApp = () => {
    loadData();
    if (getProfessors().length === 0 && getRooms().length === 0 && getCourses().length === 0) {
        initializeDummyData();
    }
    setupEventListeners();
    showSection('data-entry');
    // عند تحميل قسم إدخال البيانات، أعد عرض القوائم مع حقل بحث فارغ في البداية (أو نص البحث الحالي)
    const currentSearchTerm = globalSearchInput ? globalSearchInput.value : '';
    renderProfessorList(currentSearchTerm);
    renderRoomList(currentSearchTerm);
    renderCourseList(currentSearchTerm);
    populateDatalists(); // تحديث اقتراحات الإدخال اليدوي عند بدء التطبيق
};

document.addEventListener('DOMContentLoaded', initializeApp);
