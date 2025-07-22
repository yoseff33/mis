// js/ui.js

const UI = (function() {
    const dataEntrySection = document.getElementById('dataEntrySection');
    const scheduleViewSection = document.getElementById('scheduleViewSection');
    const manualInputForms = document.getElementById('manualInputForms');
    const addDoctorForm = document.getElementById('addDoctorForm');
    const doctorsList = document.getElementById('doctorsList');
    const excelFileInput = document.getElementById('excelFileInput');
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');

    const scheduleDisplay = document.getElementById('scheduleDisplay');
    const scheduleFilter = document.getElementById('scheduleFilter');
    const conflictAlerts = document.getElementById('conflictAlerts');

    function init() {
        // إعداد المستمعين للأحداث
        document.getElementById('dataEntryBtn').addEventListener('click', () => showSection('dataEntrySection'));
        document.getElementById('generateScheduleBtn').addEventListener('click', handleGenerateSchedule);
        document.getElementById('viewSchedulesBtn').addEventListener('click', () => showSection('scheduleViewSection'));
        document.getElementById('manualInputBtn').addEventListener('click', () => manualInputForms.style.display = 'block');
        document.getElementById('excelFileInput').addEventListener('change', handleExcelUpload);
        document.getElementById('downloadTemplateBtn').addEventListener('click', DataManager.downloadExcelTemplate);


        addDoctorForm.addEventListener('submit', handleAddDoctor);
        // إضافة مستمعين لـ addCourseForm, addRoomForm إلخ.

        scheduleFilter.addEventListener('change', handleScheduleFilterChange);

        // تحميل البيانات الأولية عند بدء التشغيل وعرضها
        DataManager.loadData();
        renderDataSummary();
    }

    function showSection(sectionId) {
        document.querySelectorAll('main section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active-section');
        });
        document.getElementById(sectionId).style.display = 'block';
        document.getElementById(sectionId).classList.add('active-section');
    }

    function handleAddDoctor(event) {
        event.preventDefault();
        const name = document.getElementById('doctorName').value;
        const maxHours = parseInt(document.getElementById('doctorMaxHours').value);
        if (name && !isNaN(maxHours)) {
            DataManager.addDoctor(name, maxHours);
            renderDataSummary();
            addDoctorForm.reset();
        } else {
            alert('الرجاء إدخال اسم الدكتور وأقصى ساعات بشكل صحيح.');
        }
    }

    function renderDataSummary() {
        doctorsList.innerHTML = '';
        DataManager.getDoctors().forEach(doc => {
            const li = document.createElement('li');
            li.textContent = `${doc.name} (Max: ${doc.maxHours} hrs)`;
            doctorsList.appendChild(li);
        });
        // عرض المواد والقاعات بنفس الطريقة
    }

    async function handleExcelUpload(event) {
        const file = event.target.files[0];
        if (file) {
            try {
                const parsedData = await DataManager.processExcelData(file);
                // هنا ستقوم بدمج البيانات المحللة مع DataManager
                // مثال: parsedData.doctors.forEach(doc => DataManager.addDoctor(doc.name, doc.maxHours));
                alert('تم تحميل بيانات Excel بنجاح (معالجة مبسطة).');
                renderDataSummary();
            } catch (error) {
                console.error('Error processing Excel file:', error);
                alert('حدث خطأ أثناء معالجة ملف Excel.');
            }
        }
    }

    async function handleGenerateSchedule() {
        const doctors = DataManager.getDoctors();
        const courses = DataManager.getCourses();
        const rooms = DataManager.getRooms();

        if (doctors.length === 0 || courses.length === 0 || rooms.length === 0) {
            alert('الرجاء إدخال بيانات الدكاترة والمواد والقاعات أولاً.');
            return;
        }

        const result = Scheduler.generateSchedule(doctors, courses, rooms);
        renderSchedule(result.generalSchedule);
        renderScheduleFilters(result.individualSchedules.doctors, result.individualSchedules.sections);
        displayConflictAlerts(result.errors);
        showSection('scheduleViewSection');
    }

    function renderSchedule(scheduleData) {
        scheduleDisplay.innerHTML = ''; // مسح المحتوى القديم

        // إنشاء رؤوس الجدول (الأيام)
        let headerRow = '<div class="schedule-header">الوقت / اليوم</div>';
        Scheduler.DAYS.forEach(day => {
            headerRow += `<div class="schedule-header">${day}</div>`;
        });
        scheduleDisplay.innerHTML += headerRow;
        scheduleDisplay.style.gridTemplateColumns = `repeat(${Scheduler.DAYS.length + 1}, 1fr)`; // تحديث CSS Grid

        // إنشاء صفوف الجدول لكل وقت
        Scheduler.TIMES.forEach(time => {
            let rowHtml = `<div class="schedule-header">${time}</div>`;
            Scheduler.DAYS.forEach(day => {
                let cellContent = '';
                const assignmentsInThisTimeSlot = scheduleData.filter(item => item.day === day && item.time === time);

                if (assignmentsInThisTimeSlot.length > 0) {
                    // عرض تفاصيل المحاضرات في هذه الخلية
                    assignmentsInThisTimeSlot.forEach(assignment => {
                        const room = DataManager.getRooms().find(r => r.id === assignment.roomId);
                        const roomStatusClass = assignment ? 'room-red' : 'room-green'; // مثال بسيط للحالة

                        cellContent += `
                            <div class="schedule-entry ${roomStatusClass}" data-room-id="${assignment.roomId}" draggable="true">
                                <strong>${assignment.courseName} (${assignment.sectionId})</strong><br>
                                ${assignment.doctorName}<br>
                                ${assignment.roomName}
                            </div>
                        `;
                    });
                } else {
                    // إذا لم تكن هناك محاضرات، يمكن الإشارة إلى أنها متاحة
                    const availableRoomsAtTime = DataManager.getRooms().filter(room => {
                        return !scheduleData.some(item =>
                            item.day === day && item.time === time && item.roomId === room.id
                        );
                    });
                    // هذا الجزء يحتاج إلى طريقة أكثر ذكاء لعرض القاعات المتاحة في الخلية
                    // أو يمكن الاكتفاء بعرض المحاضرات فقط
                    cellContent = '<div class="available-slot">متاح</div>';
                }
                rowHtml += `<div class="schedule-cell">${cellContent}</div>`;
            });
            scheduleDisplay.innerHTML += rowHtml;
        });

        // تمكين Drag & Drop (معقد، مجرد مثال على البداية)
        addDragAndDropListeners();
    }

    function addDragAndDropListeners() {
        document.querySelectorAll('.schedule-entry').forEach(entry => {
            entry.addEventListener('dragstart', handleDragStart);
        });
        document.querySelectorAll('.schedule-cell').forEach(cell => {
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
        });
    }

    let draggedElement = null;
    function handleDragStart(event) {
        draggedElement = event.target;
        event.dataTransfer.setData('text/plain', draggedElement.dataset.courseId); // أو أي معرف
        event.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(event) {
        event.preventDefault(); // السماح بالإسقاط
        event.dataTransfer.dropEffect = 'move';
    }

    function handleDrop(event) {
        event.preventDefault();
        if (draggedElement) {
            // هنا يجب تطبيق منطق معقد لتحديث الجدول
            // يجب التحقق من التضاربات قبل الإسقاط، وتحديث DataManager
            // example: updateScheduleAfterDragDrop(draggedElement, event.target);
            event.target.appendChild(draggedElement);
            draggedElement = null;
        }
    }


    function renderScheduleFilters(doctorsSchedules, sectionsSchedules) {
        scheduleFilter.innerHTML = '<option value="all">الجدول العام</option>';
        // إضافة الدكاترة
        for (const docId in doctorsSchedules) {
            const doctor = DataManager.getDoctors().find(d => d.id === docId);
            if (doctor) {
                const option = document.createElement('option');
                option.value = `doctor-${docId}`;
                option.textContent = `جدول الدكتور: ${doctor.name}`;
                scheduleFilter.appendChild(option);
            }
        }
        // إضافة الشعب
        for (const sectionKey in sectionsSchedules) {
            const option = document.createElement('option');
            option.value = `section-${sectionKey}`;
            option.textContent = `جدول الشعبة: ${sectionKey}`;
            scheduleFilter.appendChild(option);
        }
    }

    function handleScheduleFilterChange(event) {
        const selectedValue = event.target.value;
        const allSchedules = DataManager.getScheduleData();

        if (selectedValue === 'all') {
            renderSchedule(allSchedules.general);
        } else if (selectedValue.startsWith('doctor-')) {
            const docId = selectedValue.split('-')[1];
            const doctorSchedule = allSchedules.doctors[docId];
            const flatSchedule = Scheduler.flattenScheduleFromIndividual(doctorSchedule, DataManager.getDoctors(), DataManager.getCourses(), DataManager.getRooms()); // تحتاج وظيفة تسطيح من جدول فردي
            renderSchedule(flatSchedule);
        } else if (selectedValue.startsWith('section-')) {
            const sectionKey = selectedValue.split('-')[1];
            const sectionSchedule = allSchedules.sections[sectionKey];
            const flatSchedule = Scheduler.flattenScheduleFromIndividual(sectionSchedule, DataManager.getDoctors(), DataManager.getCourses(), DataManager.getRooms());
            renderSchedule(flatSchedule);
        }
    }

    function displayConflictAlerts(errors) {
        conflictAlerts.innerHTML = '';
        if (errors.length > 0) {
            errors.forEach(error => {
                const p = document.createElement('p');
                p.className = 'alert-danger';
                p.textContent = `تنبيه: ${error}`;
                conflictAlerts.appendChild(p);
            });
            conflictAlerts.style.display = 'block';
        } else {
            conflictAlerts.style.display = 'none';
        }
    }

    // لتطبيق الوضع الليلي (بسيط)
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
    }

    return {
        init,
        renderDataSummary,
        renderSchedule,
        displayConflictAlerts,
        toggleDarkMode,
        showSection
    };
})();
