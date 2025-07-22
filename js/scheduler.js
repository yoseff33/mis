// js/scheduler.js

const Scheduler = (function() {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']; // أيام الأسبوع
    const TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']; // أوقات المحاضرات

    let currentSchedule = {}; // { day: { time: { room: { course, doctor, section } } } }

    function initializeSchedule(rooms) {
        const schedule = {};
        DAYS.forEach(day => {
            schedule[day] = {};
            TIMES.forEach(time => {
                schedule[day][time] = {};
                rooms.forEach(room => {
                    schedule[day][time][room.id] = null; // null يعني القاعة متاحة
                });
            });
        });
        return schedule;
    }

    function generateSchedule(doctors, courses, rooms) {
        currentSchedule = initializeSchedule(rooms);
        let errors = [];
        let generatedIndividualSchedules = {
            doctors: {},
            sections: {}
        };

        // تهيئة الجداول الفردية
        doctors.forEach(doc => generatedIndividualSchedules.doctors[doc.id] = []);
        courses.forEach(course => {
            // لكل مادة، قد يكون هناك عدة شعب
            for (let i = 1; i <= course.sections; i++) {
                generatedIndividualSchedules.sections[`${course.code}-S${i}`] = [];
            }
        });


        // 1. فرز المواد/الشعب حسب الأولوية (مثلاً: المواد ذات الساعات الأطول أولاً)
        const coursesWithSections = [];
        courses.forEach(course => {
            for (let i = 1; i <= course.numSections; i++) { // افترض أن `numSections` موجود في `course`
                coursesWithSections.push({
                    courseId: course.id,
                    courseName: course.name,
                    courseCode: course.code,
                    hours: course.hours,
                    sectionId: `S${i}`,
                    requiredRoomType: course.requiredRoomType // إذا كانت المادة تحتاج نوع قاعة معين
                });
            }
        });

        // 2. البدء في تخصيص كل شعبة
        coursesWithSections.sort((a, b) => b.hours - a.hours); // الأكبر أولاً

        for (const cs of coursesWithSections) {
            let assigned = false;
            let attempts = 0;
            const maxAttempts = 100; // لمنع الحلقات اللانهائية

            while (!assigned && attempts < maxAttempts) {
                const day = DAYS[Math.floor(Math.random() * DAYS.length)];
                const timeIndex = Math.floor(Math.random() * TIMES.length);
                const time = TIMES[timeIndex];
                const availableRooms = rooms.filter(room => {
                    // تحقق من توافق نوع القاعة إذا كان محددًا
                    const roomTypeMatch = !cs.requiredRoomType || room.type === cs.requiredRoomType;
                    // تحقق من أن القاعة متاحة في هذا الوقت
                    return roomTypeMatch && currentSchedule[day][time][room.id] === null;
                });

                if (availableRooms.length > 0) {
                    // اختر دكتور متاح لهذه الشعبة
                    const suitableDoctors = doctors.filter(doc => {
                        // تحقق من أقصى عدد ساعات للدكتور
                        const doctorCurrentHours = generatedIndividualSchedules.doctors[doc.id].reduce((sum, item) => sum + item.hours, 0);
                        return doctorCurrentHours < doc.maxHours;
                    });

                    if (suitableDoctors.length > 0) {
                        // هنا يمكن تطبيق تفضيلات الدكتور (مثلاً، الصباح فقط)
                        // هذا مثال مبسط، ستحتاج إلى دمج `RulesEngine.js` هنا
                        const doctor = suitableDoctors[Math.floor(Math.random() * suitableDoctors.length)];
                        const room = availableRooms[Math.floor(Math.random() * availableRooms.length)]; // اختر قاعة عشوائية متاحة

                        // تحقق من التضاربات باستخدام ConflictSolver قبل التخصيص النهائي
                        const potentialAssignment = {
                            day,
                            time,
                            room: room.id,
                            doctor: doctor.id,
                            course: cs.courseId,
                            section: cs.sectionId,
                            hours: cs.hours
                        };

                        const conflicts = ConflictSolver.checkConflicts(currentSchedule, potentialAssignment, doctors, rooms);
                        if (conflicts.length === 0) {
                            // إذا لا توجد تضاربات، قم بالتخصيص
                            currentSchedule[day][time][room.id] = potentialAssignment;

                            // تحديث الجداول الفردية
                            generatedIndividualSchedules.doctors[doctor.id].push(potentialAssignment);
                            generatedIndividualSchedules.sections[`${cs.courseCode}-S${cs.sectionId}`].push(potentialAssignment);

                            assigned = true;
                            console.log(`Assigned ${cs.courseCode}-S${cs.sectionId} to ${doctor.name} in ${room.name} on ${day} at ${time}`);
                        } else {
                            // هناك تضاربات، حاول مرة أخرى
                            attempts++;
                            console.log(`Conflict detected for ${cs.courseCode}-S${cs.sectionId}, retrying...`);
                            errors.push(`Conflict trying to assign ${cs.courseCode}-S${cs.sectionId}: ${conflicts.map(c => c.message).join(', ')}`);
                        }
                    }
                }
                attempts++;
            }
            if (!assigned) {
                errors.push(`Could not assign ${cs.courseCode}-S${cs.sectionId} after ${maxAttempts} attempts.`);
            }
        }

        // الآن بعد التخصيص الأولي، قم بتحسين الجداول وحل أي تضاربات متبقية
        // يمكن هنا استدعاء ConflictSolver.resolveConflicts(currentSchedule, generatedIndividualSchedules);
        // وتطبيق قواعد RulesEngine.applyRules(currentSchedule, generatedIndividualSchedules);

        // سيتم تحويل currentSchedule إلى تنسيق أسهل للعرض والتصدير
        const finalScheduleForDisplay = Scheduler.flattenSchedule(currentSchedule, doctors, courses, rooms);

        // حفظ الجداول المولدة
        DataManager.setScheduleData({
            general: finalScheduleForDisplay,
            doctors: generatedIndividualSchedules.doctors,
            sections: generatedIndividualSchedules.sections
        });

        return {
            generalSchedule: finalScheduleForDisplay,
            individualSchedules: generatedIndividualSchedules,
            errors: errors
        };
    }

    // وظيفة مساعدة لتسطيح الجدول لسهولة العرض
    function flattenSchedule(schedule, doctors, courses, rooms) {
        const flat = [];
        DAYS.forEach(day => {
            TIMES.forEach(time => {
                rooms.forEach(room => {
                    const assignment = schedule[day][time][room.id];
                    if (assignment) {
                        const doctor = doctors.find(d => d.id === assignment.doctor);
                        const course = courses.find(c => c.id === assignment.course);
                        flat.push({
                            day: day,
                            time: time,
                            roomName: room.name,
                            doctorName: doctor ? doctor.name : 'N/A',
                            courseName: course ? course.name : 'N/A',
                            sectionId: assignment.section,
                            roomId: room.id,
                            doctorId: doctor ? doctor.id : 'N/A',
                            courseId: course ? course.id : 'N/A'
                        });
                    }
                });
            });
        });
        return flat;
    }


    return {
        generateSchedule,
        flattenSchedule,
        DAYS,
        TIMES
    };
})();
