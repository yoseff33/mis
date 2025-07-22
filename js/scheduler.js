// js/scheduler.js

import { DAYS, TIME_SLOTS } from './constants.js';
import { getProfessors, getRooms, getCourses, getCurrentSchedule, setCurrentSchedule } from './dataManager.js';
import { parseTimeRange, toMinutes, isTimeConflict, generateUniqueId, showAlert } from './utils.js';

/**
 * Checks for conflicts for a given appointment within a schedule.
 * @param {object} newAppointment - The appointment to check ({id, courseId, professorId, roomId, day, timeRange, ...})
 * @param {Array} schedule - The current schedule to check against
 * @returns {Array<string>} List of conflict messages
 */
export const checkConflicts = (newAppointment, schedule) => {
    const conflicts = [];
    const professorsData = getProfessors();
    const roomsData = getRooms();

    const { id: newApptId, courseId, professorId, roomId, day, timeRange } = newAppointment;

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

    const professor = professorsData.find(p => p.id === professorId);
    if (professor) {
        if (professor.preferences?.noFriday && day === "الجمعة") {
            conflicts.push(`الدكتور ${professor.name} يفضل عدم التدريس يوم الجمعة.`);
        }
        if (professor.preferences?.noMonday && day === "الاثنين") {
            conflicts.push(`الدكتور ${professor.name} يفضل عدم التدريس يوم الاثنين.`);
        }

        const professorAvailableInSlot = professor.availableTimes.some(pt => {
            const [ptDay, ptRangeStr] = pt.split(':');
            const ptRange = parseTimeRange(ptRangeStr);
            if (!ptRange) return false;
            return ptDay === day && !isTimeConflict(newStart, newEnd, ptRange.start, ptRange.end);
        });

        if (!professorAvailableInSlot && !professor.preferences?.flexibleScheduling) {
            conflicts.push(`الدكتور ${professor.name} غير متاح في ${day} ${timeRange}.`);
        }
    } else {
        conflicts.push(`الدكتور بالمعرف ${professorId} غير موجود.`);
    }

    const room = roomsData.find(r => r.id === roomId);
    if (room) {
        const roomAvailableInSlot = room.availableTimes.some(rt => {
            const [rtDay, rtRangeStr] = rt.split(':');
            const rtRange = parseTimeRange(rtRangeStr);
            if (!rtRange) return false;
            return rtDay === day && !isTimeConflict(newStart, newEnd, rtRange.start, rtRange.end);
        });
        if (!roomAvailableInSlot) {
            conflicts.push(`القاعة/المعمل ${room.name} غير متاح في ${day} ${timeRange}.`);
        }
    } else {
        conflicts.push(`القاعة/المعمل بالمعرف ${roomId} غير موجود.`);
    }

    schedule.forEach(existingAppointment => {
        if (existingAppointment.id === newApptId) return;

        if (existingAppointment.day === day) {
            const existingApptTime = parseTimeRange(existingAppointment.timeRange);
            if (!existingApptTime) return;

            const { start: existingStart, end: existingEnd } = existingApptTime;

            if (existingAppointment.professorId === professorId && isTimeConflict(newStart, newEnd, existingStart, existingEnd)) {
                conflicts.push(`تعارض وقت للدكتور ${professor?.name || professorId} بين "${newAppointment.courseName || newAppointment.courseId}" و "${existingAppointment.courseName || existingAppointment.courseId}" في ${day} ${existingAppointment.timeRange}.`);
            }

            if (existingAppointment.roomId === roomId && isTimeConflict(newStart, newEnd, existingStart, existingEnd)) {
                conflicts.push(`تعارض وقت للقاعة ${room?.name || roomId} بين "${newAppointment.courseName || newAppointment.courseId}" و "${existingAppointment.courseName || existingAppointment.courseId}" في ${day} ${existingAppointment.timeRange}.`);
            }
        }
    });

    return conflicts;
};

export const validateFullSchedule = (schedule) => {
    const allConflicts = [];
    const tempSchedule = JSON.parse(JSON.stringify(schedule));

    tempSchedule.forEach((appt1, index1) => {
        const conflictsForAppt1 = checkConflicts(appt1, tempSchedule.filter((_, idx) => idx !== index1));
        conflictsForAppt1.forEach(conflict => {
            allConflicts.push(`[موعد ${appt1.courseName || appt1.courseId}] ${conflict}`);
        });
    });
    return [...new Set(allConflicts)];
};

