// js/conflict-solver.js

const ConflictSolver = (function() {

    // التحقق من التضاربات قبل محاولة التخصيص
    function checkConflicts(currentSchedule, potentialAssignment, doctors, rooms) {
        const conflicts = [];
        const { day, time, room, doctor, course, section } = potentialAssignment;

        // 1. تضارب القاعات: هل القاعة مشغولة بالفعل في هذا الوقت؟
        if (currentSchedule[day][time][room] !== null) {
            conflicts.push({ type: 'room', message: `القاعة ${room} مشغولة في ${day} الساعة ${time}.` });
        }

        // 2. تضارب الدكاترة: هل الدكتور مخصص بالفعل لمادة أخرى في هذا الوقت؟
        const doctorAssignments = Object.values(currentSchedule[day][time]).filter(assignment =>
            assignment && assignment.doctor === doctor
        );
        if (doctorAssignments.length > 0) {
            const assignedCourse = DataManager.getCourses().find(c => c.id === doctorAssignments[0].course);
            conflicts.push({ type: 'doctor', message: `الدكتور مشغول بـ ${assignedCourse ? assignedCourse.name : 'مادة أخرى'} في ${day} الساعة ${time}.` });
        }

        // 3. تضارب الشعبة: هل هذه الشعبة مخصصة بالفعل في هذا الوقت؟ (مثلاً، إذا كانت الشعبة مقسمة)
        // هذا يتطلب التحقق عبر جميع القاعات لنفس الشعبة
        DAYS.forEach(d => {
            TIMES.forEach(t => {
                rooms.forEach(r => {
                    const existingAssignment = currentSchedule[d][t][r.id];
                    if (existingAssignment && existingAssignment.course === course && existingAssignment.section === section && d === day && t === time) {
                        conflicts.push({ type: 'section', message: `الشعبة ${section} من المادة ${course} مخصصة بالفعل في ${d} الساعة ${t}.` });
                    }
                });
            });
        });


        // 4. توافق القاعة والشعبة (مثال: إذا كانت الشعبة تتطلب معمل وقمت بتخصيصها في قاعة عادية)
        const currentRoom = rooms.find(r => r.id === room);
        const currentCourse = DataManager.getCourses().find(c => c.id === course);
        if (currentCourse && currentRoom && currentCourse.requiredRoomType && currentRoom.type !== currentCourse.requiredRoomType) {
            conflicts.push({ type: 'room-type-mismatch', message: `القاعة ${currentRoom.name} ليست من النوع المطلوب (${currentCourse.requiredRoomType}) للمادة ${currentCourse.name}.` });
        }

        // 5. التحقق من فترات الراحة الإلزامية للدكتور
        const assignedDoctor = doctors.find(d => d.id === doctor);
        if (assignedDoctor) {
            const doctorScheduleToday = Object.values(currentSchedule[day]).filter(timeSlot =>
                Object.values(timeSlot).some(assign => assign && assign.doctor === assignedDoctor.id)
            ).map(timeSlot => {
                return Object.keys(timeSlot).find(roomId => timeSlot[roomId] && timeSlot[roomId].doctor === assignedDoctor.id);
            });
            // هذا يتطلب خوارزمية أكثر تعقيدًا للتحقق من فترات الراحة.
            // مثلاً، إذا كان الدكتور قد أخذ محاضرة للتو، لا يمكنه أخذ محاضرة أخرى مباشرة.
            // (سيتم معالجة هذا بشكل أفضل في `RulesEngine` كقاعدة تفضيلية أو إلزامية).
        }


        return conflicts;
    }

    // وظيفة لحل التضاربات (متقدمة):
    // هذه الوظيفة ستكون أكثر تعقيدًا وتتطلب منطقًا لإعادة ترتيب الجداول عند اكتشاف تضارب.
    // مثلاً، إذا كان هناك تضارب، قد تحاول هذه الوظيفة:
    // 1. نقل إحدى المحاضرات المتضاربة إلى وقت آخر.
    // 2. البحث عن قاعة بديلة.
    // 3. تغيير الدكتور (إذا كان هناك بديل مناسب).
    function resolveConflicts(schedule) {
        // Logic to iterate through the schedule and resolve conflicts
        // This is a highly complex task and usually involves backtracking or iterative improvement algorithms.
        // For a basic implementation, it might simply identify conflicts and alert the user.
        console.warn("Conflict resolution is a complex feature. Current implementation only detects.");
        // Example: Check all current assignments for conflicts and try to move them
        // This would involve iterating through the generated schedule and calling checkConflicts for each entry.
        // If a conflict is found, attempt to re-assign the conflicting entry.
        return schedule; // Return the (potentially modified) schedule
    }

    return {
        checkConflicts,
        resolveConflicts
    };
})();
