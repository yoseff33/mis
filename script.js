// js/script.js

// ======================================================
// Global Constants & Helpers (utils.js equivalent)
// ======================================================
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const TIME_SLOTS = [
    "8:00-9:40", "10:00-11:40", "12:00-13:40", "14:00-15:40", "16:00-17:40"
];

const getDayName = (dayIndex) => {
    const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    return days[dayIndex];
};

const parseTimeRange = (timeRange) => {
    const [start, end] = timeRange.split('-');
    return { start, end };
};

const toMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const isTimeConflict = (time1Start, time1End, time2Start, time2End) => {
    const t1s = toMinutes(time1Start);
    const t1e = toMinutes(time1End);
    const t2s = toMinutes(time2Start);
    const t2e = toMinutes(time2End);
    return Math.max(t1s, t2s) < Math.min(t1e, t2e);
};

const generateUniqueId = () => {
    return '_' + Math.random().toString(36).substr(2, 9);
};

// ======================================================
// Data Management (data.js equivalent)
// ======================================================
const STORAGE_KEYS = {
    PROFESSORS: 'professors',
    ROOMS: 'rooms',
    COURSES: 'courses',
    SCHEDULES: 'schedules',
    CURRENT_SCHEDULE: 'currentSchedule'
};

let professors = [];
let rooms = [];
let courses = [];
let schedules = [];
let currentSchedule = [];

const loadData = () => {
    professors = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFESSORS)) || [];
    rooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOMS)) || [];
    courses = JSON.parse(localStorage.getItem(STORAGE_KEYS.COURSES)) || [];
    schedules = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES)) || [];
    currentSchedule = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_SCHEDULE)) || [];
    console.log("Data loaded:", { professors, rooms, courses, currentSchedule, schedules });
};

const saveData = () => {
    localStorage.setItem(STORAGE_KEYS.PROFESSORS, JSON.stringify(professors));
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
    localStorage.setItem(STORAGE_KEYS.CURRENT_SCHEDULE, JSON.stringify(currentSchedule));
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
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
    saveData();
};

// Schedule Management
const getCurrentSchedule = () => currentSchedule;
const setCurrentSchedule = (schedule) => {
    currentSchedule = schedule;
    saveData();
};

const saveScheduleVersion = (name) => {
    schedules.push({ id: generateUniqueId(), name: name, timestamp: new Date(), schedule: [...currentSchedule] });
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
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Read as array of arrays

                if (json.length === 0) {
                    reject("ملف Excel فارغ أو لا يحتوي على بيانات.");
                    return;
                }
                
                // Assuming the first row is header. Convert to object array.
                const header = json[0];
                const rows = json.slice(1);
                const jsonData = rows.map(row => {
                    const obj = {};
                    header.forEach((h, i) => {
                        obj[h] = row[i];
                    });
                    return obj;
                });
                
                processUploadedData(jsonData, type, resolve, reject);
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
        switch (type) {
            case 'professors':
                const newProfessors = data.map(row => ({
                    id: generateUniqueId(),
                    name: String(row.name || 'غير معروف'),
                    availableTimes: String(row.availableTimes || '').split(';').map(s => s.trim()).filter(s => s),
                    priority: parseInt(row.priority) || 0,
                    preferences: row.preferences ? JSON.parse(String(row.preferences)) : {}
                }));
                professors = [...professors, ...newProfessors];
                break;
            case 'rooms':
                const newRooms = data.map(row => ({
                    id: generateUniqueId(),
                    name: String(row.name || 'غير معروف'),
                    type: String(row.type || 'lecture'),
                    availableTimes: String(row.availableTimes || '').split(';').map(s => s.trim()).filter(s => s),
                    locationGroup: String(row.locationGroup || '') // New field for room location
                }));
                rooms = [...rooms, ...newRooms];
                break;
            case 'courses':
                const newCourses = data.map(row => ({
                    id: generateUniqueId(),
                    name: String(row.name || 'غير معروف'),
                    professorId: String(row.professorId || null),
                    hours: parseInt(row.hours) || 0,
                    labHours: parseInt(row.labHours) || 0,
                    preferredTimes: String(row.preferredTimes || '').split(';').map(s => s.trim()).filter(s => s),
                    notes: String(row.notes || '')
                }));
                courses = [...courses, ...newCourses];
                break;
            default:
                reject("نوع بيانات غير معروف.");
                return;
        }
        saveData();
        resolve(`تم رفع ملف ${type} بنجاح.`);
    } catch (e) {
        console.error("Error processing uploaded data:", e);
        reject(`فشل معالجة البيانات من الملف: ${e.message}`);
    }
};