export const generateSchedule = () => {
    const professorsData = getProfessors();
    const roomsData = getRooms();
    const coursesData = getCourses();

    let newSchedule = [];
    let unassignedCourses = [];

    if (professorsData.length === 0 || roomsData.length === 0 || coursesData.length === 0) {
        showAlert("الرجاء إدخال بيانات الدكاترة والقاعات والمواد أولاً لتوليد الجدول.", "warning");
        return { schedule: [], unassignedCourses: [], conflicts: [] };
    }

    const schedulingUnits = [];
    coursesData.forEach(course => {
        const totalDurationMinutes = (course.hours * 60) + (course.labHours * 60);
        const numSlots = totalDurationMinutes > 0 ? Math.max(1, Math.ceil(totalDurationMinutes / 100)) : 0;

        for (let i = 0; i < numSlots; i++) {
            schedulingUnits.push({
                courseId: course.id,
                courseName: course.name,
                sectionName: course.sectionName,
                department: course.department,
                professorId: course.professorId,
                isLabSession: i < Math.ceil((course.labHours * 60) / 100),
                preferredTimes: course.preferredTimes,
                notes: course.notes,
                originalCourseHours: course.hours,
                originalLabHours: course.labHours,
                unitIndex: i + 1
            });
        }
    });

    // فرز وحدات الجدولة مع مراعاة الأقسام أولاً
    schedulingUnits.sort((a, b) => {
        // 1. الأولوية للأقسام (إذا كانت الأقسام مختلفة)
        if (a.department && b.department && a.department !== b.department) {
            return a.department.localeCompare(b.department);
        }

        const profA = professorsData.find(p => p.id === a.professorId);
        const profB = professorsData.find(p => p.id === b.professorId);

        // 2. الأوقات المفضلة
        if (a.preferredTimes.length > 0 && b.preferredTimes.length === 0) return -1;
        if (a.preferredTimes.length === 0 && b.preferredTimes.length > 0) return 1;

        // 3. حصص المعامل
        if (a.isLabSession && !b.isLabSession) return -1;
        if (!a.isLabSession && b.isLabSession) return 1;

        // 4. أولوية الدكتور
        if (profA && profB) {
            return profA.priority - profB.priority;
        }
        return 0;
    });

    for (const unit of schedulingUnits) {
        let assigned = false;
        const professor = professorsData.find(p => p.id === unit.professorId);
        if (!professor) {
            unassignedCourses.push({ ...unit, reason: "الدكتور غير موجود للمادة." });
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
        for (const day of DAYS) {
            if (professor.preferences?.noFriday && day === "الجمعة") continue;
            if (professor.preferences?.noMonday && day === "الاثنين") continue;

            for (const timeRange of TIME_SLOTS) {
                if (!possibleSlots.some(s => s.day === day && s.timeRange === timeRange)) {
                    possibleSlots.push({ day, timeRange, preferred: false });
                }
            }
        }

        possibleSlots.sort((a, b) => {
            if (a.preferred && !b.preferred) return -1;
            if (!a.preferred && b.preferred) return 1;
            return toMinutes(parseTimeRange(a.timeRange).start) - toMinutes(parseTimeRange(b.timeRange).start);
        });

        for (const slot of possibleSlots) {
            const { day, timeRange } = slot;
            const { start: slotStart, end: slotEnd } = parseTimeRange(timeRange) || {};

            if (!slotStart || !slotEnd) {
                console.warn(`Skipping invalid time slot: ${timeRange}`);
                continue;
            }

            let suitableRooms = roomsData.filter(r =>
                (unit.isLabSession ? r.type === "lab" : r.type === "lecture") &&
                r.availableTimes.some(rt => {
                    const [rtDay, rtRangeStr] = rt.split(':');
                    const rtRange = parseTimeRange(rtRangeStr);
                    if (!rtRange) return false;
                    return rtDay === day && !isTimeConflict(slotStart, slotEnd, rtRange.start, rtRange.end);
                })
            );

            suitableRooms.sort((a, b) => {
                const lastApptForProf = newSchedule.slice().reverse().find(appt => appt.professorId === professor.id && appt.day === day);
                const lastApptRoom = lastApptForProf ? roomsData.find(r => r.id === lastApptForProf.roomId) : null;

                if (lastApptRoom && a.locationGroup && b.locationGroup) {
                    const aMatchesLast = a.locationGroup === lastApptRoom.locationGroup;
                    const bMatchesLast = b.locationGroup === lastApptRoom.locationGroup;
                    if (aMatchesLast && !bMatchesLast) return -1;
                    if (!aMatchesLast && bMatchesLast) return 1;
                }
                return 0.5 - Math.random();
            });

            for (const room of suitableRooms) {
                const potentialAppointment = {
                    id: generateUniqueId(),
                    courseId: unit.courseId,
                    courseName: unit.courseName,
                    sectionName: unit.sectionName,
                    department: unit.department,
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

export const optimizeScheduleForGaps = () => {
    showAlert('جاري محاولة تحسين الجدول لتقليل الفجوات...', 'info');
    let schedule = getCurrentSchedule();
    let professorsData = getProfessors();
    let changesMade = false;

    let tempSchedule = JSON.parse(JSON.stringify(schedule));

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
                return toMinutes(timeA.start) - toMinutes(parseTimeRange(b.timeRange).start);
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
        // renderScheduleGrid(); // سيتم استدعاؤها بعد إشارة التحسين
        showAlert('تمت محاولة تحسين الجدول بنجاح!', 'success');
    } else {
        showAlert('لم يتم العثور على تحسينات لتقليل الفجوات في الجدول الحالي.', 'info');
    }
};

export const fixAllConflictsAutomatically = () => {
    showAlert('جاري محاولة إصلاح جميع التعارضات تلقائيًا...', 'info');
    let schedule = getCurrentSchedule();
    let conflictsResolvedCount = 0;
    const maxIterations = 5;

    for (let iter = 0; iter < maxIterations; iter++) {
        let initialConflicts = validateFullSchedule(schedule);
        if (initialConflicts.length === 0) {
            break;
        }

        let changesMadeInIteration = false;
        let tempScheduleCopy = [...schedule];

        for (const conflictMsg of initialConflicts) {
            const courseMatch = conflictMsg.match(/\[موعد ([^\]]+)\]/);
            if (!courseMatch || !courseMatch[1]) continue;

            const conflictingCourseIdOrName = courseMatch[1];
            const conflictingAppt = tempScheduleCopy.find(appt =>
                appt.courseName === conflictingCourseIdOrName || appt.courseId === conflictingCourseIdOrName
            );

            if (conflictingAppt) {
                const scheduleWithoutConflictingAppt = tempScheduleCopy.filter(a => a.id !== conflictingAppt.id);
                const suggestions = suggestAlternativeTimes(conflictingAppt);

                if (suggestions.length > 0) {
                    const chosenSuggestion = suggestions[0];
                    const updatedAppt = {
                        ...conflictingAppt,
                        day: chosenSuggestion.day,
                        timeRange: chosenSuggestion.timeRange
                    };

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
        schedule = tempScheduleCopy;
        if (!changesMadeInIteration) {
            break;
        }
    }

    setCurrentSchedule(schedule);
    // renderScheduleGrid(); // سيتم استدعاؤها بعد إشارة الإصلاح
    const finalConflicts = validateFullSchedule(schedule);

    if (finalConflicts.length === 0) {
        showAlert('تم إصلاح جميع التعارضات بنجاح!', 'success');
    } else {
        showAlert(`تم إصلاح ${conflictsResolvedCount} تعارضات. لا يزال هناك ${finalConflicts.length} تعارضات متبقية لم يتم حلها تلقائيًا.`, 'warning');
    }
};


export const evaluateSchedule = (schedule) => {
    let score = 100;
    const evaluationDetails = {};
    const professorsData = getProfessors();
    const roomsData = getRooms();

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

                if (gap > 60 && gap < 180) {
                    score -= 2;
                    evaluationDetails[`فجوات متوسطة للدكتور ${appointments[i].professorName} في ${day}`] = (evaluationDetails[`فجوات متوسطة للدكتور ${appointments[i].professorName} في ${day}`] || 0) + 1;
                } else if (gap >= 180) {
                    score -= 5;
                    evaluationDetails[`فجوات كبيرة للدكتور ${appointments[i].professorName} في ${day}`] = (evaluationDetails[`فجوات كبيرة للدكتور ${appointments[i].professorName} في ${day}`] || 0) + 1;
                }
            }
        }
    }

    const roomUsage = {};
    const totalPossibleSlotsPerRoom = DAYS.length * TIME_SLOTS.length;
    roomsData.forEach(room => roomUsage[room.id] = { count: 0, name: room.name, totalSlots: totalPossibleSlotsPerRoom });

    schedule.forEach(appt => {
        if (roomUsage[appt.roomId]) {
            roomUsage[appt.roomId].count++;
        }
    });

    for (const roomId in roomUsage) {
        const usagePercentage = (roomUsage[roomId].count / roomUsage[roomId].totalSlots) * 100;
        evaluationDetails[`إشغال ${roomUsage[roomId].name}`] = `${usagePercentage.toFixed(1)}%`;
        if (usagePercentage < 15) {
            score -= 5;
        } else if (usagePercentage > 85) {
            score -= 3;
        }
    }

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
            if (uniqueLocations > 1) {
                totalRoomSwitches += (uniqueLocations - 1);
                evaluationDetails[`تنقل د. ${profName} في ${day}`] = `${uniqueLocations} مواقع`;
            }
        }
    }
    evaluationDetails[`إجمالي مرات تنقل الدكاترة بين المباني`] = totalRoomSwitches;
    score -= totalRoomSwitches * 2;

    const dailySlotCount = {};
    DAYS.forEach(day => dailySlotCount[day] = 0);
    schedule.forEach(appt => dailySlotCount[appt.day]++);

    const sortedDayLoads = Object.values(dailySlotCount).sort((a,b) => a - b);
    if (sortedDayLoads.length > 0) {
        const minLoad = sortedDayLoads[0];
        const maxLoad = sortedDayLoads[sortedDayLoads.length - 1];
        const loadDifference = maxLoad - minLoad;
        evaluationDetails[`توازن توزيع الحصص اليومي (الفرق بين الأعلى والأقل)`] = loadDifference;
        score -= loadDifference * 1;
    }


    const conflicts = validateFullSchedule(schedule);
    if (conflicts.length > 0) {
        score -= conflicts.length * 20;
        evaluationDetails['تعارضات'] = conflicts.length;
        evaluationDetails['تفاصيل التعارضات'] = conflicts;
    }

    score = Math.max(0, score);
    return { score: Math.round(score), details: evaluationDetails };
};

export const generateMultipleScenarios = (numScenarios = 3) => {
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

export const suggestAlternativeTimes = (problematicAppointment) => {
    const professorsData = getProfessors();
    const roomsData = getRooms();
    const coursesData = getCourses();
    const tempSchedule = [...getCurrentSchedule()].filter(appt => appt.id !== problematicAppointment.id);

    const course = coursesData.find(c => c.id === problematicAppointment.courseId);
    const professor = professorsData.find(p => p.id === problematicAppointment.professorId);
    const problematicRoom = roomsData.find(r => r.id === problematicAppointment.roomId);

    const suggestions = [];

    for (const day of DAYS) {
        if (professor?.preferences?.noFriday && day === "الجمعة") continue;
        if (professor?.preferences?.noMonday && day === "الاثنين") continue;

        for (const timeRange of TIME_SLOTS) {
            const newApptTime = parseTimeRange(timeRange);
            if (!newApptTime) continue;
            const { start: slotStart, end: slotEnd } = newApptTime;

            let professorAvailable = professor?.availableTimes.some(pt => {
                const [ptDay, ptRangeStr] = pt.split(':');
                const ptRange = parseTimeRange(ptRangeStr);
                if (!ptRange) return false;
                return ptDay === day && !isTimeConflict(slotStart, slotEnd, ptRange.start, ptRange.end);
            }) || false;

            let roomAvailable = problematicRoom?.availableTimes.some(rt => {
                const [rtDay, rtRangeStr] = rt.split(':');
                const rtRange = parseTimeRange(rtRangeStr);
                if (!rtRange) return false;
                return rtDay === day && !isTimeConflict(slotStart, slotEnd, rtRange.start, rtRange.end);
            }) || false;

            const potentialAppointment = {
                id: generateUniqueId(),
                courseId: problematicAppointment.courseId,
                courseName: problematicAppointment.courseName,
                sectionName: problematicAppointment.sectionName,
                department: problematicAppointment.department,
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
