// js/main.js

import { loadData, saveData, initializeDummyData, academicPeriod } from './dataManager.js';
import { setAlertDiv, calculateTimeSlotsMinutes, parseTimeRange } from './utils.js';
import { generateSchedule, optimizeScheduleForGaps, fixAllConflictsAutomatically } from './scheduler.js';
import { TIME_SLOTS } from './constants.js';

// استيراد الدوال من uiManager.js التي تتطلب عناصر DOM كمعاملات أو تقوم بالتعامل معها محلياً
import {
    showSection, renderDataEntryForms, populateDatalists, renderProfessorList, renderRoomList, renderCourseList,
    renderScheduleGrid, openEditModal, closeEditModal, displayConflicts, // تم تغيير displayConflicts
    renderReports, renderProfessorSchedules, exportScheduleToPDF, exportScheduleToExcel, exportScheduleToImage
} from './uiManager.js';


/**
 * تهيئة التطبيق لكل صفحة HTML على حدة.
 * تُستدعى هذه الدالة من وسم <script> في كل ملف HTML بعد تحميل DOM.
 * @param {string} currentPageId - معرف القسم/الصفحة الحالي (مثال: 'data-entry', 'schedule-view', 'reports')
 */
export const initializeAppPage = (currentPageId) => {
    // تحميل البيانات المشتركة لجميع الصفحات
    loadData();
    // تهيئة البيانات الوهمية إذا كانت لا توجد بيانات
    import('./dataManager.js').then(module => {
        if (module.getProfessors().length === 0 && module.getRooms().length === 0 && module.getCourses().length === 0) {
            module.initializeDummyData();
        }
        calculateTimeSlotsMinutes(); // حساب دقائق الفترات الزمنية بعد تحميل أو تهيئة البيانات
    });

    // إعداد عنصر div التنبيه العالمي في utils
    const conflictAlertsDiv = document.getElementById('conflict-alerts');
    if (conflictAlertsDiv) {
        setAlertDiv(conflictAlertsDiv);
    }

    // تهيئة عناصر DOM ومستمعي الأحداث بناءً على الصفحة الحالية
    if (currentPageId === 'data-entry') {
        const professorForm = document.getElementById('professor-form');
        const roomForm = document.getElementById('room-form');
        const courseForm = document.getElementById('course-form');
        const globalSearchInput = document.getElementById('global-search');

        const courseProfessorSelect = document.getElementById('course-professor-id');
        const profNamesSuggestions = document.getElementById('prof-names-suggestions');
        const roomNamesSuggestions = document.getElementById('room-names-suggestions');
        const courseNamesSuggestions = document.getElementById('course-names-suggestions');
        const departmentSuggestions = document.getElementById('department-suggestions');

        const professorListDiv = document.getElementById('professor-list');
        const roomListDiv = document.getElementById('room-list');
        const courseListDiv = document.getElementById('course-list');

        const uploadProfessorsInput = document.getElementById('upload-professors');
        const uploadRoomsInput = document.getElementById('upload-rooms');
        const uploadCoursesInput = document.getElementById('upload-courses');


        // الربط بين الدوال ومستمعي الأحداث لصفحة إدخال البيانات
        if (professorForm) {
            professorForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(professorForm);
                const newProf = { name: formData.get('profName'), availableTimes: formData.get('profAvailableTimes').split(',').map(s => s.trim()).filter(s => s), priority: parseInt(formData.get('profPriority')) || 0, preferences: { noFriday: formData.get('profNoFriday') === 'on' } };
                import('./dataManager.js').then(module => { module.addProfessor(newProf); renderProfessorList(professorListDiv, globalSearchInput.value); renderDataEntryForms(courseProfessorSelect); professorForm.reset(); showAlert('تم إضافة الدكتور بنجاح.', 'success'); populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions); });
            });
        }
        if (roomForm) {
             roomForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(roomForm);
                const newRoom = { name: formData.get('roomName'), type: formData.get('roomType'), availableTimes: formData.get('roomAvailableTimes').split(',').map(s => s.trim()).filter(s => s), locationGroup: formData.get('roomLocationGroup') || '' };
                import('./dataManager.js').then(module => { module.addRoom(newRoom); renderRoomList(roomListDiv, globalSearchInput.value); roomForm.reset(); showAlert('تم إضافة القاعة/المعمل بنجاح.', 'success'); populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions); });
            });
        }
        if (courseForm) {
            courseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(courseForm);
                const newCourse = { name: formData.get('courseName'), sectionName: formData.get('courseSectionName') || '', department: formData.get('courseDepartment') || '', professorId: formData.get('courseProfessorId'), hours: parseInt(formData.get('courseHours')) || 0, labHours: parseInt(formData.get('courseLabHours')) || 0, preferredTimes: formData.get('coursePreferredTimes') ? formData.get('coursePreferredTimes').split(',').map(s => s.trim()).filter(s => s) : [], notes: formData.get('courseNotes') || '' };
                import('./dataManager.js').then(module => { module.addCourse(newCourse); renderCourseList(courseListDiv, globalSearchInput.value); renderDataEntryForms(courseProfessorSelect); courseForm.reset(); showAlert('تم إضافة المادة بنجاح.', 'success'); populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions); });
            });
        }
        if (globalSearchInput) {
            globalSearchInput.addEventListener('input', () => {
                const searchTerm = globalSearchInput.value;
                renderProfessorList(professorListDiv, searchTerm);
                renderRoomList(roomListDiv, searchTerm);
                renderCourseList(courseListDiv, searchTerm);
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) {
                const btn = e.target.closest('.delete-btn');
                const id = btn.dataset.id;
                const type = btn.dataset.type;
                if (confirm(`هل أنت متأكد من حذف هذا الـ ${type}؟ هذا سيؤثر على الجداول الحالية.`)) {
                    import('./dataManager.js').then(module => {
                        if (type === 'professor') module.deleteProfessor(id);
                        else if (type === 'room') module.deleteRoom(id);
                        else if (type === 'course') module.deleteCourse(id);
                        renderProfessorList(professorListDiv, globalSearchInput.value);
                        renderRoomList(roomListDiv, globalSearchInput.value);
                        renderCourseList(courseListDiv, globalSearchInput.value);
                        renderDataEntryForms(courseProfessorSelect);
                        showAlert(`تم حذف الـ ${type} بنجاح.`, 'success');
                        populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions);
                    });
                }
            }
            if (e.target.closest('.edit-btn')) {
                const btn = e.target.closest('.edit-btn');
                const id = btn.dataset.id;
                const type = btn.dataset.type;
                showAlert(`ميزة التعديل المباشر من القائمة لـ ${type} غير متاحة بعد. يرجى التعديل عبر النقر على الحصة في الجدول أو حذف وإعادة إضافة.`, 'info');
            }
        });

        if (document.getElementById('upload-professors')) {
            document.getElementById('upload-professors').addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try { await import('./dataManager.js').then(module => module.uploadFile(file, 'professors')); showAlert('تم رفع ملف الدكاترة بنجاح.', 'success'); renderProfessorList(professorListDiv, globalSearchInput.value); renderDataEntryForms(courseProfessorSelect); populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions); } catch (error) { showAlert(`خطأ في رفع ملف الدكاترة: ${error}`, 'danger'); } finally { e.target.value = ''; }
                }
            });
        }
        if (document.getElementById('upload-rooms')) {
            document.getElementById('upload-rooms').addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try { await import('./dataManager.js').then(module => module.uploadFile(file, 'rooms')); showAlert('تم رفع ملف القاعات بنجاح.', 'success'); renderRoomList(roomListDiv, globalSearchInput.value); populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions); } catch (error) { showAlert(`خطأ في رفع ملف القاعات: ${error}`, 'danger'); } finally { e.target.value = ''; }
                }
            });
        }
        if (document.getElementById('upload-courses')) {
            document.getElementById('upload-courses').addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try { await import('./dataManager.js').then(module => module.uploadFile(file, 'courses')); showAlert('تم رفع ملف المواد بنجاح.', 'success'); renderCourseList(courseListDiv, globalSearchInput.value); renderDataEntryForms(courseProfessorSelect); populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions); } catch (error) { showAlert(`خطأ في رفع ملف المواد: ${error}`, 'danger'); } finally { e.target.value = ''; }
                }
            });
        }

        // العرض الأولي للقوائم وعناصر الداتاليست عند تحميل الصفحة
        renderProfessorList(professorListDiv, '');
        renderRoomList(roomListDiv, '');
        renderCourseList(courseListDiv, '');
        renderDataEntryForms(courseProfessorSelect);
        populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions);


    } else if (currentPageId === 'schedule-view') {
        const generateScheduleBtn = document.getElementById('generate-schedule');
        const optimizeScheduleBtn = document.getElementById('optimize-schedule-btn');
        const fixAllConflictsBtn = document.getElementById('fix-all-conflicts-btn');
        const saveCurrentScheduleBtn = document.getElementById('save-current-schedule');
        const loadSavedSchedulesBtn = document.getElementById('load-saved-schedules');

        const scheduleGrid = document.getElementById('schedule-grid'); // عنصر خاص بهذه الصفحة
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


        if (generateScheduleBtn) {
            generateScheduleBtn.addEventListener('click', () => {
                showAlert('جاري توليد الجدول، قد يستغرق بعض الوقت...', 'info');
                import('./scheduler.js').then(module => {
                    const { schedule, unassignedCourses, conflicts } = module.generateSchedule();
                    renderScheduleGrid(scheduleGrid, editAppointmentModal, editApptOriginalId, editApptCourseName, editApptProfessorId, editApptRoomId, editApptDay, editApptTimeRange, editApptNotes);
                    if (conflicts.length === 0 && unassignedCourses.length === 0) {
                        showAlert('تم توليد الجدول بنجاح!', 'success');
                    } else {
                        let msg = 'تم توليد الجدول مع بعض المشاكل: ';
                        if (unassignedCourses.length > 0) msg += `<br> ${unassignedCourses.length} مواد/وحدات لم يتم جدولتها.`;
                        if (conflicts.length > 0) msg += `<br> ${conflicts.length} تعارضات في الجدول النهائي.`;
                        showAlert(msg, 'warning');
                    }
                });
            });
        }
        if (optimizeScheduleBtn) {
            optimizeScheduleBtn.addEventListener('click', () => {
                import('./scheduler.js').then(module => {
                    module.optimizeScheduleForGaps();
                    renderScheduleGrid(scheduleGrid, editAppointmentModal, editApptOriginalId, editApptCourseName, editApptProfessorId, editApptRoomId, editApptDay, editApptTimeRange, editApptNotes);
                });
            });
        }
        if (fixAllConflictsBtn) {
            fixAllConflictsBtn.addEventListener('click', () => {
                import('./scheduler.js').then(module => {
                    module.fixAllConflictsAutomatically();
                    renderScheduleGrid(scheduleGrid, editAppointmentModal, editApptOriginalId, editApptCourseName, editApptProfessorId, editApptRoomId, editApptDay, editApptTimeRange, editApptNotes);
                });
            });
        }
        if (saveCurrentScheduleBtn) {
            saveCurrentScheduleBtn.addEventListener('click', () => {
                import('./dataManager.js').then(module => {
                    const scheduleName = prompt(`أدخل اسماً للجدول الذي تريد حفظه (الفصل: ${module.academicPeriod.semester}، السنة: ${module.academicPeriod.year}):`);
                    if (scheduleName) {
                        module.saveScheduleVersion(scheduleName);
                    }
                });
            });
        }
        if (loadSavedSchedulesBtn) {
            loadSavedSchedulesBtn.addEventListener('click', () => {
                import('./dataManager.js').then(module => {
                    const saved = module.getSavedSchedules();
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
                        module.loadScheduleVersion(saved[index].id);
                        renderScheduleGrid(scheduleGrid, editAppointmentModal, editApptOriginalId, editApptCourseName, editApptProfessorId, editApptRoomId, editApptDay, editApptTimeRange, editApptNotes);
                    } else if (choice !== null && choice !== "") {
                        showAlert('اختيار غير صالح أو تم الإلغاء.', 'warning');
                    }
                });
            });
        }
        if (closeButton) { closeButton.addEventListener('click', () => closeEditModal(editAppointmentModal)); }
        if (editAppointmentModal) {
            window.addEventListener('click', (event) => { if (event.target === editAppointmentModal) { closeEditModal(editAppointmentModal); } });
        }
        if (editAppointmentForm) {
            editAppointmentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const originalApptId = editApptOriginalId.value;
                import('./dataManager.js').then(dataModule => {
                    const currentScheduleData = dataModule.getCurrentSchedule();
                    const originalAppointmentIndex = currentScheduleData.findIndex(appt => appt.id === originalApptId);
                    if (originalAppointmentIndex === -1) { showAlert('لم يتم العثور على الموعد الأصلي للتعديل.', 'danger'); closeEditModal(editAppointmentModal); return; }
                    const updatedFields = { professorId: editApptProfessorId.value, roomId: editApptRoomId.value, day: editApptDay.value, timeRange: editApptTimeRange.value, notes: editApptNotes.value };
                    const updatedAppointment = { ...currentScheduleData[originalAppointmentIndex], ...updatedFields };
                    import('./scheduler.js').then(schedulerModule => {
                        const tempSchedule = currentScheduleData.filter(appt => appt.id !== originalApptId);
                        const conflicts = schedulerModule.checkConflicts(updatedAppointment, tempSchedule);
                        if (conflicts.length > 0) {
                            showAlert(`فشل حفظ التعديلات بسبب تعارضات: ${conflicts.join(' | ')}`, 'danger');
                            const suggestions = schedulerModule.suggestAlternativeTimes(updatedAppointment);
                            if (suggestions.length > 0) { showAlert(`اقتراحات لأوقات بديلة: ${suggestions.map(s => `[${s.day} ${s.timeRange} في ${s.room}]`).join(' | ')}`, 'info'); } else { showAlert('لا توجد أوقات بديلة مقترحة.', 'info'); }
                        } else { currentScheduleData[originalAppointmentIndex] = updatedAppointment; dataModule.setCurrentSchedule(currentScheduleData); renderScheduleGrid(scheduleGrid, editAppointmentModal, editApptOriginalId, editApptCourseName, editApptProfessorId, editApptRoomId, editApptDay, editApptTimeRange, editApptNotes); closeEditModal(editAppointmentModal); showAlert('تم حفظ التعديلات بنجاح!', 'success'); }
                    });
                });
            });
        }
        if (deleteApptBtn) {
            deleteApptBtn.addEventListener('click', () => {
                if (confirm('هل أنت متأكد من حذف هذا الموعد؟')) {
                    const apptIdToDelete = editApptOriginalId.value;
                    import('./dataManager.js').then(module => {
                        const currentScheduleData = module.getCurrentSchedule();
                        const updatedSchedule = currentScheduleData.filter(appt => appt.id !== apptIdToDelete);
                        module.setCurrentSchedule(updatedSchedule);
                        renderScheduleGrid(scheduleGrid, editAppointmentModal, editApptOriginalId, editApptCourseName, editApptProfessorId, editApptRoomId, editApptDay, editApptTimeRange, editApptNotes);
                        closeEditModal(editAppointmentModal);
                        showAlert('تم حذف الموعد بنجاح.', 'success');
                    });
                }
            });
        }
        // العرض الأولي لشبكة الجداول عند تحميل الصفحة
        renderScheduleGrid(scheduleGrid, editAppointmentModal, editApptOriginalId, editApptCourseName, editApptProfessorId, editApptRoomId, editApptDay, editApptTimeRange, editApptNotes);

    } else if (currentPageId === 'reports') {
        const reportsSection = document.getElementById('reports');
        if(reportsSection) {
            renderReports(reportsSection);
        }
    } else if (currentPageId === 'professor-schedules') {
        const professorSchedulesSection = document.getElementById('professor-schedules');
        if(professorSchedulesSection) {
            renderProfessorSchedules(professorSchedulesSection);
        }
    } else if (currentPageId === 'settings') {
        const timeSlotsForm = document.getElementById('time-slots-form');
        const customTimeSlotsTextArea = document.getElementById('custom-time-slots');
        const academicPeriodForm = document.getElementById('academic-period-form');
        const currentAcademicYearInput = document.getElementById('current-academic-year');
        const currentAcademicSemesterInput = document.getElementById('current-academic-semester');
        const exportPdfBtn = document.getElementById('export-pdf');
        const exportExcelBtn = document.getElementById('export-excel');
        const exportImageBtn = document.getElementById('export-image');

        if (customTimeSlotsTextArea) { customTimeSlotsTextArea.value = TIME_SLOTS.join('\n'); }
        if (currentAcademicYearInput) { currentAcademicYearInput.value = academicPeriod.year; }
        if (currentAcademicSemesterInput) { currentAcademicSemesterInput.value = academicPeriod.semester; }

        if (timeSlotsForm) {
            timeSlotsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const newTimeSlots = customTimeSlotsTextArea.value.split('\n').map(s => s.trim()).filter(s => s && parseTimeRange(s));
                if (newTimeSlots.length > 0) {
                    TIME_SLOTS.splice(0, TIME_SLOTS.length, ...newTimeSlots);
                    calculateTimeSlotsMinutes();
                    import('./dataManager.js').then(module => module.saveData());
                    showAlert('تم تحديث الفترات الزمنية بنجاح!', 'success');
                } else { showAlert('الرجاء إدخال فترات زمنية صالحة.', 'danger'); }
            });
        }
        if (academicPeriodForm) {
            academicPeriodForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const newYear = parseInt(currentAcademicYearInput.value);
                const newSemester = currentAcademicSemesterInput.value;
                if (!isNaN(newYear) && newSemester) {
                    academicPeriod.year = newYear; academicPeriod.semester = newSemester;
                    import('./dataManager.js').then(module => module.saveData());
                    showAlert('تم حفظ الفترة الأكاديمية بنجاح!', 'success');
                } else { showAlert('الرجاء إدخال سنة وفصل دراسي صحيحين.', 'danger'); }
            });
        }
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => {
                // في صفحة الإعدادات، لا يوجد schedule-view، لذلك نستخدم main section أو نطلب من المستخدم الانتقال لصفحة الجدول
                showAlert('لتصدير الجدول، يرجى الانتقال إلى صفحة "عرض الجداول" أولاً.', 'info');
                // const scheduleViewSection = document.getElementById('schedule-view');
                // exportScheduleToPDF(scheduleViewSection || document.querySelector('main section.active-section'));
            });
        }
        if (exportExcelBtn) { exportExcelBtn.addEventListener('click', exportScheduleToExcel); }
        if (exportImageBtn) {
            exportImageBtn.addEventListener('click', () => {
                // في صفحة الإعدادات، لا يوجد schedule-view
                showAlert('لتصدير الجدول كصورة، يرجى الانتقال إلى صفحة "عرض الجداول" أولاً.', 'info');
                // const scheduleViewSection = document.getElementById('schedule-view');
                // exportScheduleToImage(scheduleViewSection || document.querySelector('main section.active-section'));
            });
        }

    } else if (currentPageId === 'index') {
        // لا يوجد منطق تهيئة خاص بـ index.html بخلاف الروابط الثابتة وعناصر لوحة التحكم
        // لا توجد نماذج أو قوائم تتطلب تهيئة هنا
    }
};

document.addEventListener('DOMContentLoaded', () => {
    let currentPageId = document.body.id || 'index';
    const mainSection = document.querySelector('main section.active-section');
    if(mainSection) {
        currentPageId = mainSection.id;
    }

    import('./dataManager.js').then(module => {
        module.loadData();
        // تهيئة البيانات الوهمية إذا كانت لا توجد بيانات
        if (module.getProfessors().length === 0 && module.getRooms().length === 0 && module.getCourses().length === 0) {
            module.initializeDummyData();
        }
        calculateTimeSlotsMinutes(); // حساب الدقائق بعد تحميل البيانات أو تهيئة الوهمية

        initializeAppPage(currentPageId);
    });
});