const initializeDummyData = () => {
    professors = [
        { id: 'p1', name: "د. أحمد", availableTimes: ["الأحد:8:00-9:40", "الاثنين:10:00-11:40", "الأربعاء:14:00-15:40"], priority: 1, preferences: { noFriday: true } },
        { id: 'p2', name: "د. سارة", availableTimes: ["الاثنين:8:00-9:40", "الثلاثاء:10:00-11:40", "الخميس:12:00-13:40"], priority: 2, preferences: {} },
        { id: 'p3', name: "د. خالد", availableTimes: ["الأحد:12:00-13:40", "الثلاثاء:8:00-9:40", "الخميس:10:00-11:40"], priority: 3, preferences: {} },
    ];
    rooms = [
        { id: 'r1', name: "قاعة 101", type: "lecture", availableTimes: ["الأحد:8:00-18:00", "الاثنين:8:00-18:00", "الثلاثاء:8:00-18:00", "الأربعاء:8:00-18:00", "الخميس:8:00-18:00"], locationGroup: "مبنى أ" },
        { id: 'r2', name: "معمل B", type: "lab", availableTimes: ["الأحد:8:00-18:00", "الاثنين:8:00-18:00", "الثلاثاء:8:00-18:00", "الأربعاء:8:00-18:00", "الخميس:8:00-18:00"], locationGroup: "مبنى ب" },
        { id: 'r3', name: "قاعة 205", type: "lecture", availableTimes: ["الأحد:8:00-18:00", "الاثنين:8:00-18:00", "الثلاثاء:8:00-18:00", "الأربعاء:8:00-18:00", "الخميس:8:00-18:00"], locationGroup: "مبنى أ" },
        { id: 'r4', name: "معمل C", type: "lab", availableTimes: ["الأحد:8:00-18:00", "الاثنين:8:00-18:00", "الثلاثاء:8:00-18:00", "الأربعاء:8:00-18:00", "الخميس:8:00-18:00"], locationGroup: "مبنى ج" },

    ];
    courses = [
        { id: 'c1', name: "مقدمة في البرمجة", professorId: 'p1', hours: 3, labHours: 1, preferredTimes: ["الأحد:8:00-9:40"], notes: "مادة أساسية" },
        { id: 'c2', name: "هياكل البيانات", professorId: 'p2', hours: 2, labHours: 0, preferredTimes: ["الثلاثاء:10:00-11:40"], notes: "" },
        { id: 'c3', name: "شبكات الحاسوب", professorId: 'p1', hours: 3, labHours: 0, preferredTimes: [], notes: "" },
        { id: 'c4', name: "قواعد البيانات", professorId: 'p3', hours: 3, labHours: 1, preferredTimes: [], notes: "" },
        { id: 'c5', name: "ذكاء اصطناعي", professorId: 'p2', hours: 2, labHours: 0, preferredTimes: [], notes: "" },
        { id: 'c6', name: "تحليل وتصميم نظم", professorId: 'p3', hours: 3, labHours: 0, preferredTimes: [], notes: "مشروع" },
    ];
    currentSchedule = [];
    schedules = [];
    saveData();
    console.log("Dummy data initialized and saved.");
};

// ======================================================
// Conflict Validation
// ======================================================
const checkConflicts = (newAppointment, schedule) => {
    const conflicts = [];
    const professorsData = getProfessors();
    const roomsData = getRooms();

    const { id: newApptId, courseId, professorId, roomId, day, timeRange } = newAppointment;
    if (!timeRange || !day || !professorId || !roomId) {
        conflicts.push("بيانات الموعد غير مكتملة.");
        return conflicts;
    }

    const { start: newStart, end: newEnd } = parseTimeRange(timeRange);

    // Check professor availability and preferences
    const professor = professorsData.find(p => p.id === professorId);
    if (professor) {
        const professorAvailable = professor.availableTimes.some(pt => {
            const [ptDay, ptRange] = pt.split(':');
            const { start: ptStart, end: ptEnd } = parseTimeRange(ptRange);
            return ptDay === day && !isTimeConflict(newStart, newEnd, ptStart, ptEnd);
        });
        if (!professorAvailable && !professor.preferences?.flexibleScheduling) {
            conflicts.push(`الدكتور ${professor.name} غير متاح في ${day} ${timeRange}.`);
        }
        if (professor.preferences?.noFriday && day === "الجمعة") {
            conflicts.push(`الدكتور ${professor.name} يفضل عدم التدريس يوم الجمعة.`);
        }
    } else {
        conflicts.push(`الدكتور بالمعرف ${professorId} غير موجود.`);
    }

    // Check room availability
    const room = roomsData.find(r => r.id === roomId);
    if (room) {
        const roomAvailable = room.availableTimes.some(rt => {
            const [rtDay, rtRange] = rt.split(':');
            const { start: rtStart, end: rtEnd } = parseTimeRange(rtRange);
            return rtDay === day && !isTimeConflict(newStart, newEnd, rtStart, rtEnd);
        });
        if (!roomAvailable) {
            conflicts.push(`القاعة/المعمل ${room.name} غير متاح في ${day} ${timeRange}.`);
        }
    } else {
        conflicts.push(`القاعة/المعمل بالمعرف ${roomId} غير موجود.`);
    }

    // Check conflicts with other appointments in the schedule
    schedule.forEach(existingAppointment => {
        // Skip self-comparison for the same appointment (if it's being updated)
        if (existingAppointment.id === newApptId) return;

        if (existingAppointment.day === day) {
            const { start: existingStart, end: existingEnd } = parseTimeRange(existingAppointment.timeRange);

            if (existingAppointment.professorId === professorId && isTimeConflict(newStart, newEnd, existingStart, existingEnd)) {
                conflicts.push(`تعارض وقت للدكتور ${professor?.name || professorId} بين ${newAppointment.courseName || newAppointment.courseId} و ${existingAppointment.courseName || existingAppointment.courseId} في ${day} ${existingAppointment.timeRange}.`);
            }

            if (existingAppointment.roomId === roomId && isTimeConflict(newStart, newEnd, existingStart, existingEnd)) {
                conflicts.push(`تعارض وقت للقاعة ${room?.name || roomId} بين ${newAppointment.courseName || newAppointment.courseId} و ${existingAppointment.courseName || existingAppointment.courseId} في ${day} ${existingAppointment.timeRange}.`);
            }
        }
    });

    return conflicts;
};

