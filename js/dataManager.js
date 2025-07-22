// js/data-manager.js

const DataManager = (function() {
    let doctors = [];
    let courses = [];
    let rooms = [];
    let scheduleData = []; // لتخزين الجداول المولدة

    // تحميل البيانات من LocalStorage عند بدء التشغيل
    function loadData() {
        doctors = JSON.parse(localStorage.getItem('doctors')) || [];
        courses = JSON.parse(localStorage.getItem('courses')) || [];
        rooms = JSON.parse(localStorage.getItem('rooms')) || [];
        scheduleData = JSON.parse(localStorage.getItem('scheduleData')) || [];
    }

    // حفظ البيانات في LocalStorage
    function saveData() {
        localStorage.setItem('doctors', JSON.stringify(doctors));
        localStorage.setItem('courses', JSON.stringify(courses));
        localStorage.setItem('rooms', JSON.stringify(rooms));
        localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
    }

    // وظائف إضافة وحذف البيانات
    function addDoctor(name, maxHours) {
        doctors.push({ id: `doc-${Date.now()}`, name, maxHours, preferences: {} });
        saveData();
        return doctors;
    }

    function addCourse(name, code, hours, requiredRoomType = '') {
        courses.push({ id: `course-${Date.now()}`, name, code, hours, requiredRoomType });
        saveData();
        return courses;
    }

    function addRoom(name, capacity, type = '') {
        rooms.push({ id: `room-${Date.now()}`, name, capacity, type });
        saveData();
        return rooms;
    }

    function setScheduleData(data) {
        scheduleData = data;
        saveData();
    }

    function getDoctors() { return doctors; }
    function getCourses() { return courses; }
    function getRooms() { return rooms; }
    function getScheduleData() { return scheduleData; }

    // معالجة ملفات Excel (ستحتاج إلى مكتبة مثل SheetJS لكن هذا يتجاوز "بدون مكتبات خارجية معقدة". لذا، سأفترض إدخال يدوي أو صيغة CSV مبسطة يمكنك معالجتها يدويًا.)
    // For a strict "no external libraries" rule, parsing XLSX directly in pure JS is very complex.
    // A simpler alternative would be to ask users to provide data in a specific CSV format, which can be parsed with basic string manipulation.
    function processExcelData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                // Simplified example: Assuming CSV data
                const csvText = e.target.result;
                const lines = csvText.split('\n');
                const header = lines[0].split(',');
                const data = lines.slice(1).map(line => line.split(','));

                // Basic parsing, would need more robust logic for actual Excel/CSV
                // For example, if header[0] is 'DoctorName', then doctors.push({ name: row[0] })
                console.log("Processing CSV data (placeholder):", { header, data });
                resolve({ doctors: [], courses: [], rooms: [] }); // Return parsed data
            };
            reader.onerror = reject;
            reader.readAsText(file); // Or readAsArrayBuffer for XLSX if you use a custom parser
        });
    }

    // وظيفة لتحميل قالب Excel (يمكن أن تكون ملف CSV جاهزًا للتنزيل)
    function downloadExcelTemplate() {
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" +
                           "DoctorName,MaxHours,PreferredTimes\n" +
                           "CourseName,CourseCode,Hours,RoomType\n" +
                           "RoomName,Capacity,Type";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "schedule_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }


    return {
        loadData,
        saveData,
        addDoctor,
        addCourse,
        addRoom,
        getDoctors,
        getCourses,
        getRooms,
        setScheduleData,
        getScheduleData,
        processExcelData,
        downloadExcelTemplate
    };
})();
