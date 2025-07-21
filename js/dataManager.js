// js/dataManager.js

import { STORAGE_KEYS, TIME_SLOTS } from './constants.js';
import { generateUniqueId, showAlert, parseTimeRange, toMinutes } from './utils.js';

export let professors = [];
export let rooms = [];
export let courses = [];
export let schedules = [];
export let currentSchedule = [];
export let academicPeriod = { year: new Date().getFullYear(), semester: 'الأول' };

export const loadData = () => {
    professors = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFESSORS)) || [];
    rooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOMS)) || [];
    courses = JSON.parse(localStorage.getItem(STORAGE_KEYS.COURSES)) || [];
    schedules = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES)) || [];
    currentSchedule = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_SCHEDULE)) || [];
    const savedTimeSlots = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_TIME_SLOTS));
    if (savedTimeSlots && savedTimeSlots.length > 0) {
        TIME_SLOTS.splice(0, TIME_SLOTS.length, ...savedTimeSlots); // تحديث TIME_SLOTS المستوردة
    }
    academicPeriod = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACADEMIC_PERIOD)) || academicPeriod;

    // يُفترض أن calculateTimeSlotsMinutes سيتم استدعاؤها بعد تحميل البيانات
    console.log("Data loaded:", { professors, rooms, courses, currentSchedule, schedules, TIME_SLOTS, academicPeriod });
};

export const saveData = () => {
    localStorage.setItem(STORAGE_KEYS.PROFESSORS, JSON.stringify(professors));
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
    localStorage.setItem(STORAGE_KEYS.CURRENT_SCHEDULE, JSON.stringify(currentSchedule));
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
    localStorage.setItem(STORAGE_KEYS.CUSTOM_TIME_SLOTS, JSON.stringify(TIME_SLOTS)); // حفظ الفترات المخصصة
    localStorage.setItem(STORAGE_KEYS.ACADEMIC_PERIOD, JSON.stringify(academicPeriod));
    console.log("Data saved.");
};

// CRUD for Professors
export const getProfessors = () => professors;
export const addProfessor = (professor) => {
    professor.id = generateUniqueId();
    professors.push(professor);
    saveData();
};
export const updateProfessor = (id, updatedFields) => {
    const index = professors.findIndex(p => p.id === id);
    if (index > -1) {
        professors[index] = { ...professors[index], ...updatedFields };
        saveData();
    }
};
export const deleteProfessor = (id) => {
    professors = professors.filter(p => p.id !== id);
    courses = courses.map(c => c.professorId === id ? { ...c, professorId: null } : c);
    currentSchedule = currentSchedule.filter(appt => appt.professorId !== id);
    saveData();
};

// CRUD for Rooms
export const getRooms = () => rooms;
export const addRoom = (room) => {
    room.id = generateUniqueId();
    rooms.push(room);
    saveData();
};
export const updateRoom = (id, updatedFields) => {
    const index = rooms.findIndex(r => r.id === id);
    if (index > -1) {
        rooms[index] = { ...rooms[index], ...updatedFields };
        saveData();
    }
};
export const deleteRoom = (id) => {
    rooms = rooms.filter(r => r.id !== id);
    currentSchedule = currentSchedule.filter(appt => appt.roomId !== id);
    saveData();
};

// CRUD for Courses
export const getCourses = () => courses;
export const addCourse = (course) => {
    course.id = generateUniqueId();
    courses.push(course);
    saveData();
};
export const updateCourse = (id, updatedFields) => {
    const index = courses.findIndex(c => c.id === id);
    if (index > -1) {
        courses[index] = { ...courses[index], ...updatedFields };
        saveData();
    }
};
export const deleteCourse = (id) => {
    courses = courses.filter(c => c.id !== id);
    currentSchedule = currentSchedule.filter(appt => appt.courseId !== id);
    saveData();
};

// Schedule Management
export const getCurrentSchedule = () => currentSchedule;
export const setCurrentSchedule = (schedule) => {
    currentSchedule = schedule;
    saveData();
};

export const saveScheduleVersion = (name) => {
    if (currentSchedule.length === 0) {
        showAlert('لا يوجد جدول حالي لحفظه كنسخة.', 'warning');
        return;
    }
    // استخدم academicPeriod مباشرة بدلاً من تحميلها مرة أخرى من localStorage
    schedules.push({
        id: generateUniqueId(),
        name: name,
        timestamp: new Date(),
        schedule: [...currentSchedule],
        academicYear: academicPeriod.year,
        academicSemester: academicPeriod.semester
    });
    saveData();
    showAlert(`تم حفظ نسخة من الجدول باسم: ${name}`, 'success');
};

export const getSavedSchedules = () => schedules;

export const loadScheduleVersion = (id) => {
    const saved = schedules.find(s => s.id === id);
    if (saved) {
        setCurrentSchedule(saved.schedule);
        showAlert(`تم تحميل الجدول: ${saved.name}`, 'success');
        return true;
    }
    return false;
};

// CSV/Excel Upload
export const uploadFile = (file, type) => {
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
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    if (json.length < 2) {
                        reject("ملف Excel فارغ أو لا يحتوي على بيانات كافية.");
                        return;
                    }

                    const header = json[0];
                    const rows = json.slice(1);
                    const jsonData = rows.map(row => {
                        const obj = {};
                        header.forEach((h, i) => {
                            obj[h.trim()] = row[i];
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

export const processUploadedData = (data, type, resolve, reject) => {
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
                    department: String(row.department || ''),
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

export const initializeDummyData = () => {
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
    saveData(); // حفظ البيانات الوهمية بعد التهيئة
    console.log("Dummy data initialized and saved.");
};