const validateFullSchedule = (schedule) => {
    const allConflicts = [];
    const professorsData = getProfessors();
    const roomsData = getRooms();

    // Create a deep copy of the schedule to avoid modifying it during validation
    const tempSchedule = JSON.parse(JSON.stringify(schedule));

    tempSchedule.forEach((appt1, index1) => {
        // Check availability for appt1 itself (excluding self from check)
        const conflictsForAppt1 = checkConflicts(appt1, tempSchedule.filter((_, idx) => idx !== index1));
        conflictsForAppt1.forEach(conflict => {
            allConflicts.push(`[موعد ${appt1.courseName || appt1.courseId}] ${conflict}`);
        });

        // Check for conflicts with subsequent appointments
        for (let i = index1 + 1; i < tempSchedule.length; i++) {
            const appt2 = tempSchedule[i];

            if (appt1.day === appt2.day) {
                const { start: appt1Start, end: appt1End } = parseTimeRange(appt1.timeRange);
                const { start: appt2Start, end: appt2End } = parseTimeRange(appt2.timeRange);

                if (appt1.professorId === appt2.professorId && isTimeConflict(appt1Start, appt1End, appt2Start, appt2End)) {
                    const profName = professorsData.find(p => p.id === appt1.professorId)?.name || appt1.professorId;
                    allConflicts.push(`تعارض وقت للدكتور ${profName} بين ${appt1.courseName} و ${appt2.courseName} في ${appt1.day} ${appt1.timeRange} و ${appt2.timeRange}.`);
                }

                if (appt1.roomId === appt2.roomId && isTimeConflict(appt1Start, appt1End, appt2Start, appt2End)) {
                    const roomName = roomsData.find(r => r.id === appt1.roomId)?.name || appt1.roomId;
                    allConflicts.push(`تعارض وقت للقاعة ${roomName} بين ${appt1.courseName} و ${appt2.courseName} في ${appt1.day} ${appt1.timeRange} و ${appt2.timeRange}.`);
                }
            }
        }
    });
    return [...new Set(allConflicts)]; // Return unique conflicts
};

// ======================================================
// Scheduling Algorithms (Enhanced)
// ======================================================

