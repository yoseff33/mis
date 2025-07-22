// js/uiManager.js

import { DAYS, TIME_SLOTS } from './constants.js'; // لم نعد نستورد TIME_SLOTS_MINUTES هنا
import { getProfessors, getRooms, getCourses, getCurrentSchedule, setCurrentSchedule, getSavedSchedules, academicPeriod } from './dataManager.js';
import { parseTimeRange, toMinutes, showAlert, setAlertDiv, isTimeConflict, generateUniqueId } from './utils.js'; // تمت إزالة calculateTimeSlotsMinutes
import { checkConflicts, validateFullSchedule, evaluateSchedule, suggestAlternativeTimes } from './scheduler.js';

// لم نعد نصدر عناصر DOM من هنا، سيتم اختيارها في main.js

/**
 * يظهر قسمًا معينًا ويحدث التنقل (لم يعد يستخدم لتبديل الأقسام في SPA، بل لتهيئة الصفحة)
 * @param {string} sectionId - ID القسم المراد تهيئته/عرضه.
 * (في هيكلية MPA، هذه الدالة تُستخدم لتوجيه التهيئة، لا للتبديل بين أقسام نفس الصفحة)
 */
export const showSection = (sectionId) => {
    // في هيكلية MPA، لا نحتاج لتشغيل هذا المنطق هنا لأنه يتم تحميل صفحة جديدة
    // ومع ذلك، قد تظل هذه الدالة مفيدة في main.js لتوجيه التهيئة الأولية
    console.log(`Initializing section: ${sectionId}`);
};

export const renderDataEntryForms = (courseProfessorSelectElement) => {
    const professorsData = getProfessors();
    if (courseProfessorSelectElement) {
        courseProfessorSelectElement.innerHTML = '<option value="">اختر دكتور</option>';
        professorsData.forEach(prof => {
            const option = document.createElement('option');
            option.value = prof.id;
            option.textContent = prof.name;
            courseProfessorSelectElement.appendChild(option);
        });
    }
};

export const populateDatalists = (profNamesSuggestionsElement, roomNamesSuggestionsElement, courseNamesSuggestionsElement, departmentSuggestionsElement) => {
    if (profNamesSuggestionsElement) {
        profNamesSuggestionsElement.innerHTML = getProfessors().map(prof => `<option value="${prof.name}">`).join('');
    }
    if (roomNamesSuggestionsElement) {
        roomNamesSuggestionsElement.innerHTML = getRooms().map(room => `<option value="${room.name}">`).join('');
    }
    if (courseNamesSuggestionsElement) {
        courseNamesSuggestionsElement.innerHTML = getCourses().map(course => `<option value="${course.name}">`).join('');
    }
    if (departmentSuggestionsElement) {
        const uniqueDepartments = [...new Set(getCourses().map(course => course.department).filter(dep => dep))];
        departmentSuggestionsElement.innerHTML = uniqueDepartments.map(dep => `<option value="${dep}">`).join('');
    }
};


