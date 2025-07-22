// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // تهيئة جميع وحدات الواجهة
    UI.init();

    // ربط أزرار التصدير والطباعة
    document.getElementById('exportPngBtn').addEventListener('click', () => {
        ExportManager.exportScheduleToPng('scheduleDisplay');
    });
    document.getElementById('exportPdfBtn').addEventListener('click', () => {
        ExportManager.exportScheduleToPdf('scheduleDisplay');
    });
    document.getElementById('printBtn').addEventListener('click', () => {
        ExportManager.printSchedule('scheduleDisplay');
    });

    // زر الوضع الليلي (يمكن أن يكون في الإعدادات)
    // document.getElementById('darkModeToggle').addEventListener('click', UI.toggleDarkMode);

    // عرض قسم إدخال البيانات كقسم افتراضي
    UI.showSection('dataEntrySection');
});