const generateSchedule = () => {
    const professorsData = getProfessors();
    const roomsData = getRooms();
    const coursesData = getCourses();

    let newSchedule = [];
    let unassignedCourses = []; // To track courses that couldn't be fully scheduled

    // Prepare scheduling units based on course hours.
    // Each 100-minute slot is considered one scheduling unit.
    const schedulingUnits = [];
    coursesData.forEach(course => {
        const totalDurationMinutes = (course.hours * 60) + (course.labHours * 60);
        const numSlots = Math.ceil(totalDurationMinutes / 100); // 100 mins per slot

        for (let i = 0; i < numSlots; i++) {
            schedulingUnits.push({
                courseId: course.id,
                courseName: course.name,
                professorId: course.professorId,
                isLabSession: i < Math.ceil((course.labHours * 60) / 100), // Mark if this unit is specifically for lab
                preferredTimes: course.preferredTimes,
                notes: course.notes,
                originalCourseHours: course.hours, // For evaluation and tracking
                originalLabHours: course.labHours
            });
        }
    });

    // Sort scheduling units for prioritization:
    // 1. Units with preferred times (harder to place)
    // 2. Lab sessions (fewer dedicated rooms)
    // 3. Courses with higher professor priority (assigned earlier)
    schedulingUnits.sort((a, b) => {
        const profA = professorsData.find(p => p.id === a.professorId);
        const profB = professorsData.find(p => p.id === b.professorId);

        // Prioritize preferred times
        if (a.preferredTimes.length > 0 && b.preferredTimes.length === 0) return -1;
        if (a.preferredTimes.length === 0 && b.preferredTimes.length > 0) return 1;

        // Prioritize lab sessions
        if (a.isLabSession && !b.isLabSession) return -1;
        if (!a.isLabSession && b.isLabSession) return 1;

        // Prioritize higher professor priority (lower number is higher priority)
        if (profA && profB) {
            return profA.priority - profB.priority;
        }
        return 0;
    });

    // Attempt to schedule each unit
    for (const unit of schedulingUnits) {
        let assigned = false;
        const professor = professorsData.find(p => p.id === unit.professorId);
        if (!professor) {
            unassignedCourses.push({ ...unit, reason: "الدكتور غير موجود." });
            continue;
        }

        let possibleSlots = [];
        if (unit.preferredTimes && unit.preferredTimes.length > 0) {
            for (const prefTime of unit.preferredTimes) {
                const [day, timeRange] = prefTime.split(':');
                if (day && timeRange && DAYS.includes(day) && TIME_SLOTS.includes(timeRange)) {
                    possibleSlots.push({ day, timeRange, preferred: true });
                }
            }
        }
        // Add all other possible slots
        for (const day of DAYS) {
            if (professor.preferences?.noFriday && day === "الجمعة") continue; // Respect professor preference
            for (const timeRange of TIME_SLOTS) {
                // Avoid duplicating if already added from preferredTimes
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

        for (const slot of possibleSlots) {
            const { day, timeRange } = slot;
            const { start: slotStart, end: slotEnd } = parseTimeRange(timeRange);

            let suitableRooms = roomsData.filter(r =>
                (unit.isLabSession ? r.type === "lab" : r.type === "lecture") && // Match room type
                r.availableTimes.some(rt => { // Check room availability
                    const [rtDay, rtRange] = rt.split(':');
                    const { start: rtStart, end: rtEnd } = parseTimeRange(rtRange);
                    return rtDay === day && !isTimeConflict(slotStart, slotEnd, rtStart, rtEnd);
                })
            );

            // Prioritize rooms based on location group if professor has consecutive classes
            // This is a heuristic, real CP would model connectivity.
            // For now, simple randomization
            suitableRooms.sort(() => 0.5 - Math.random()); // Randomize for scenario generation

            for (const room of suitableRooms) {
                const potentialAppointment = {
                    id: generateUniqueId(), // Unique ID for each scheduled session
                    courseId: unit.courseId,
                    courseName: unit.courseName,
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
            unassignedCourses.push({ ...unit, reason: "لم يتم العثور على وقت/قاعة مناسبة لهذه الوحدة بعد القيود." });
        }
    }

    newSchedule.sort((a, b) => {
        const dayOrder = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
        if (dayOrder !== 0) return dayOrder;
        return toMinutes(parseTimeRange(a.timeRange).start) - toMinutes(parseTimeRange(b.timeRange).start);
    });

    setCurrentSchedule(newSchedule);
    console.log("Generated Schedule:", newSchedule);
    const fullScheduleConflicts = validateFullSchedule(newSchedule);
    return { schedule: newSchedule, unassignedCourses: unassignedCourses, conflicts: fullScheduleConflicts };
};

const evaluateSchedule = (schedule) => {
    let score = 100;
    const evaluationDetails = {};
    const professorsData = getProfessors();
    const roomsData = getRooms();

    // 1. Professor teaching days
    const professorDays = {};
    schedule.forEach(appt => {
        if (!professorDays[appt.professorId]) professorDays[appt.professorId] = new Set();
        professorDays[appt.professorId].add(appt.day);
    });

    for (const profId in professorDays) {
        const profName = professorsData.find(p => p.id === profId)?.name || 'غير معروف';
        const numDays = professorDays[profId].size;
        evaluationDetails[`أيام تدريس ${profName}`] = `${numDays} أيام`;
        if (numDays > 3) {
            score -= (numDays - 3) * 5;
        }
    }

    // 2. Gaps between lectures for the same professor on the same day
    const profDailySchedule = {};
    schedule.forEach(appt => {
        if (!profDailySchedule[appt.professorId]) profDailySchedule[appt.professorId] = {};
        if (!profDailySchedule[appt.professorId][appt.day]) profDailySchedule[appt.professorId][appt.day] = [];
        profDailySchedule[appt.professorId][appt.day].push(appt);
    });

    for (const profId in profDailySchedule) {
        for (const day in profDailySchedule[profId]) {
            const appointments = profDailySchedule[profId][day].sort((a, b) =>
                toMinutes(parseTimeRange(a.timeRange).start) - toMinutes(parseTimeRange(b.timeRange).start)
            );

            for (let i = 0; i < appointments.length - 1; i++) {
                const end1Minutes = toMinutes(parseTimeRange(appointments[i].timeRange).end);
                const start2Minutes = toMinutes(parseTimeRange(appointments[i + 1].timeRange).start);
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

    // 3. Room utilization/occupancy (already present, improved penalty)
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

    // 4. Lab distribution (already present)
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
    if (maxLabsInDay > 4) {
        score -= (maxLabsInDay - 4) * 3;
    }

    // 5. Reduce room switching for professors (requires room location info)
    const professorDailyRoomChanges = {};
    professorsData.forEach(prof => professorDailyRoomChanges[prof.id] = {});

    schedule.forEach(appt => {
        const profId = appt.professorId;
        const day = appt.day;
        const room = roomsData.find(r => r.id === appt.roomId);
        if (room && room.locationGroup) { // Check if room has locationGroup defined
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

    // 6. Balance course load per day (avoiding "packing" all courses on few days)
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
        score -= conflicts.length * 20;
        evaluationDetails['تعارضات'] = conflicts.length;
        evaluationDetails['تفاصيل التعارضات'] = conflicts;
    }

    score = Math.max(0, score);
    return { score: Math.round(score), details: evaluationDetails };
};

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
    scenarios.sort((a, b) => b.evaluation.score - a.evaluation.score);
    return scenarios;
};

const suggestAlternativeTimes = (problematicAppointment) => {
    const professorsData = getProfessors();
    const roomsData = getRooms();
    const coursesData = getCourses();
    const currentScheduleCopy = [...getCurrentSchedule()];

    const course = coursesData.find(c => c.id === problematicAppointment.courseId);
    const professor = professorsData.find(p => p.id === problematicAppointment.professorId);
    const problematicRoom = roomsData.find(r => r.id === problematicAppointment.roomId);

    const suggestions = [];

    // Temporarily remove the problematic appointment from the schedule for conflict checking
    const tempSchedule = currentScheduleCopy.filter(appt => appt.id !== problematicAppointment.id);

    for (const day of DAYS) {
        if (professor?.preferences?.noFriday && day === "الجمعة") continue;

        for (const timeRange of TIME_SLOTS) {
            const { start: slotStart, end: slotEnd } = parseTimeRange(timeRange);

            let professorAvailable = professor?.availableTimes.some(pt => {
                const [ptDay, ptRange] = pt.split(':');
                const { start: ptStart, end: ptEnd } = parseTimeRange(ptRange);
                return ptDay === day && !isTimeConflict(slotStart, slotEnd, ptStart, ptEnd);
            }) || false;

            let roomAvailable = problematicRoom?.availableTimes.some(rt => {
                const [rtDay, rtRange] = rt.split(':');
                const { start: rtStart, end: rtEnd } = parseTimeRange(rtRange);
                return rtDay === day && !isTimeConflict(slotStart, slotEnd, rtStart, rtEnd);
            }) || false;

            const potentialAppointment = {
                id: generateUniqueId(), // A temporary ID for this potential slot
                courseId: problematicAppointment.courseId,
                courseName: problematicAppointment.courseName,
                professorId: problematicAppointment.professorId,
                professorName: problematicAppointment.professorName,
                roomId: problematicRoom ? problematicRoom.id : null,
                roomName: problematicRoom ? problematicRoom.name : 'غير معروفة',
                type: course?.labHours > 0 ? "lab" : "lecture",
                day: day,
                timeRange: timeRange,
                notes: problematicAppointment.notes
            };

            const conflicts = checkConflicts(potentialAppointment, tempSchedule);

            if (professorAvailable && roomAvailable && conflicts.length === 0) {
                suggestions.push({
                    day: day,
                    timeRange: timeRange,
                    room: problematicRoom?.name || 'نفس القاعة',
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

// DOM Elements
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


// UI Helpers
const showSection = (sectionId) => {
    document.querySelectorAll('section').forEach(section => {
        section.classList.remove('active-section');
    });
    document.getElementById(sectionId).classList.add('active-section');

    navLinks.forEach(link => {
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    if (sectionId === 'schedule-view') {
        renderScheduleGrid();
    } else if (sectionId === 'data-entry') {
        renderDataEntryForms();
        renderProfessorList();
        renderRoomList();
        renderCourseList();
    } else if (sectionId === 'reports') {
        renderReports();
    } else if (sectionId === 'professor-schedules') {
        renderProfessorSchedules();
    } else if (sectionId === 'settings') {
        // Any specific rendering for settings can go here
    }
};

const showAlert = (message, type = 'danger') => {
    conflictAlertsDiv.innerHTML = message;
    conflictAlertsDiv.className = `alert alert-${type}`;
    conflictAlertsDiv.style.display = 'block';
    if (window.alertTimeout) clearTimeout(window.alertTimeout);
    window.alertTimeout = setTimeout(() => {
        conflictAlertsDiv.style.display = 'none';
    }, 8000);
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

const renderProfessorList = () => {
    const professorsData = getProfessors();
    if (!professorListDiv) return;

    professorListDiv.innerHTML = '<h3>قائمة الدكاترة</h3>';
    if (professorsData.length === 0) {
        professorListDiv.innerHTML += '<p>لا يوجد دكاترة بعد.</p>';
        return;
    }
    const ul = document.createElement('ul');
    professorsData.forEach(prof => {
        const li = document.createElement('li');
        const availableTimesFormatted = prof.availableTimes.length > 0 ? prof.availableTimes.join(', ') : 'لا يوجد';
        const preferencesText = prof.preferences?.noFriday ? ' (لا جمعة)' : '';
        li.innerHTML = `
            <div>
                <strong>${prof.name}</strong> (أولوية: ${prof.priority})${preferencesText}<br>
                الأوقات المتاحة: ${availableTimesFormatted}
            </div>
            <div>
                <button class="edit-btn" data-id="${prof.id}" data-type="professor">تعديل</button>
                <button class="delete-btn" data-id="${prof.id}" data-type="professor">حذف</button>
            </div>
        `;
        ul.appendChild(li);
    });
    professorListDiv.appendChild(ul);
};

const renderRoomList = () => {
    const roomsData = getRooms();
    if (!roomListDiv) return;

    roomListDiv.innerHTML = '<h3>قائمة القاعات والمعامل</h3>';
    if (roomsData.length === 0) {
        roomListDiv.innerHTML += '<p>لا توجد قاعات بعد.</p>';
        return;
    }
    const ul = document.createElement('ul');
    roomsData.forEach(room => {
        const li = document.createElement('li');
        const availableTimesFormatted = room.availableTimes.length > 0 ? room.availableTimes.join(', ') : 'لا يوجد';
        const locationGroupText = room.locationGroup ? ` (موقع: ${room.locationGroup})` : '';
        li.innerHTML = `
            <div>
                <strong>${room.name}</strong> (${room.type === 'lecture' ? 'قاعة' : 'معمل'})${locationGroupText}<br>
                الأوقات المتاحة: ${availableTimesFormatted}
            </div>
            <div>
                <button class="edit-btn" data-id="${room.id}" data-type="room">تعديل</button>
                <button class="delete-btn" data-id="${room.id}" data-type="room">حذف</button>
            </div>
        `;
        ul.appendChild(li);
    });
    roomListDiv.appendChild(ul);
};

const renderCourseList = () => {
    const coursesData = getCourses();
    const professorsData = getProfessors();
    if (!courseListDiv) return;

    courseListDiv.innerHTML = '<h3>قائمة المواد</h3>';
    if (coursesData.length === 0) {
        courseListDiv.innerHTML += '<p>لا توجد مواد بعد.</p>';
        return;
    }
    const ul = document.createElement('ul');
    coursesData.forEach(course => {
        const profName = professorsData.find(p => p.id === course.professorId)?.name || 'غير محدد';
        const preferredTimesText = course.preferredTimes.length > 0 ? `(مفضلة: ${course.preferredTimes.join(', ')})` : '';
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${course.name}</strong> (دكتور: ${profName})<br>
                ساعات: ${course.hours} نظري, ${course.labHours} عملي ${preferredTimesText}<br>
                ملاحظات: ${course.notes || '-'}
            </div>
            <div>
                <button class="edit-btn" data-id="${course.id}" data-type="course">تعديل</button>
                <button class="delete-btn" data-id="${course.id}" data-type="course">حذف</button>
            </div>
        `;
        ul.appendChild(li);
    });
    courseListDiv.appendChild(ul);
};

// Modal functions
const openEditModal = (appointmentData) => {
    if (!editAppointmentModal) return;

    editApptOriginalId.value = appointmentData.id;
    editApptCourseName.value = appointmentData.courseName;
    editApptNotes.value = appointmentData.notes;

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
let draggedItem = null;
let draggedAppointmentId = null;

const renderScheduleGrid = () => {
    const currentScheduleData = getCurrentSchedule();
    const professorsData = getProfessors();
    const roomsData = getRooms();

    if (!scheduleGrid) return;
    scheduleGrid.innerHTML = '';

    scheduleGrid.style.gridTemplateColumns = `minmax(120px, 1fr) repeat(${DAYS.length}, 1fr)`;

    scheduleGrid.appendChild(createGridHeaderCell(''));
    DAYS.forEach(day => {
        scheduleGrid.appendChild(createGridHeaderCell(day));
    });

    TIME_SLOTS.forEach(timeSlot => {
        scheduleGrid.appendChild(createGridHeaderCell(timeSlot));

        DAYS.forEach(day => {
            const cell = document.createElement('div');
            cell.classList.add('schedule-cell');
            cell.dataset.day = day;
            cell.dataset.time = timeSlot;

            const appointmentsInCell = currentScheduleData.filter(appt =>
                appt.day === day && appt.timeRange === timeSlot
            );

            appointmentsInCell.forEach(appt => {
                const courseDiv = document.createElement('div');
                courseDiv.classList.add('course-item');
                courseDiv.draggable = true;
                courseDiv.dataset.appointmentId = appt.id; // Use the unique ID for drag/click identification
                
                const prof = professorsData.find(p => p.id === appt.professorId);
                const room = roomsData.find(r => r.id === appt.roomId);

                courseDiv.innerHTML = `
                    <strong>${appt.courseName || 'مادة غير معروفة'}</strong><br>
                    د: ${prof ? prof.name : 'غير معروف'}<br>
                    ق: ${room ? room.name : 'غير معروف'}
                `;
                cell.appendChild(courseDiv);

                courseDiv.addEventListener('click', () => {
                    openEditModal(appt); // Pass the actual appointment object
                });
            });

            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('drop', handleDrop);
            scheduleGrid.appendChild(cell);
        });
    });
    addDragStartListeners();
    displayScheduleConflicts();
};

const createGridHeaderCell = (text) => {
    const cell = document.createElement('div');
    cell.classList.add('schedule-cell', 'schedule-header');
    cell.textContent = text;
    return cell;
};

const addDragStartListeners = () => {
    document.querySelectorAll('.course-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = e.target;
            draggedAppointmentId = item.dataset.appointmentId;
            draggedItem.classList.add('dragging');
            e.dataTransfer.setData('text/plain', draggedAppointmentId);
        });
        item.addEventListener('dragend', () => {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            draggedAppointmentId = null;
            document.querySelectorAll('.schedule-cell.drag-over').forEach(cell => {
                cell.classList.remove('drag-over');
            });
        });
    });
};

const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
};

const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
};

const handleDrop = (e) => {
    e.preventDefault();
    const targetCell = e.currentTarget;
    targetCell.classList.remove('drag-over');

    if (draggedItem && draggedAppointmentId) {
        const newDay = targetCell.dataset.day;
        const newTime = targetCell.dataset.time;

        if (!newDay || !newTime) {
            showAlert('لا يمكن إفلات الموعد هنا.', 'warning');
            return;
        }

        const currentScheduleData = getCurrentSchedule();
        const originalAppointment = currentScheduleData.find(appt => appt.id === draggedAppointmentId);

        if (!originalAppointment) {
            showAlert('الموعد الأصلي لم يتم العثور عليه.', 'danger');
            return;
        }

        const updatedAppointment = { ...originalAppointment, day: newDay, timeRange: newTime };

        const tempSchedule = currentScheduleData.filter(appt => appt.id !== draggedAppointmentId);
        const conflicts = checkConflicts(updatedAppointment, tempSchedule);

        if (conflicts.length > 0) {
            showAlert(`فشل تعديل الجدول: ${conflicts.join(' | ')}`, 'danger');
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
            showAlert('تم تعديل الجدول بنجاح.', 'success');
        }
    }
};

const displayScheduleConflicts = () => {
    const currentScheduleData = getCurrentSchedule();
    const conflicts = validateFullSchedule(currentScheduleData);
    const conflictsDiv = document.getElementById('conflict-alerts');

    document.querySelectorAll('.course-item').forEach(item => item.classList.remove('conflict'));
    document.querySelectorAll('.schedule-cell').forEach(cell => cell.classList.remove('conflict'));

    if (conflicts.length > 0) {
        conflictsDiv.innerHTML = `<h4>تنبيهات التعارض في الجدول:</h4><ul>${conflicts.map(c => `<li>${c}</li>`).join('')}</ul>`;
        conflictsDiv.classList.remove('alert-success');
        conflictsDiv.classList.add('alert-danger');
        conflictsDiv.style.display = 'block';

        conflicts.forEach(conflictMsg => {
            // Attempt to find and highlight the specific conflicted appointment
            // This is a basic approach and might need refinement for complex conflict messages
            const courseMatch = conflictMsg.match(/\[موعد ([^\]]+)\]/);
            if (courseMatch && courseMatch[1]) {
                const conflictingCourseName = courseMatch[1];
                document.querySelectorAll(`.course-item`).forEach(item => {
                    const apptData = getCurrentSchedule().find(appt => appt.id === item.dataset.appointmentId);
                    if (apptData && apptData.courseName === conflictingCourseName) {
                        item.classList.add('conflict');
                        item.closest('.schedule-cell').classList.add('conflict');
                    }
                });
            }
            // Also highlight based on "between X and Y"
            const betweenCoursesMatch = conflictMsg.match(/بين (.+) و (.+) في/);
            if (betweenCoursesMatch && betweenCoursesMatch.length >= 3) {
                const course1Name = betweenCoursesMatch[1].trim();
                const course2Name = betweenCoursesMatch[2].trim();
                document.querySelectorAll(`.course-item`).forEach(item => {
                    const apptData = getCurrentSchedule().find(appt => appt.id === item.dataset.appointmentId);
                    if (apptData && (apptData.courseName === course1Name || apptData.courseName === course2Name)) {
                        item.classList.add('conflict');
                        item.closest('.schedule-cell').classList.add('conflict');
                    }
                });
            }
        });

    } else {
        conflictsDiv.innerHTML = 'لا توجد تعارضات في الجدول الحالي.';
        conflictsDiv.classList.remove('alert-danger');
        conflictsDiv.classList.add('alert-success');
        conflictsDiv.style.display = 'block';
        if (window.alertTimeout) clearTimeout(window.alertTimeout);
        window.alertTimeout = setTimeout(() => {
            conflictsDiv.style.display = 'none';
        }, 3000);
    }
};

// Reports Rendering
const renderReports = () => {
    const currentScheduleData = getCurrentSchedule();
    const evaluation = evaluateSchedule(currentScheduleData);

    if (!reportsSection) return;

    reportsSection.innerHTML = `
        <h2>تقارير وإحصائيات</h2>
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
        // Destroy existing chart instance if any
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
                        rtl: true // Enable RTL for tooltips
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 10,
                        bottom: 10
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
                        rtl: true, // Enable RTL for legend
                        position: 'right', // Place legend on the right for RTL
                        labels: {
                            usePointStyle: true // Use point style for legend items
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 10,
                        bottom: 10
                    }
                }
            }
        });
    }
};

// Professor Schedules Rendering & Printing
const renderProfessorSchedules = () => {
    const professorsData = getProfessors();
    const currentScheduleData = getCurrentSchedule();

    if (!professorSchedulesSection) return;

    professorSchedulesSection.innerHTML = '<h2>جداول الدكاترة</h2>';

    if (professorsData.length === 0) {
        professorSchedulesSection.innerHTML += '<p>لا يوجد دكاترة لعرض جداولهم.</p>';
        return;
    }

    professorsData.forEach(prof => {
        const profDiv = document.createElement('div');
        profDiv.classList.add('professor-schedule-card');
        profDiv.innerHTML = `<h3>جدول الدكتور: ${prof.name}</h3>`;

        const profSchedule = currentScheduleData.filter(appt => appt.professorId === prof.id);

        if (profSchedule.length === 0) {
            profDiv.innerHTML += '<p>لا توجد محاضرات مجدولة لهذا الدكتور.</p>';
        } else {
            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>اليوم</th>
                        <th>الوقت</th>
                        <th>المادة</th>
                        <th>القاعة/المعمل</th>
                        <th>ملاحظات</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector('tbody');

            profSchedule.sort((a, b) => {
                const dayOrder = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
                if (dayOrder !== 0) return dayOrder;
                const timeA = toMinutes(parseTimeRange(a.timeRange).start);
                const timeB = toMinutes(parseTimeRange(b.timeRange).start);
                return timeA - timeB;
            });

            profSchedule.forEach(appt => {
                const row = table.insertRow();
                row.insertCell().textContent = appt.day;
                row.insertCell().textContent = appt.timeRange;
                row.insertCell().textContent = appt.courseName;
                row.insertCell().textContent = appt.roomName;
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
                        <th>ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
        `;
        profSchedule.sort((a, b) => {
            const dayOrder = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
            if (dayOrder !== 0) return dayOrder;
            const timeA = toMinutes(parseTimeRange(a.timeRange).start);
            const timeB = toMinutes(parseTimeRange(b.timeRange).start);
            return timeA - timeB;
        });

        profSchedule.forEach(appt => {
            tableHtml += `
                <tr>
                    <td>${appt.day}</td>
                    <td>${appt.timeRange}</td>
                    <td>${appt.courseName}</td>
                    <td>${appt.roomName}</td>
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
    const scheduleElement = document.getElementById('schedule-view');
    if (!scheduleElement) {
        showAlert("لم يتم العثور على عنصر الجدول للتصدير.", 'danger');
        return;
    }

    showAlert('جاري تصدير الجدول إلى PDF...', 'info');

    if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        showAlert("مكتبات التصدير (jsPDF, html2canvas) غير محملة. يرجى التحقق من الاتصال بالإنترنت.", 'danger');
        return;
    }

    html2canvas(scheduleElement, { scale: 2, useCORS: true }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: 'a4'
        });

        const imgWidth = pdf.internal.pageSize.getWidth();
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save('جدول-المواعيد.pdf');
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
        ["اليوم", "الوقت", "المادة", "الدكتور", "القاعة/المعمل", "النوع", "ملاحظات"]
    ];

    schedule.forEach(appt => {
        data.push([
            appt.day,
            appt.timeRange,
            appt.courseName || appt.courseId,
            appt.professorName || appt.professorId,
            appt.roomName || appt.roomId,
            appt.type,
            appt.notes || ''
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الجدول الدراسي");

    XLSX.writeFile(wb, "جدول-المواعيد.xlsx");
    showAlert('تم تصدير الجدول إلى ملف Excel (.xlsx) بنجاح.', 'success');
};

const exportScheduleToImage = () => {
    const scheduleElement = document.getElementById('schedule-view');
    if (!scheduleElement) {
        showAlert("لم يتم العثور على عنصر الجدول للتصدير.", 'danger');
        return;
    }

    showAlert('جاري تصدير الجدول إلى صورة...', 'info');

    if (typeof html2canvas === 'undefined') {
        showAlert("مكتبة html2canvas غير محملة. يرجى التحقق من الاتصال بالإنترنت.", 'danger');
        return;
    }

    html2canvas(scheduleElement, { scale: 2, useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'جدول-المواعيد.png';
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
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(e.target.dataset.section);
        });
    });

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
            renderProfessorList();
            renderDataEntryForms();
            professorForm.reset();
            showAlert('تم إضافة الدكتور بنجاح.', 'success');
        });
    }

    if (roomForm) {
        roomForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(roomForm);
            const newRoom = {
                name: formData.get('roomName'),
                type: formData.get('roomType'),
                availableTimes: formData.get('roomAvailableTimes').split(',').map(s => s.trim()).filter(s => s),
                locationGroup: formData.get('roomLocationGroup') || '' // Capture new field
            };
            addRoom(newRoom);
            renderRoomList();
            roomForm.reset();
            showAlert('تم إضافة القاعة/المعمل بنجاح.', 'success');
        });
    }

    if (courseForm) {
        courseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(courseForm);
            const newCourse = {
                name: formData.get('courseName'),
                professorId: formData.get('courseProfessorId'),
                hours: parseInt(formData.get('courseHours')) || 0,
                labHours: parseInt(formData.get('courseLabHours')) || 0,
                preferredTimes: formData.get('coursePreferredTimes') ? formData.get('coursePreferredTimes').split(',').map(s => s.trim()).filter(s => s) : [],
                notes: formData.get('courseNotes') || ''
            };
            addCourse(newCourse);
            renderCourseList();
            courseForm.reset();
            showAlert('تم إضافة المادة بنجاح.', 'success');
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            const type = e.target.dataset.type;
            if (confirm(`هل أنت متأكد من حذف هذا الـ ${type}؟`)) {
                if (type === 'professor') deleteProfessor(id);
                else if (type === 'room') deleteRoom(id);
                else if (type === 'course') deleteCourse(id);
                renderProfessorList();
                renderRoomList();
                renderCourseList();
                renderDataEntryForms();
                showAlert(`تم حذف الـ ${type} بنجاح.`, 'success');
            }
        }
        // TODO: Implement edit functionality (e.g., populate form with existing data) for data entry lists
        if (e.target.classList.contains('edit-btn')) {
            const id = e.target.dataset.id;
            const type = e.target.dataset.type;
            showAlert(`ميزة التعديل المباشر من القائمة لـ ${type} غير متاحة بعد، يرجى التعديل عبر النقر على الحصة في الجدول أو حذف وإعادة إضافة.`, 'info');
        }
    });

    if (uploadProfessorsInput) {
        uploadProfessorsInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await uploadFile(file, 'professors');
                    showAlert('تم رفع ملف الدكاترة بنجاح.', 'success');
                    renderProfessorList();
                    renderDataEntryForms();
                } catch (error) {
                    showAlert(`خطأ في رفع ملف الدكاترة: ${error}`, 'danger');
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
                    renderRoomList();
                } catch (error) {
                    showAlert(`خطأ في رفع ملف القاعات: ${error}`, 'danger');
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
                    renderCourseList();
                    renderDataEntryForms();
                } catch (error) {
                    showAlert(`خطأ في رفع ملف المواد: ${error}`, 'danger');
                }
            }
        });
    }

    if (generateScheduleBtn) {
        generateScheduleBtn.addEventListener('click', () => {
            showAlert('جاري توليد الجدول، قد يستغرق بعض الوقت...', 'info');
            const { schedule, unassignedCourses, conflicts } = generateSchedule();
            renderScheduleGrid();
            if (conflicts.length === 0 && unassignedCourses.length === 0) {
                showAlert('تم توليد الجدول بنجاح!', 'success');
            } else {
                let msg = 'تم توليد الجدول مع بعض المشاكل: ';
                if (conflicts.length > 0) msg += ` ${conflicts.length} تعارضات.`;
                if (unassignedCourses.length > 0) msg += ` ${unassignedCourses.length} مواد لم يتم جدولتها.`;
                showAlert(msg, 'warning');
            }
        });
    }

    if (saveCurrentScheduleBtn) {
        saveCurrentScheduleBtn.addEventListener('click', () => {
            const scheduleName = prompt("أدخل اسماً للجدول الذي تريد حفظه:");
            if (scheduleName) {
                saveScheduleVersion(scheduleName);
            }
        });
    }

    if (loadSavedSchedulesBtn) {
        loadSavedSchedulesBtn.addEventListener('click', () => {
            const saved = getSavedSchedules();
            if (saved.length === 0) {
                showAlert('لا توجد جداول محفوظة.', 'info');
                return;
            }

            let message = "اختر جدول للتحميل (أدخل الرقم):\n";
            saved.forEach((s, index) => {
                message += `${index + 1}. ${s.name} (${new Date(s.timestamp).toLocaleString()})\n`;
            });

            const choice = prompt(message);
            const index = parseInt(choice) - 1;

            if (!isNaN(index) && saved[index]) {
                loadScheduleVersion(saved[index].id);
                renderScheduleGrid();
            } else if (choice !== null) {
                showAlert('اختيار غير صالح أو تم الإلغاء.', 'warning');
            }
        });
    }

    if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportScheduleToPDF);
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportScheduleToExcel);
    if (exportImageBtn) exportImageBtn.addEventListener('click', exportScheduleToImage);

    // Modal close button
    if (closeButton) {
        closeButton.addEventListener('click', closeEditModal);
    }
    // Close modal if clicked outside content
    if (editAppointmentModal) {
        window.addEventListener('click', (event) => {
            if (event.target === editAppointmentModal) {
                closeEditModal();
            }
        });
    }

    // Edit appointment form submission
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
                showAlert(`فشل حفظ التعديلات: ${conflicts.join(' | ')}`, 'danger');
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
                showAlert('تم حفظ التعديلات بنجاح.', 'success');
            }
        });
    }

    // Delete appointment from modal
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
};

const initializeApp = () => {
    loadData();
    // Initialize dummy data only if storage is empty
    if (getProfessors().length === 0 && getRooms().length === 0 && getCourses().length === 0) {
        initializeDummyData();
    }
    setupEventListeners();
    showSection('data-entry'); // Default starting section
};

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
