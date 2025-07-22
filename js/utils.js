// js/utils.js

const Utils = (function() {
    function getUniqueId(prefix = '') {
        return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // وظيفة لتحويل الوقت إلى تنسيق معين (مثلاً للتصنيف)
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // وظيفة بسيطة للتحقق من صحة الإدخال
    function isValidInput(value) {
        return value !== null && value !== undefined && value.toString().trim() !== '';
    }

    return {
        getUniqueId,
        timeToMinutes,
        isValidInput
    };
})();
