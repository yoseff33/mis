(() => {
  "use strict";

  const BUSINESS = Object.freeze({
    name: "مؤسسة يوسف عيد المطيري لقطع غيار السيارات",
    commercialRegistration: "7054534024",
    address: "C2MH+P5، الصناعية، حفر الباطن 39925"
  });

  const STORAGE = Object.freeze({
    settings: "yousefAutoPartsInvoiceSettingsV1",
    history: "yousefAutoPartsInvoiceHistoryV1"
  });

  const MAX_HISTORY = 50;
  const state = {
    items: [],
    nextItemId: 1,
    logoDataUrl: "",
    qrText: ""
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    sellerVatNumber: $("sellerVatNumber"),
    logoUpload: $("logoUpload"),
    logoStatus: $("logoStatus"),
    logoPreviewWrap: $("logoPreviewWrap"),
    logoPreview: $("logoPreview"),
    removeLogoBtn: $("removeLogoBtn"),
    invoiceTitle: $("invoiceTitle"),
    invoiceNumber: $("invoiceNumber"),
    invoiceDate: $("invoiceDate"),
    taxIncluded: $("taxIncluded"),
    taxRate: $("taxRate"),
    itemsBody: $("itemsBody"),
    addItemBtn: $("addItemBtn"),
    subtotalAmount: $("subtotalAmount"),
    taxAmount: $("taxAmount"),
    totalAmount: $("totalAmount"),
    invoiceTerms: $("invoiceTerms"),
    qrCanvas: $("qrCanvas"),
    qrHint: $("qrHint"),
    savePdfBtn: $("savePdfBtn"),
    sharePdfBtn: $("sharePdfBtn"),
    printBtn: $("printBtn"),
    newInvoiceBtn: $("newInvoiceBtn"),
    actionStatus: $("actionStatus"),
    historyBtn: $("historyBtn"),
    historyModal: $("historyModal"),
    closeHistoryBtn: $("closeHistoryBtn"),
    historyList: $("historyList"),
    invoicePrintContainer: $("invoicePrintContainer")
  };

  function init() {
    els.invoiceDate.value = todayIso();
    els.invoiceNumber.value = generateInvoiceNumber();
    loadSettings();
    addItem();
    bindEvents();
    recalculate();
    refreshQr();
  }

  function bindEvents() {
    els.addItemBtn.addEventListener("click", () => addItem());
    els.itemsBody.addEventListener("input", handleItemInput);
    els.itemsBody.addEventListener("click", handleItemClick);

    [els.invoiceTitle, els.invoiceNumber, els.invoiceDate, els.taxRate, els.invoiceTerms]
      .forEach((element) => element.addEventListener("input", handleInvoiceChange));

    els.taxIncluded.addEventListener("change", handleInvoiceChange);
    els.sellerVatNumber.addEventListener("input", () => {
      els.sellerVatNumber.value = els.sellerVatNumber.value.replace(/\D/g, "").slice(0, 15);
      saveSettings();
      refreshQr();
    });

    els.logoUpload.addEventListener("change", handleLogoUpload);
    els.removeLogoBtn.addEventListener("click", removeLogo);

    els.savePdfBtn.addEventListener("click", () => runAction(els.savePdfBtn, savePdf));
    els.sharePdfBtn.addEventListener("click", () => runAction(els.sharePdfBtn, sharePdf));
    els.printBtn.addEventListener("click", () => runAction(els.printBtn, printInvoice));
    els.newInvoiceBtn.addEventListener("click", newInvoice);

    els.historyBtn.addEventListener("click", openHistory);
    els.closeHistoryBtn.addEventListener("click", closeHistory);
    els.historyModal.querySelectorAll("[data-close-modal]").forEach((node) => node.addEventListener("click", closeHistory));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeHistory();
    });
  }

  function handleInvoiceChange() {
    const rate = clampNumber(els.taxRate.value, 0, 100);
    if (String(rate) !== els.taxRate.value && document.activeElement !== els.taxRate) {
      els.taxRate.value = String(rate);
    }
    recalculate();
    saveSettings();
    refreshQr();
  }

  function addItem(item = {}) {
    const model = {
      id: state.nextItemId++,
      partNumber: String(item.partNumber || ""),
      description: String(item.description || ""),
      quantity: positiveNumber(item.quantity, 1),
      unitPrice: nonNegativeNumber(item.unitPrice, 0)
    };
    state.items.push(model);
    renderItems();
    recalculate();
  }

  function renderItems() {
    els.itemsBody.innerHTML = state.items.map((item, index) => `
      <tr data-id="${item.id}">
        <td>${index + 1}</td>
        <td><input class="part-number-input" data-field="partNumber" value="${escapeHtml(item.partNumber)}" maxlength="60" placeholder="اختياري"></td>
        <td><input class="description-input" data-field="description" value="${escapeHtml(item.description)}" maxlength="160" placeholder="اسم القطعة أو وصفها"></td>
        <td><input data-field="quantity" type="number" min="0.01" step="0.01" value="${item.quantity}"></td>
        <td><input data-field="unitPrice" type="number" min="0" step="0.01" value="${item.unitPrice}"></td>
        <td class="amount-cell" data-value="subtotal">0.00</td>
        <td class="amount-cell" data-value="tax">0.00</td>
        <td class="amount-cell" data-value="total">0.00</td>
        <td><button class="delete-item" data-delete-item type="button" aria-label="حذف البند">×</button></td>
      </tr>
    `).join("");
    updateRowAmounts();
  }

  function handleItemInput(event) {
    const input = event.target.closest("input[data-field]");
    if (!input) return;
    const row = input.closest("tr[data-id]");
    const item = state.items.find((entry) => entry.id === Number(row.dataset.id));
    if (!item) return;

    const field = input.dataset.field;
    if (field === "quantity") item.quantity = positiveNumber(input.value, 1);
    else if (field === "unitPrice") item.unitPrice = nonNegativeNumber(input.value, 0);
    else item[field] = input.value;

    recalculate();
    refreshQr();
  }

  function handleItemClick(event) {
    const button = event.target.closest("[data-delete-item]");
    if (!button) return;
    const row = button.closest("tr[data-id]");
    const id = Number(row.dataset.id);

    if (state.items.length === 1) {
      state.items[0] = { id, partNumber: "", description: "", quantity: 1, unitPrice: 0 };
    } else {
      state.items = state.items.filter((item) => item.id !== id);
    }
    renderItems();
    recalculate();
    refreshQr();
  }

  function calculateItem(item) {
    const rate = clampNumber(els.taxRate.value, 0, 100) / 100;
    const grossInput = nonNegativeNumber(item.unitPrice, 0) * positiveNumber(item.quantity, 1);
    let subtotal;
    let tax;
    let total;

    if (els.taxIncluded.checked && rate > 0) {
      total = grossInput;
      subtotal = total / (1 + rate);
      tax = total - subtotal;
    } else {
      subtotal = grossInput;
      tax = subtotal * rate;
      total = subtotal + tax;
    }

    return { subtotal, tax, total };
  }

  function totals() {
    return state.items.reduce((sum, item) => {
      const value = calculateItem(item);
      sum.subtotal += value.subtotal;
      sum.tax += value.tax;
      sum.total += value.total;
      return sum;
    }, { subtotal: 0, tax: 0, total: 0 });
  }

  function recalculate() {
    updateRowAmounts();
    const sum = totals();
    els.subtotalAmount.textContent = money(sum.subtotal);
    els.taxAmount.textContent = money(sum.tax);
    els.totalAmount.textContent = money(sum.total);
  }

  function updateRowAmounts() {
    els.itemsBody.querySelectorAll("tr[data-id]").forEach((row) => {
      const item = state.items.find((entry) => entry.id === Number(row.dataset.id));
      if (!item) return;
      const value = calculateItem(item);
      row.querySelector('[data-value="subtotal"]').textContent = number(value.subtotal);
      row.querySelector('[data-value="tax"]').textContent = number(value.tax);
      row.querySelector('[data-value="total"]').textContent = number(value.total);
    });
  }

  function getInvoiceData() {
    const sum = totals();
    return {
      version: 1,
      title: els.invoiceTitle.value.trim() || "فاتورة",
      number: els.invoiceNumber.value.trim() || generateInvoiceNumber(),
      date: els.invoiceDate.value || todayIso(),
      vatNumber: els.sellerVatNumber.value.trim(),
      taxRate: clampNumber(els.taxRate.value, 0, 100),
      taxIncluded: els.taxIncluded.checked,
      terms: els.invoiceTerms.value.trim(),
      logoDataUrl: state.logoDataUrl,
      items: state.items.map((item) => ({
        partNumber: item.partNumber.trim(),
        description: item.description.trim(),
        quantity: positiveNumber(item.quantity, 1),
        unitPrice: nonNegativeNumber(item.unitPrice, 0)
      })),
      totals: sum,
      savedAt: new Date().toISOString()
    };
  }

  function validateInvoice() {
    if (!els.invoiceNumber.value.trim()) {
      showStatus("أدخل رقم الفاتورة.", true);
      els.invoiceNumber.focus();
      return false;
    }
    const hasValidItem = state.items.some((item) =>
      (item.description.trim() || item.partNumber.trim()) && nonNegativeNumber(item.unitPrice, 0) > 0
    );
    if (!hasValidItem) {
      showStatus("أضف بندًا واحدًا على الأقل مع رقم قطعة أو وصف وسعر.", true);
      return false;
    }
    const vat = els.sellerVatNumber.value.trim();
    if (vat && vat.length !== 15) {
      showStatus("الرقم الضريبي يجب أن يتكون من 15 رقمًا.", true);
      els.sellerVatNumber.focus();
      return false;
    }
    return true;
  }

  async function refreshQr() {
    clearQrCanvas(els.qrCanvas);
    const vat = els.sellerVatNumber.value.trim();
    if (vat.length !== 15) {
      state.qrText = "";
      els.qrHint.textContent = vat ? "الرقم الضريبي يجب أن يكون 15 رقمًا." : "أدخل الرقم الضريبي لإظهار رمز QR.";
      return;
    }

    const data = getInvoiceData();
    state.qrText = createTaxQrPayload({
      sellerName: BUSINESS.name,
      vatNumber: vat,
      timestamp: new Date().toISOString(),
      total: fixedNumber(data.totals.total),
      tax: fixedNumber(data.totals.tax)
    });

    try {
      await drawQr(els.qrCanvas, state.qrText, 160);
      els.qrHint.textContent = "رمز QR جاهز.";
    } catch (error) {
      state.qrText = "";
      els.qrHint.textContent = "تعذر إنشاء رمز QR.";
      console.error(error);
    }
  }

  function createTaxQrPayload({ sellerName, vatNumber, timestamp, total, tax }) {
    const encoder = new TextEncoder();
    const fields = [sellerName, vatNumber, timestamp, total, tax];
    const bytes = [];

    fields.forEach((value, index) => {
      const encoded = encoder.encode(String(value));
      if (encoded.length > 255) throw new Error("قيمة QR طويلة جدًا");
      bytes.push(index + 1, encoded.length, ...encoded);
    });

    let binary = "";
    Uint8Array.from(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function drawQr(canvas, text, width) {
    return new Promise((resolve, reject) => {
      if (!window.QRCode || typeof window.QRCode.toCanvas !== "function") {
        reject(new Error("مكتبة QR غير متاحة"));
        return;
      }
      window.QRCode.toCanvas(canvas, text, {
        width,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#111827", light: "#ffffff" }
      }, (error) => error ? reject(error) : resolve());
    });
  }

  function clearQrCanvas(canvas) {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function handleLogoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showStatus("الملف المختار ليس صورة.", true);
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showStatus("حجم الشعار أكبر من 2 ميجابايت.", true);
      event.target.value = "";
      return;
    }

    try {
      state.logoDataUrl = await resizeImage(file, 500, 500, 0.88);
      updateLogoPreview();
      saveSettings();
      showStatus("تم حفظ الشعار داخل هذا الجهاز.");
    } catch (error) {
      showStatus("تعذر قراءة الشعار المختار.", true);
      console.error(error);
    } finally {
      event.target.value = "";
    }
  }

  function resizeImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * ratio));
          canvas.height = Math.max(1, Math.round(image.height * ratio));
          const context = canvas.getContext("2d");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/webp", quality));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function updateLogoPreview() {
    const hasLogo = Boolean(state.logoDataUrl);
    els.logoPreviewWrap.hidden = !hasLogo;
    if (hasLogo) {
      els.logoPreview.src = state.logoDataUrl;
      els.logoStatus.textContent = "الشعار محفوظ داخل هذا الجهاز.";
    } else {
      els.logoPreview.removeAttribute("src");
      els.logoStatus.textContent = "PNG أو JPG أو WebP، بحد أقصى 2 ميجابايت.";
    }
  }

  function removeLogo() {
    state.logoDataUrl = "";
    updateLogoPreview();
    saveSettings();
    showStatus("تم حذف الشعار.");
  }

  function saveSettings() {
    const settings = {
      vatNumber: els.sellerVatNumber.value.trim(),
      taxRate: clampNumber(els.taxRate.value, 0, 100),
      taxIncluded: els.taxIncluded.checked,
      invoiceTitle: els.invoiceTitle.value,
      terms: els.invoiceTerms.value,
      logoDataUrl: state.logoDataUrl
    };
    try {
      localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
    } catch (error) {
      console.warn("تعذر حفظ الإعدادات محليًا", error);
    }
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.settings) || "null");
      if (!saved || typeof saved !== "object") return;
      els.sellerVatNumber.value = String(saved.vatNumber || "").replace(/\D/g, "").slice(0, 15);
      els.taxRate.value = String(saved.taxRate ?? 15);
      els.taxIncluded.checked = saved.taxIncluded !== false;
      els.invoiceTitle.value = String(saved.invoiceTitle || "فاتورة ضريبية مبسطة");
      els.invoiceTerms.value = String(saved.terms || "");
      state.logoDataUrl = String(saved.logoDataUrl || "");
      updateLogoPreview();
    } catch (error) {
      console.warn("تعذر تحميل الإعدادات المحلية", error);
    }
  }

  function saveHistory(data) {
    try {
      const history = readHistory();
      const duplicateIndex = history.findIndex((entry) => entry.number === data.number);
      if (duplicateIndex >= 0) history.splice(duplicateIndex, 1);
      history.unshift({ ...data, logoDataUrl: "" });
      localStorage.setItem(STORAGE.history, JSON.stringify(history.slice(0, MAX_HISTORY)));
    } catch (error) {
      console.warn("تعذر حفظ الفاتورة في المحفوظات", error);
    }
  }

  function readHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE.history) || "[]");
      return Array.isArray(history) ? history : [];
    } catch {
      return [];
    }
  }

  function openHistory() {
    renderHistory();
    els.historyModal.classList.add("active");
    els.historyModal.setAttribute("aria-hidden", "false");
  }

  function closeHistory() {
    els.historyModal.classList.remove("active");
    els.historyModal.setAttribute("aria-hidden", "true");
  }

  function renderHistory() {
    const history = readHistory();
    if (!history.length) {
      els.historyList.innerHTML = '<div class="history-empty">ما فيه فواتير محفوظة على هذا الجهاز حتى الآن.</div>';
      return;
    }

    els.historyList.innerHTML = history.map((entry, index) => `
      <article class="history-entry">
        <div class="history-entry-top">
          <h3>${escapeHtml(entry.number || "فاتورة")}</h3>
          <time>${escapeHtml(formatDateTime(entry.savedAt))}</time>
        </div>
        <div class="history-entry-details">
          <span>${escapeHtml(entry.title || "فاتورة")}</span>
          <span>${number(entry.totals?.total || 0)} ريال</span>
          <span>${Array.isArray(entry.items) ? entry.items.length : 0} بند</span>
        </div>
        <div class="history-entry-actions">
          <button class="history-load" type="button" data-load-history="${index}">تحميل للتعديل</button>
          <button class="history-delete" type="button" data-delete-history="${index}">حذف</button>
        </div>
      </article>
    `).join("");

    els.historyList.querySelectorAll("[data-load-history]").forEach((button) => {
      button.addEventListener("click", () => loadHistory(Number(button.dataset.loadHistory)));
    });
    els.historyList.querySelectorAll("[data-delete-history]").forEach((button) => {
      button.addEventListener("click", () => deleteHistory(Number(button.dataset.deleteHistory)));
    });
  }

  function loadHistory(index) {
    const entry = readHistory()[index];
    if (!entry) return;
    els.invoiceTitle.value = entry.title || "فاتورة ضريبية مبسطة";
    els.invoiceNumber.value = entry.number || generateInvoiceNumber();
    els.invoiceDate.value = entry.date || todayIso();
    els.sellerVatNumber.value = String(entry.vatNumber || "").replace(/\D/g, "").slice(0, 15);
    els.taxRate.value = String(entry.taxRate ?? 15);
    els.taxIncluded.checked = entry.taxIncluded !== false;
    els.invoiceTerms.value = entry.terms || "";
    if (entry.logoDataUrl) state.logoDataUrl = entry.logoDataUrl;
    updateLogoPreview();

    state.items = [];
    state.nextItemId = 1;
    const items = Array.isArray(entry.items) && entry.items.length ? entry.items : [{}];
    items.forEach((item) => {
      state.items.push({
        id: state.nextItemId++,
        partNumber: String(item.partNumber || ""),
        description: String(item.description || ""),
        quantity: positiveNumber(item.quantity, 1),
        unitPrice: nonNegativeNumber(item.unitPrice, 0)
      });
    });
    renderItems();
    recalculate();
    saveSettings();
    refreshQr();
    closeHistory();
    showStatus("تم تحميل الفاتورة للتعديل.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteHistory(index) {
    if (!window.confirm("متأكد من حذف الفاتورة من هذا الجهاز؟")) return;
    const history = readHistory();
    history.splice(index, 1);
    localStorage.setItem(STORAGE.history, JSON.stringify(history));
    renderHistory();
  }

  async function renderPrint(data) {
    const rows = data.items.map((item, index) => {
      const values = calculateItem(item);
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.partNumber || "—")}</td>
          <td class="desc">${escapeHtml(item.description || "—")}</td>
          <td>${number(item.quantity)}</td>
          <td>${number(item.unitPrice)}</td>
          <td>${number(values.subtotal)}</td>
          <td>${number(values.tax)}</td>
          <td>${number(values.total)}</td>
        </tr>`;
    }).join("");

    const logo = data.logoDataUrl
      ? `<img class="print-logo" src="${data.logoDataUrl}" alt="شعار المنشأة">`
      : `<div></div>`;
    const vatLine = data.vatNumber
      ? `<div><strong>الرقم الضريبي:</strong> ${escapeHtml(data.vatNumber)}</div>`
      : "";
    const terms = data.terms
      ? `<div class="print-terms"><strong>ملاحظات وشروط:</strong><br>${escapeHtml(data.terms)}</div>`
      : "";
    const qrBlock = state.qrText
      ? `<div class="print-qr"><canvas id="printQrCanvas" width="130" height="130"></canvas><div>رمز QR</div></div>`
      : `<div></div>`;

    els.invoicePrintContainer.innerHTML = `
      <div class="print-sheet">
        <div class="print-header">
          <div>${logo}</div>
          <div class="print-header-center">
            <h1>${escapeHtml(data.title)}</h1>
            <p>${escapeHtml(BUSINESS.name)}</p>
          </div>
          <div class="print-meta">
            <div><strong>رقم الفاتورة:</strong><br>${escapeHtml(data.number)}</div>
            <div><strong>التاريخ:</strong><br>${escapeHtml(formatDate(data.date))}</div>
          </div>
        </div>

        <div class="print-business">
          <div><strong>اسم المنشأة:</strong> ${escapeHtml(BUSINESS.name)}</div>
          <div><strong>السجل التجاري:</strong> ${escapeHtml(BUSINESS.commercialRegistration)}</div>
          <div class="wide"><strong>الموقع:</strong> ${escapeHtml(BUSINESS.address)}</div>
          ${vatLine}
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>رقم القطعة</th>
              <th>الوصف</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>قبل الضريبة</th>
              <th>الضريبة</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="print-bottom">
          <div class="print-summary">
            <div><span>المجموع قبل الضريبة</span><strong>${money(data.totals.subtotal)}</strong></div>
            <div><span>ضريبة القيمة المضافة (${number(data.taxRate)}%)</span><strong>${money(data.totals.tax)}</strong></div>
            <div><span>الإجمالي شامل الضريبة</span><strong>${money(data.totals.total)}</strong></div>
          </div>
          ${qrBlock}
        </div>
        ${terms}
        <div class="print-footer">
          ${escapeHtml(BUSINESS.name)} — السجل التجاري ${escapeHtml(BUSINESS.commercialRegistration)}
        </div>
      </div>`;

    if (state.qrText) {
      const printCanvas = $("printQrCanvas");
      await drawQr(printCanvas, state.qrText, 130);
    }
    return els.invoicePrintContainer.querySelector(".print-sheet");
  }

  async function createPdfBlob(data) {
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      throw new Error("مكتبات PDF غير متاحة");
    }
    const sheet = await renderPrint(data);
    await document.fonts?.ready;

    const container = els.invoicePrintContainer;
    const previous = {
      left: container.style.left,
      top: container.style.top,
      zIndex: container.style.zIndex
    };
    container.style.left = "0";
    container.style.top = "0";
    container.style.zIndex = "-1";

    try {
      const canvas = await window.html2canvas(sheet, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: sheet.scrollWidth,
        windowHeight: sheet.scrollHeight
      });
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const pageHeightPx = Math.floor(canvas.width * pageHeightMm / pageWidthMm);
      let offsetY = 0;
      let page = 0;

      while (offsetY < canvas.height) {
        const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        pageCanvas.getContext("2d").drawImage(
          canvas,
          0, offsetY, canvas.width, sliceHeight,
          0, 0, canvas.width, sliceHeight
        );
        const imageData = pageCanvas.toDataURL("image/jpeg", 0.94);
        const imageHeightMm = sliceHeight * pageWidthMm / canvas.width;
        if (page > 0) pdf.addPage();
        pdf.addImage(imageData, "JPEG", 0, 0, pageWidthMm, imageHeightMm, undefined, "FAST");
        offsetY += sliceHeight;
        page += 1;
      }
      return pdf.output("blob");
    } finally {
      container.style.left = previous.left;
      container.style.top = previous.top;
      container.style.zIndex = previous.zIndex;
    }
  }

  async function savePdf() {
    if (!validateInvoice()) return;
    await refreshQr();
    const data = getInvoiceData();
    const blob = await createPdfBlob(data);
    downloadBlob(blob, `${safeFileName(data.number)}.pdf`);
    saveHistory(data);
    showStatus("تم حفظ ملف PDF وإضافة الفاتورة للمحفوظات.");
  }

  async function sharePdf() {
    if (!validateInvoice()) return;
    await refreshQr();
    const data = getInvoiceData();
    const blob = await createPdfBlob(data);
    const file = new File([blob], `${safeFileName(data.number)}.pdf`, { type: "application/pdf" });

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: `${data.title} ${data.number}`,
        text: `${BUSINESS.name} — ${data.number}`,
        files: [file]
      });
      saveHistory(data);
      showStatus("تم فتح خيارات المشاركة.");
      return;
    }

    downloadBlob(blob, file.name);
    saveHistory(data);
    showStatus("المشاركة المباشرة غير مدعومة هنا؛ تم تنزيل ملف PDF بدلًا منها.");
  }

  async function printInvoice() {
    if (!validateInvoice()) return;
    await refreshQr();
    const data = getInvoiceData();
    await renderPrint(data);
    saveHistory(data);
    showStatus("تم تجهيز الفاتورة للطباعة.");
    window.print();
  }

  function newInvoice() {
    if (!window.confirm("فتح فاتورة جديدة؟ سيتم مسح البنود الحالية فقط.")) return;
    els.invoiceNumber.value = generateInvoiceNumber();
    els.invoiceDate.value = todayIso();
    state.items = [];
    state.nextItemId = 1;
    addItem();
    recalculate();
    refreshQr();
    showStatus("تم فتح فاتورة جديدة مع الاحتفاظ ببيانات المنشأة.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function runAction(button, action) {
    const buttons = [els.savePdfBtn, els.sharePdfBtn, els.printBtn, els.newInvoiceBtn];
    buttons.forEach((entry) => { entry.disabled = true; });
    const originalText = button.textContent;
    button.textContent = "جاري التجهيز...";
    showStatus("");
    try {
      await action();
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        showStatus("صار خطأ أثناء تجهيز الفاتورة. جرّب مرة ثانية.", true);
      }
    } finally {
      button.textContent = originalText;
      buttons.forEach((entry) => { entry.disabled = false; });
    }
  }

  function showStatus(message, isError = false) {
    els.actionStatus.textContent = message;
    els.actionStatus.style.color = isError ? "#b42318" : "#456173";
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function generateInvoiceNumber() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    return `INV-${y}${m}${d}-${random}`;
  }

  function todayIso() {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }

  function formatDateTime(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function money(value) { return `${number(value)} ريال`; }
  function fixedNumber(value) {
    return (Number(value) || 0).toFixed(2);
  }
  function number(value) {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  }
  function nonNegativeNumber(value, fallback) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
  }
  function positiveNumber(value, fallback) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
  }
  function clampNumber(value, min, max) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return min;
    return Math.min(max, Math.max(min, numberValue));
  }
  function safeFileName(value) {
    return String(value || "invoice").replace(/[\\/:*?"<>|]+/g, "-").trim() || "invoice";
  }
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