export const renderProfessorList = (professorListDivElement, searchTerm = '') => {
    const professorsData = getProfessors();
    if (!professorListDivElement) return;

    professorListDivElement.innerHTML = '<h3>قائمة الدكاترة</h3>';
    if (professorsData.length === 0) {
        professorListDivElement.innerHTML += '<p class="text-secondary">لا يوجد دكاترة بعد. استخدم النموذج أعلاه لإضافة دكتور.</p>';
        return;
    }
    const ul = document.createElement('ul');
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const filteredProfessors = professorsData.filter(prof =>
        prof.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        prof.availableTimes.some(time => time.toLowerCase().includes(lowerCaseSearchTerm))
    );

    if (filteredProfessors.length === 0 && searchTerm !== '') {
        ul.innerHTML = '<p class="text-secondary">لا توجد نتائج بحث مطابقة.</p>';
    } else {
        filteredProfessors.forEach(prof => {
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
    professorListDivElement.appendChild(ul);
};

export const renderRoomList = (roomListDivElement, searchTerm = '') => {
    const roomsData = getRooms();
    if (!roomListDivElement) return;

    roomListDivElement.innerHTML = '<h3>قائمة القاعات والمعامل</h3>';
    if (roomsData.length === 0) {
        roomListDivElement.innerHTML += '<p class="text-secondary">لا توجد قاعات بعد. استخدم النموذج أعلاه لإضافة قاعة/معمل.</p>';
        return;
    }
    const ul = document.createElement('ul');
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const filteredRooms = roomsData.filter(room =>
        room.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        room.type.toLowerCase().includes(lowerCaseSearchTerm) ||
        (room.locationGroup && room.locationGroup.toLowerCase().includes(lowerCaseSearchTerm)) ||
        room.availableTimes.some(time => time.toLowerCase().includes(lowerCaseSearchTerm))
    );

    if (filteredRooms.length === 0 && searchTerm !== '') {
        ul.innerHTML = '<p class="text-secondary">لا توجد نتائج بحث مطابقة.</p>';
    } else {
        filteredRooms.forEach(room => {
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
    roomListDivElement.appendChild(ul);
};

export const renderCourseList = (courseListDivElement, searchTerm = '') => {
    const coursesData = getCourses();
    const professorsData = getProfessors();
    if (!courseListDivElement) return;

    courseListDivElement.innerHTML = '<h3>قائمة المواد</h3>';
    if (coursesData.length === 0) {
        courseListDivElement.innerHTML += '<p class="text-secondary">لا توجد مواد بعد. استخدم النموذج أعلاه لإضافة مادة.</p>';
        return;
    }
    const ul = document.createElement('ul');
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const filteredCourses = coursesData.filter(course => {
        const profName = professorsData.find(p => p.id === course.professorId)?.name || 'غير محدد';
        return course.name.toLowerCase().includes(lowerCaseSearchTerm) ||
               (course.sectionName && course.sectionName.toLowerCase().includes(lowerCaseSearchTerm)) ||
               (course.department && course.department.toLowerCase().includes(lowerCaseSearchTerm)) ||
               profName.toLowerCase().includes(lowerCaseSearchTerm) ||
               (course.notes && course.notes.toLowerCase().includes(lowerCaseSearchTerm)) ||
               course.preferredTimes.some(time => time.toLowerCase().includes(lowerCaseSearchTerm));
    });


    if (filteredCourses.length === 0 && searchTerm !== '') {
        ul.innerHTML = '<p class="text-secondary">لا توجد نتائج بحث مطابقة.</p>';
    } else {
        filteredCourses.forEach(course => {
            const profName = professorsData.find(p => p.id === course.professorId)?.name || 'غير محدد';
            const preferredTimesText = course.preferredTimes.length > 0 ? `(مفضلة: ${course.preferredTimes.join(', ')})` : '';
            const sectionDisplay = course.sectionName ? ` (شعبة: ${course.sectionName})` : '';
            const departmentDisplay = course.department ? ` (قسم: ${course.department})` : '';
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
    courseListDivElement.appendChild(ul);
};

export const openEditModal = (appointmentData, editAppointmentModalElement, editApptOriginalIdElement, editApptCourseNameElement, editApptProfessorIdElement, editApptRoomIdElement, editApptDayElement, editApptTimeRangeElement, editApptNotesElement) => {
    if (!editAppointmentModalElement) return;

    editApptOriginalIdElement.value = appointmentData.id;
    editApptCourseNameElement.value = `${appointmentData.courseName || `مادة ${appointmentData.courseId}`} ${appointmentData.sectionName ? '(' + appointmentData.sectionName + ')' : ''}`;
    editApptNotesElement.value = appointmentData.notes || '';

    editApptProfessorIdElement.innerHTML = '';
    getProfessors().forEach(prof => {
        const option = document.createElement('option');
        option.value = prof.id;
        option.textContent = prof.name;
        if (prof.id === appointmentData.professorId) {
            option.selected = true;
        }
        editApptProfessorIdElement.appendChild(option);
    });

    editApptRoomIdElement.innerHTML = '';
    getRooms().forEach(room => {
        const option = document.createElement('option');
        option.value = room.id;
        option.textContent = room.name;
        if (room.id === appointmentData.roomId) {
            option.selected = true;
        }
        editApptRoomIdElement.appendChild(option);
    });

    editApptDayElement.innerHTML = '';
    DAYS.forEach(day => {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = day;
        if (day === appointmentData.day) {
            option.selected = true;
        }
        editApptDayElement.appendChild(option);
    });

    editApptTimeRangeElement.innerHTML = '';
    TIME_SLOTS.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot;
        option.textContent = slot;
        if (slot === appointmentData.timeRange) {
            option.selected = true;
        }
        editApptTimeRangeElement.appendChild(option);
    });

    editAppointmentModalElement.style.display = 'block';
};

export const closeEditModal = (editAppointmentModalElement) => {
    if (editAppointmentModalElement) {
        editAppointmentModalElement.style.display = 'none';
    }
};

let draggedItem = null;
let draggedAppointmentId = null;

export const renderScheduleGrid = (scheduleGridElement, editAppointmentModalElement, editApptOriginalIdElement, editApptCourseNameElement, editApptProfessorIdElement, editApptRoomIdElement, editApptDayElement, editApptTimeRangeElement, editApptNotesElement) => {
    const currentScheduleData = getCurrentSchedule();
    const professorsData = getProfessors();
    const roomsData = getRooms();

    if (!scheduleGridElement) return;
    scheduleGridElement.innerHTML = '';

    scheduleGridElement.style.gridTemplateColumns = `minmax(120px, 1fr) repeat(${DAYS.length}, 1fr)`;

    scheduleGridElement.appendChild(createGridHeaderCell(''));

    DAYS.forEach(day => {
        scheduleGridElement.appendChild(createGridHeaderCell(day));
    });

    TIME_SLOTS.forEach(timeSlot => {
        scheduleGridElement.appendChild(createGridHeaderCell(timeSlot));

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
                courseDiv.dataset.appointmentId = appt.id;

                if (appt.type === 'lab') {
                    courseDiv.classList.add('lab');
                } else {
                    courseDiv.classList.add('lecture');
                }
                courseDiv.classList.add(`prof-${appt.professorId}`);

                const prof = professorsData.find(p => p.id === appt.professorId);
                const room = roomsData.find(r => r.id === appt.roomId);

                courseDiv.innerHTML = `
                    <strong>${appt.courseName || 'مادة غير معروفة'} ${appt.sectionName ? '(' + appt.sectionName + ')' : ''}</strong><br>
                    <span>د: ${prof ? prof.name : 'غير معروف'}</span><br>
                    <span>ق: ${room ? room.name : 'غير معروف'}</span>
                `;
                cell.appendChild(courseDiv);

                courseDiv.addEventListener('click', () => {
                    openEditModal(appt, editAppointmentModalElement, editApptOriginalIdElement, editApptCourseNameElement, editApptProfessorIdElement, editApptRoomIdElement, editApptDayElement, editApptTimeRangeElement, editApptNotesElement);
                });
            });

            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('drop', handleDrop);
            scheduleGridElement.appendChild(cell);
        });
    });
    addDragStartListeners();
    displayScheduleConflicts(document.getElementById('conflict-alerts')); // Pass the element here
};

export const createGridHeaderCell = (text) => {
    const cell = document.createElement('div');
    cell.classList.add('schedule-cell', 'schedule-header');
    cell.textContent = text;
    return cell;
};

export const addDragStartListeners = () => {
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
            document.querySelectorAll('.schedule-cell.drag-over-ok, .schedule-cell.drag-over-conflict').forEach(cell => {
                cell.classList.remove('drag-over-ok', 'drag-over-conflict');
                cell.removeAttribute('title');
            });
        });
    });
};

