// js/main.js

import { loadData, saveData, initializeDummyData, academicPeriod } from './dataManager.js';
import { showSection, renderDataEntryForms, renderProfessorList, renderRoomList, renderCourseList, populateDatalists, globalSearchInput, customTimeSlotsTextArea, timeSlotsForm, academicPeriodForm, currentAcademicYearInput, currentAcademicSemesterInput, generateScheduleBtn, optimizeScheduleBtn, fixAllConflictsBtn, saveCurrentScheduleBtn, loadSavedSchedulesBtn, exportPdfBtn, exportExcelBtn, exportImageBtn, professorForm, roomForm, courseForm, closeButton, deleteApptBtn, editAppointmentForm, conflictAlertsDiv } from './uiManager.js';
import { calculateTimeSlotsMinutes, showAlert, setAlertDiv, parseTimeRange } from './utils.js';
import { generateSchedule, optimizeScheduleForGaps, fixAllConflictsAutomatically } from './scheduler.js';
import { TIME_SLOTS } from './constants.js';


/**
 * Sets up all event listeners for the application.
 */
const setupEventListeners = () => {
    // إعداد عنصر div التنبيه في utils
    setAlertDiv(conflictAlertsDiv);

    // Navigation links
    document.querySelectorAll('nav ul li a').forEach(link => {
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
            // استخدام الدوال من dataManager.js
            import('./dataManager.js').then(module => {
                module.addProfessor(newProf);
                renderProfessorList(globalSearchInput ? globalSearchInput.value : '');
                renderDataEntryForms();
                professorForm.reset();
                showAlert('تم إضافة الدكتور بنجاح.', 'success');
                populateDatalists(); // تحديث اقتراحات الإدخال اليدوي
            });
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
            import('./dataManager.js').then(module => {
                module.addRoom(newRoom);
                renderRoomList(globalSearchInput ? globalSearchInput.value : '');
                roomForm.reset();
                showAlert('تم إضافة القاعة/المعمل بنجاح.', 'success');
                populateDatalists(); // تحديث اقتراحات الإدخال اليدوي
            });
        });
    }

    // Course Form Submission
    if (courseForm) {
        courseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(courseForm);
            const newCourse = {
                name: formData.get('courseName'),
                sectionName: formData.get('courseSectionName') || '',
                department: formData.get('courseDepartment') || '',
                professorId: formData.get('courseProfessorId'),
                hours: parseInt(formData.get('courseHours')) || 0,
                labHours: parseInt(formData.get('courseLabHours')) || 0,
                preferredTimes: formData.get('coursePreferredTimes') ? formData.get('coursePreferredTimes').split(',').map(s => s.trim()).filter(s => s) : [],
                notes: formData.get('courseNotes') || ''
            };
            import('./dataManager.js').then(module => {
                module.addCourse(newCourse);
                renderCourseList(globalSearchInput ? globalSearchInput.value : '');
                renderDataEntryForms();
                courseForm.reset();
                showAlert('تم إضافة المادة بنجاح.', 'success');
                populateDatalists(); // تحديث اقتراحات الإدخال اليدوي
            });
        });
    }

    // Event delegation for delete/edit buttons in data lists
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
                    const currentSearchTerm = globalSearchInput ? globalSearchInput.value : '';
                    renderProfessorList(currentSearchTerm);
                    renderRoomList(currentSearchTerm);
                    renderCourseList(currentSearchTerm);
                    renderDataEntryForms();
                    renderScheduleGrid();
                    showAlert(`تم حذف الـ ${type} بنجاح.`, 'success');
                    populateDatalists(); // تحديث اقتراحات الإدخال اليدوي
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

    // Upload File Inputs
    if (document.getElementById('upload-professors')) {
        document.getElementById('upload-professors').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await import('./dataManager.js').then(module => module.uploadFile(file, 'professors'));
                    showAlert('تم رفع ملف الدكاترة بنجاح.', 'success');
                    renderProfessorList(globalSearchInput ? globalSearchInput.value : '');
                    renderDataEntryForms();
                    populateDatalists(); // تحديث اقتراحات الإدخال اليدوي
                } catch (error) {
                    showAlert(`خطأ في رفع ملف الدكاترة: ${error}`, 'danger');
                } finally {
                    e.target.value = '';
                }
            }
        });
    }
    if (document.getElementById('upload-rooms')) {
        document.getElementById('upload-rooms').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await import('./dataManager.js').then(module => module.uploadFile(file, 'rooms'));
                    showAlert('تم رفع ملف القاعات بنجاح.', 'success');
                    renderRoomList(globalSearchInput ? globalSearchInput.value : '');
                    populateDatalists(); // تحديث اقتراحات الإدخال اليدوي
                } catch (error) {
                    showAlert(`خطأ في رفع ملف القاعات: ${error}`, 'danger');
                } finally {
                    e.target.value = '';
                }
            }
        });
    }
    if (document.getElementById('upload-courses')) {
        document.getElementById('upload-courses').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await import('./dataManager.js').then(module => module.uploadFile(file, 'courses'));
                    showAlert('تم رفع ملف المواد بنجاح.', 'success');
                    renderCourseList(globalSearchInput ? globalSearchInput.value : '');
                    renderDataEntryForms();
                    populateDatalists(); // تحديث اقتراحات الإدخال اليدوي
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
            import('./scheduler.js').then(module => {
                const { schedule, unassignedCourses, conflicts } = module.generateSchedule();
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
        });
    }

    // زر تحسين الجدول
    if (optimizeScheduleBtn) {
        optimizeScheduleBtn.addEventListener('click', () => {
            import('./scheduler.js').then(module => {
                module.optimizeScheduleForGaps();
                renderScheduleGrid(); // إعادة عرض بعد التحسين
            });
        });
    }

    // زر إصلاح جميع التعارضات
    if (fixAllConflictsBtn) {
        fixAllConflictsBtn.addEventListener('click', () => {
            import('./scheduler.js').then(module => {
                module.fixAllConflictsAutomatically();
                renderScheduleGrid(); // إعادة عرض بعد الإصلاح
            });
        });
    }

    // Save Current Schedule Version Button
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

    // Load Saved Schedules Button
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
                    renderScheduleGrid();
                } else if (choice !== null && choice !== "") {
                    showAlert('اختيار غير صالح أو تم الإلغاء.', 'warning');
                }
            });
        });
    }

    // Export Buttons
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => {
        import('./uiManager.js').then(module => module.exportScheduleToPDF());
    });
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', () => {
        import('./uiManager.js').then(module => module.exportScheduleToExcel());
    });
    if (exportImageBtn) exportImageBtn.addEventListener('click', () => {
        import('./uiManager.js').then(module => module.exportScheduleToImage());
    });

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
            import('./dataManager.js').then(dataModule => {
                const currentScheduleData = dataModule.getCurrentSchedule();
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

                import('./scheduler.js').then(schedulerModule => {
                    const tempSchedule = currentScheduleData.filter(appt => appt.id !== originalApptId);
                    const conflicts = schedulerModule.checkConflicts(updatedAppointment, tempSchedule);

                    if (conflicts.length > 0) {
                        showAlert(`فشل حفظ التعديلات بسبب تعارضات: ${conflicts.join(' | ')}`, 'danger');
                        const suggestions = schedulerModule.suggestAlternativeTimes(updatedAppointment);
                        if (suggestions.length > 0) {
                            showAlert(`اقتراحات لأوقات بديلة: ${suggestions.map(s => `[${s.day} ${s.timeRange} في ${s.room}]`).join(' | ')}`, 'info');
                        } else {
                            showAlert('لا توجد أوقات بديلة مقترحة.', 'info');
                        }
                    } else {
                        currentScheduleData[originalAppointmentIndex] = updatedAppointment;
                        dataModule.setCurrentSchedule(currentScheduleData);
                        renderScheduleGrid();
                        closeEditModal();
                        showAlert('تم حفظ التعديلات بنجاح!', 'success');
                    }
                });
            });
        });
    }

    // Delete Appointment Button (inside modal)
    if (deleteApptBtn) {
        deleteApptBtn.addEventListener('click', () => {
            if (confirm('هل أنت متأكد من حذف هذا الموعد؟')) {
                const apptIdToDelete = editApptOriginalId.value;
                import('./dataManager.js').then(module => {
                    const currentScheduleData = module.getCurrentSchedule();
                    const updatedSchedule = currentScheduleData.filter(appt => appt.id !== apptIdToDelete);
                    module.setCurrentSchedule(updatedSchedule);
                    renderScheduleGrid();
                    closeEditModal();
                    showAlert('تم حذف الموعد بنجاح.', 'success');
                });
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
                // تحديث TIME_SLOTS المستوردة في constants.js
                TIME_SLOTS.splice(0, TIME_SLOTS.length, ...newTimeSlots);
                calculateTimeSlotsMinutes(); // إعادة حساب الدقائق
                import('./dataManager.js').then(module => module.saveData()); // حفظ البيانات بعد التحديث
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
                // تحديث academicPeriod المستوردة في dataManager.js
                academicPeriod.year = newYear;
                academicPeriod.semester = newSemester;
                import('./dataManager.js').then(module => module.saveData()); // حفظ البيانات بعد التحديث
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
export const initializeApp = () => {
    import('./dataManager.js').then(module => {
        module.loadData();
        if (module.getProfessors().length === 0 && module.getRooms().length === 0 && module.getCourses().length === 0) {
            module.initializeDummyData();
        }
        calculateTimeSlotsMinutes(); // حساب الدقائق بعد تحميل البيانات أو تهيئة الوهمية
        setupEventListeners();
        showSection('data-entry');
        const currentSearchTerm = globalSearchInput ? globalSearchInput.value : '';
        renderProfessorList(currentSearchTerm);
        renderRoomList(currentSearchTerm);
        renderCourseList(currentSearchTerm);
        populateDatalists();
    });
};
