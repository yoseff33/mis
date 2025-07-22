// js/main.js

import { loadData, saveData, initializeDummyData, academicPeriod } from './dataManager.js';
import { setAlertDiv, calculateTimeSlotsMinutes, parseTimeRange, showAlert } from './utils.js';
import { generateSchedule, optimizeScheduleForGaps, fixAllConflictsAutomatically } from './scheduler.js';
import { TIME_SLOTS } from './constants.js';

import {
    renderDataEntryForms, populateDatalists, renderProfessorList, renderRoomList, renderCourseList,
    renderScheduleGrid, openEditModal, closeEditModal, displayScheduleConflicts,
    renderReports, renderProfessorSchedules, exportScheduleToPDF, exportScheduleToExcel, exportScheduleToImage
} from './uiManager.js';

/**
 * تهيئة التطبيق لكل صفحة HTML على حدة.
 */
export const initializeAppPage = (currentPageId) => {
    loadData();
    import('./dataManager.js').then(module => {
        if (module.getProfessors().length === 0 && module.getRooms().length === 0 && module.getCourses().length === 0) {
            module.initializeDummyData();
        }
        calculateTimeSlotsMinutes();
    });

    const conflictAlertsDiv = document.getElementById('conflict-alerts');
    if (conflictAlertsDiv) setAlertDiv(conflictAlertsDiv);

    if (currentPageId === 'data-entry') {
        const professorForm = document.getElementById('professor-form');
        const roomForm = document.getElementById('room-form');
        const courseForm = document.getElementById('course-form');
        const globalSearchInput = document.getElementById('global-search');

        const courseProfessorSelect = document.getElementById('course-professor-id');
        const profNamesSuggestions = document.getElementById('prof-names-suggestions');
        const roomNamesSuggestions = document.getElementById('room-names-suggestions');
        const courseNamesSuggestions = document.getElementById('course-names-suggestions');
        const departmentSuggestions = document.getElementById('department-suggestions');

        const professorListDiv = document.getElementById('professor-list');
        const roomListDiv = document.getElementById('room-list');
        const courseListDiv = document.getElementById('course-list');

        const uploadProfessorsInput = document.getElementById('upload-professors');
        const uploadRoomsInput = document.getElementById('upload-rooms');
        const uploadCoursesInput = document.getElementById('upload-courses');

        if (professorForm) {
            professorForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(professorForm);
                const newProf = {
                    name: formData.get('profName'),
                    availableTimes: formData.get('profAvailableTimes').split(',').map(s => s.trim()).filter(s => s),
                    priority: parseInt(formData.get('profPriority')) || 0,
                    preferences: { noFriday: formData.get('profNoFriday') === 'on' }
                };
                import('./dataManager.js').then(module => {
                    module.addProfessor(newProf);
                    renderProfessorList(professorListDiv, globalSearchInput.value);
                    renderDataEntryForms(courseProfessorSelect);
                    professorForm.reset();
                    showAlert('تم إضافة الدكتور بنجاح.', 'success');
                    populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions);
                });
            });
        }

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
                    renderRoomList(roomListDiv, globalSearchInput.value);
                    roomForm.reset();
                    showAlert('تم إضافة القاعة/المعمل بنجاح.', 'success');
                    populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions);
                });
            });
        }

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
                    preferredTimes: formData.get('coursePreferredTimes') ?
                        formData.get('coursePreferredTimes').split(',').map(s => s.trim()).filter(s => s) : [],
                    notes: formData.get('courseNotes') || ''
                };
                import('./dataManager.js').then(module => {
                    module.addCourse(newCourse);
                    renderCourseList(courseListDiv, globalSearchInput.value);
                    renderDataEntryForms(courseProfessorSelect);
                    courseForm.reset();
                    showAlert('تم إضافة المادة بنجاح.', 'success');
                    populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions);
                });
            });
        }

        if (globalSearchInput) {
            globalSearchInput.addEventListener('input', () => {
                const searchTerm = globalSearchInput.value;
                renderProfessorList(professorListDiv, searchTerm);
                renderRoomList(roomListDiv, searchTerm);
                renderCourseList(courseListDiv, searchTerm);
            });
        }

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
                        renderProfessorList(professorListDiv, globalSearchInput.value);
                        renderRoomList(roomListDiv, globalSearchInput.value);
                        renderCourseList(courseListDiv, globalSearchInput.value);
                        renderDataEntryForms(courseProfessorSelect);
                        showAlert(`تم حذف الـ ${type} بنجاح.`, 'success');
                        populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions);
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

        renderProfessorList(professorListDiv, '');
        renderRoomList(roomListDiv, '');
        renderCourseList(courseListDiv, '');
        renderDataEntryForms(courseProfessorSelect);
        populateDatalists(profNamesSuggestions, roomNamesSuggestions, courseNamesSuggestions, departmentSuggestions);
    }

    // باقي صفحات التطبيق (schedule-view, reports, settings...) لا تغييرات فيها.
};

document.addEventListener('DOMContentLoaded', () => {
    let currentPageId = document.body.id || 'index';
    const mainSection = document.querySelector('main section.active-section');
    if (mainSection) {
        currentPageId = mainSection.id;
    }

    import('./dataManager.js').then(module => {
        module.loadData();
        if (module.getProfessors().length === 0 && module.getRooms().length === 0 && module.getCourses().length === 0) {
            module.initializeDummyData();
        }
        calculateTimeSlotsMinutes();
        initializeAppPage(currentPageId);
    });
});