export const handleDragOver = (e) => {
    e.preventDefault();
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

    document.querySelectorAll('.schedule-cell.drag-over-ok, .schedule-cell.drag-over-conflict').forEach(cell => {
        cell.classList.remove('drag-over-ok', 'drag-over-conflict');
        cell.removeAttribute('title');
    });

    if (conflicts.length === 0) {
        targetCell.classList.add('drag-over-ok');
    } else {
        targetCell.classList.add('drag-over-conflict');
        targetCell.title = conflicts.join('\n');
    }
};

export const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over-ok', 'drag-over-conflict');
    e.currentTarget.removeAttribute('title');
};

export const handleDrop = (e) => {
    e.preventDefault();
    const targetCell = e.currentTarget;
    targetCell.classList.remove('drag-over-ok', 'drag-over-conflict');
    targetCell.removeAttribute('title');

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
            // يجب إعادة عرض الشبكة هنا ( scheduleGridElement, editAppointmentModalElement, ... )
            renderScheduleGrid(document.getElementById('schedule-grid'), document.getElementById('edit-appointment-modal'), document.getElementById('edit-appt-original-id'), document.getElementById('edit-appt-course-name'), document.getElementById('edit-appt-professor-id'), document.getElementById('edit-appt-room-id'), document.getElementById('edit-appt-day'), document.getElementById('edit-appt-time-range'), document.getElementById('edit-appt-notes'));
            showAlert('تم تعديل الجدول بنجاح!', 'success');
        }
    }
};

