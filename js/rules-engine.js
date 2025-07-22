// js/rules-engine.js

const RulesEngine = (function() {

    function applyRules(schedule, doctors, courses, rooms, individualSchedules) {
        let modifiedSchedule = JSON.parse(JSON.stringify(schedule)); // Deep copy to modify

        // 1. احترام عدد ساعات التدريس المسموح بها لكل دكتور (تم التعامل معها جزئياً في Scheduler)
        // هذه القاعدة يجب أن يتم فرضها بقوة أثناء التخصيص في Scheduler.

        // 2. تحديد فترات راحة إلزامية بين محاضرات الدكتور
        // هذه القاعدة يجب أن يتم فحصها بشكل مستمر عند محاولة تعيين محاضرة لدكتور.
        // مثال: إذا كانت المحاضرة الحالية تنتهي الساعة 10:00، والمحاضرة التالية تبدأ الساعة 10:00، هذا قد يكون تضاربًا.
        // يتطلب هذا البحث في جدول الدكتور الفردي.
        for (const docId in individualSchedules.doctors) {
            const docSchedule = individualSchedules.doctors[docId].sort((a, b) => {
                // ترتيب المحاضرات حسب اليوم والوقت
                const dayA = Scheduler.DAYS.indexOf(a.day);
                const dayB = Scheduler.DAYS.indexOf(b.day);
                if (dayA !== dayB) return dayA - dayB;
                const timeA = Scheduler.TIMES.indexOf(a.time);
                const timeB = Scheduler.TIMES.indexOf(b.time);
                return timeA - timeB;
            });

            for (let i = 0; i < docSchedule.length - 1; i++) {
                const currentLecture = docSchedule[i];
                const nextLecture = docSchedule[i+1];

                if (currentLecture.day === nextLecture.day) {
                    const currentTimeIndex = Scheduler.TIMES.indexOf(currentLecture.time);
                    const nextTimeIndex = Scheduler.TIMES.indexOf(nextLecture.time);

                    // افتراض أن المحاضرة تستغرق ساعة واحدة
                    // إذا كانت المحاضرة التالية تبدأ مباشرة بعد الحالية، فربما نحتاج لفاصل
                    if (nextTimeIndex === currentTimeIndex + 1) {
                         // هنا يمكننا إضافة منطق لفرض فترة راحة.
                         // مثلاً، إذا كان يجب أن تكون هناك فترة زمنية فاصلة، فهذا تضارب.
                         // في هذه الحالة، سنحتاج إلى نقل `nextLecture`.
                         // هذا الجزء معقد ويتطلب تعديل `modifiedSchedule` أو إعادة استدعاء `Scheduler`
                         // أو وضع علامة على هذه الحالة ليتم حلها يدويًا.
                         console.warn(`Doctor ${docId} has back-to-back lectures on ${currentLecture.day} at ${currentLecture.time} and ${nextLecture.time}.`);
                    }
                }
            }
        }

        // 3. دعم فترات "ممنوعة" (مثلاً لا محاضرات بعد الساعة 3م)
        // يمكن تحديدها كقاعدة عامة أو لتفضيلات دكتور معين.
        const forbiddenEndTimeIndex = Scheduler.TIMES.indexOf('15:00'); // لا محاضرات بعد الساعة 3م
        for (const day in modifiedSchedule) {
            for (const time in modifiedSchedule[day]) {
                const timeIndex = Scheduler.TIMES.indexOf(time);
                if (timeIndex >= forbiddenEndTimeIndex) {
                    for (const roomId in modifiedSchedule[day][time]) {
                        if (modifiedSchedule[day][time][roomId] !== null) {
                            console.warn(`Lecture assigned after forbidden time on ${day} at ${time} in room ${roomId}.`);
                            // هنا يجب محاولة نقل هذه المحاضرة إلى وقت مسموح.
                            // هذا يتطلب منطق إعادة التخصيص أو الإبلاغ عنها.
                        }
                    }
                }
            }
        }

        // 4. توازن توزيع المحاضرات على أيام الأسبوع
        // حساب عدد المحاضرات لكل دكتور في كل يوم ومحاولة تحقيق التوازن.
        // هذه قاعدة تحسينية وليست إلزامية، ويمكن أن تتم بعد التوليد الأولي.
        // (مثال بسيط: لا تسمح لدكتور بأن يدرس كل محاضراته يوم واحد).

        // 5. تفضيل أوقات معينة لكل دكتور (مثلاً: صباحًا فقط)
        // يمكن تخزين هذه التفضيلات في بيانات الدكتور واستخدامها في `Scheduler` عند اختيار الوقت.
        // مثال:
        // if (doctor.preferences.preferredTimeOfDay === 'morning' && timeIndex > Scheduler.TIMES.indexOf('12:00')) {
        //     // تجنب هذا الوقت للدكتور
        // }

        // 6. تذكُّر القاعات المفضلة لكل مادة (يتم تخزينها في بيانات المواد)
        // عند اختيار قاعة في `Scheduler`، أعطِ الأفضلية للقاعات المفضلة للمادة أولاً.


        return modifiedSchedule; // Return the schedule after applying rules
    }

    return {
        applyRules
    };
})();