export const displayScheduleConflicts = (conflictAlertsDivElement) => {
    const currentScheduleData = getCurrentSchedule();
    const conflicts = validateFullSchedule(currentScheduleData);
    if (!conflictAlertsDivElement) {
        console.error("Conflict alerts div not found!");
        return;
    }

    document.querySelectorAll('.course-item').forEach(item => item.classList.remove('conflict'));
    document.querySelectorAll('.schedule-cell').forEach(cell => cell.classList.remove('conflict'));

    if (conflicts.length > 0) {
        conflictAlertsDivElement.innerHTML = `<h4><i class="fas fa-exclamation-triangle"></i> تنبيهات التعارض في الجدول:</h4><ul>${conflicts.map(c => `<li>${c}</li>`).join('')}</ul>`;
        conflictAlertsDivElement.classList.remove('alert-success');
        conflictAlertsDivElement.classList.add('alert-danger');
        conflictAlertsDivElement.style.display = 'block';

        conflicts.forEach(conflictMsg => {
            const courseMatch = conflictMsg.match(/\[موعد ([^\]]+)\]/);
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
        conflictAlertsDivElement.innerHTML = '<h4><i class="fas fa-check-circle"></i> لا توجد تعارضات في الجدول الحالي.</h4>';
        conflictAlertsDivElement.classList.remove('alert-danger');
        conflictAlertsDivElement.classList.add('alert-success');
        conflictAlertsDivElement.style.display = 'block';
        if (window.alertTimeout) clearTimeout(window.alertTimeout);
        window.alertTimeout = setTimeout(() => {
            conflictAlertsDivElement.style.display = 'none';
        }, 3000);
    }
};

export const renderReports = (reportsSectionElement) => {
    const currentScheduleData = getCurrentSchedule();
    const evaluation = evaluateSchedule(currentScheduleData);

    if (!reportsSectionElement) return;

    reportsSectionElement.innerHTML = `
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

    renderRoomOccupancyChart(document.getElementById('roomOccupancyCanvas'), evaluation.details);
    renderProfessorLoadChart(document.getElementById('professorLoadCanvas'), currentScheduleData);
};

const renderRoomOccupancyChart = (canvasElement, evaluationDetails) => {
    const roomLabels = [];
    const roomData = [];
    for (const key in evaluationDetails) {
        if (key.startsWith('إشغال')) {
            roomLabels.push(key.replace('إشغال ', ''));
            roomData.push(parseFloat(evaluationDetails[key]));
        }
    }

    const ctx = canvasElement;
    if (ctx) {
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

const renderProfessorLoadChart = (canvasElement, schedule) => {
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

    const ctx = canvasElement;
    if (ctx) {
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

export const renderProfessorSchedules = (professorSchedulesSectionElement) => {
    const professorsData = getProfessors();
    const currentScheduleData = getCurrentSchedule();

    if (!professorSchedulesSectionElement) return;

    professorSchedulesSectionElement.innerHTML = '<h2><i class="fas fa-user-tie"></i> جداول الدكاترة</h2>';

    if (professorsData.length === 0) {
        professorSchedulesSectionElement.innerHTML += '<p class="text-secondary">لا يوجد دكاترة لعرض جداولهم.</p>';
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
                        <th>الدكتور</th>
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
                row.insertCell().textContent = appt.department || '-';
                row.insertCell().textContent = appt.notes || '-';
            });
            profDiv.appendChild(table);
        }

        const printBtn = document.createElement('button');
        printBtn.textContent = `طباعة جدول ${prof.name}`;
        printBtn.classList.add('print-button');
        printBtn.addEventListener('click', () => printProfessorSchedule(prof.id));
        profDiv.appendChild(printBtn);

        professorSchedulesSectionElement.appendChild(profDiv);
    });
};

export const printProfessorSchedule = (profId) => {
    const professor = getProfessors().find(p => p.id === profId);
    if (!professor) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>جدول الدكتور ' + professor.name + '</title>');
    printWindow.document.write('<link rel="stylesheet" href="css/style.css" type="text/css" />');
    printWindow.document.write('<style>body { direction: rtl; text-align: right; font-family: \'Cairo\', sans-serif; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } table th, table td { border: 1px solid #ddd; padding: 8px; text-align: right; } table th { background-color: #f2f2f2; }</style>');
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


export const exportScheduleToPDF = (scheduleElement) => {
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

export const exportScheduleToExcel = () => { // لا تتطلب عنصر DOM كمعامل
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
        ["اليوم", "الوقت", "المادة", "الدكتور", "القاعة/المعمل", "النوع", "القسم", "الشعبة", "ملاحظات"]
    ];

    schedule.forEach(appt => {
        data.push([
            appt.day,
            appt.timeRange,
            appt.courseName || appt.courseId,
            appt.professorName || appt.professorId,
            appt.roomName || appt.roomId,
            appt.type,
            appt.department || '',
            appt.sectionName || '',
            appt.notes || ''
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الجدول الدراسي");

    XLSX.writeFile(wb, `جدول-المواعيد-${academicPeriod.year}-${academicPeriod.semester}.xlsx`);
    showAlert('تم تصدير الجدول إلى ملف Excel (.xlsx) بنجاح.', 'success');
};

export const exportScheduleToImage = (scheduleElement) => {
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
