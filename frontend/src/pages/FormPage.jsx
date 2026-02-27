import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import { getAdminSettings, updateAdminSettings } from "../api/admin.js";
import { me as getMeProfile } from "../api/auth.js";
import { getBranchById, listBranches } from "../api/branches.js";
import {
  generateDocumentPdfWithOptions,
  generatePdfFromSavedDocument,
  getTemplateDebugGrid,
  listRecentDocuments,
} from "../api/documents.js";
import { listPartTimePharmacists } from "../api/pharmacists.js";
import { useAuth } from "../components/AuthProvider.jsx";
import "react-day-picker/style.css";

const CEO_NAME_TH = "ทรงพล ลิ้มพิสูจน์";
const TEMPLATE_OPTIONS = [
  {
    key: "form_gor_gor_1",
    label: "แบบคำร้อง กรอกอร์ 1",
  },
];

const THAI_MONTH_NAMES = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const INITIAL_TEMP_SUB_PHARMACIST = {
  pharmacistName: "",
  pharmacistId: "",
  pharmacistLicense: "",
  autoText: "",
  dateStart: null,
  dateEnd: null,
  restartArmed: false,
  timeStart: "09:00",
  timeEnd: "18:00",
};

function mapBranchProfileToFormData(profile) {
  return {
    branchCode: profile?.branch_code || profile?.branchCode || "",
    pharmacyNameTh: profile?.pharmacy_name_th || profile?.pharmacyNameTh || "",
    branchNameTh: profile?.branch_name_th || profile?.branchNameTh || "",
    soi: profile?.soi || "",
    addressNo: profile?.address_no || profile?.addressNo || "",
    district: profile?.district || "",
    province: profile?.province || "",
    postcode: profile?.postcode || "",
    phone: profile?.phone || "",
    licenseNo: profile?.license_no || profile?.licenseNo || "",
    operatorTitle:
      profile?.operator_display_name_th ||
      profile?.operatorDisplayNameTh ||
      profile?.operator_title ||
      profile?.operatorTitle ||
      "",
    operatorWorkHours: profile?.operator_work_hours || profile?.operatorWorkHours || "",
    locationText: profile?.location_text || profile?.locationText || "",
  };
}

function getBranchOptionLabel(branchOption) {
  return (
    branchOption?.pharmacy_name ||
    branchOption?.pharmacyName ||
    `${branchOption?.pharmacy_name_th || branchOption?.pharmacyNameTh || ""} ${
      branchOption?.branch_name_th || branchOption?.branchNameTh || ""
    }`.trim()
  );
}

function toIsoDate(value) {
  const pad = (num) => String(num).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function buildFallbackDocumentDate() {
  const now = new Date();
  return {
    mode: "system",
    dateISO: toIsoDate(now),
    thai: {
      day: now.getDate(),
      monthNameTh: THAI_MONTH_NAMES[now.getMonth()],
      yearBE: now.getFullYear() + 543,
    },
  };
}

async function getApiErrorMessage(error, fallbackMessage) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const raw = await data.text();
      const parsed = JSON.parse(raw);
      if (parsed?.error) {
        return parsed.error;
      }
    } catch (_parseError) {
      return fallbackMessage;
    }
  }

  return error?.response?.data?.error || error?.message || fallbackMessage;
}

function openOrDownloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const openedWindow = window.open(objectUrl, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

function isSameDate(left, right) {
  if (!left || !right) {
    return false;
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDateDisplay(dateValue) {
  if (!dateValue) {
    return "-";
  }

  return dateValue.toLocaleDateString("th-TH");
}

function isValidTimeRange(timeStart, timeEnd) {
  return Boolean(timeStart && timeEnd && timeStart < timeEnd);
}

function buildGuideErrors(value) {
  return {
    pharmacistId: !value.pharmacistId,
    dateRange: !(value.dateStart && value.dateEnd),
    timeRange: !isValidTimeRange(value.timeStart, value.timeEnd),
  };
}

function hasGuideErrors(errors) {
  return Object.values(errors).some(Boolean);
}

function toDateOrNull(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  return new Date(value);
}

function cloneSubPharmacistRecord(value) {
  if (!value) {
    return {
      ...INITIAL_TEMP_SUB_PHARMACIST,
    };
  }

  return {
    ...INITIAL_TEMP_SUB_PHARMACIST,
    ...value,
    dateStart: toDateOrNull(value.dateStart),
    dateEnd: toDateOrNull(value.dateEnd),
    restartArmed: false,
  };
}

function FieldCard({ label, children, span = "span6" }) {
  return (
    <div className={`pjkCard ${span}`}>
      <label className="pjkLabel">
        <span className="pjkLabelText">{label}</span>
        {children}
      </label>
    </div>
  );
}

function SubPharmacistModal({
  isOpen,
  activeSlot,
  tempSubPharmacist,
  ptPharmacists,
  ptPharmacistsLoading,
  ptPharmacistsError,
  guideMode,
  missingFields,
  onClose,
  onDismissGuide,
  onSelectPharmacist,
  onDateClick,
  onTimeChange,
  onFieldInteract,
  onSave,
}) {
  if (!isOpen) {
    return null;
  }

  const selectedRange = tempSubPharmacist.dateStart
    ? {
        from: tempSubPharmacist.dateStart,
        to: tempSubPharmacist.dateEnd ?? undefined,
      }
    : undefined;
  const hasRangeStart = Boolean(tempSubPharmacist.dateStart);
  const isRangeComplete = Boolean(tempSubPharmacist.dateStart && tempSubPharmacist.dateEnd);
  const isRangeCleared =
    tempSubPharmacist.restartArmed && !tempSubPharmacist.dateStart && !tempSubPharmacist.dateEnd;
  const isPharmacistInvalid = guideMode && Boolean(missingFields?.pharmacistId);
  const isDateRangeInvalid = guideMode && Boolean(missingFields?.dateRange);
  const isTimeRangeInvalid = guideMode && Boolean(missingFields?.timeRange);
  const dateRangeSummary = isRangeCleared
    ? "ล้างช่วงวันที่แล้ว คลิกอีกครั้งเพื่อเริ่มใหม่"
    : !tempSubPharmacist.dateStart
      ? "คลิกเลือกวันเริ่มต้น"
      : !tempSubPharmacist.dateEnd
        ? `เริ่ม: ${formatDateDisplay(tempSubPharmacist.dateStart)} (คลิกอีกครั้งเพื่อเลือกวันสิ้นสุด)`
        : isSameDate(tempSubPharmacist.dateStart, tempSubPharmacist.dateEnd)
          ? `${formatDateDisplay(tempSubPharmacist.dateStart)} (วันเดียว)`
          : `${formatDateDisplay(tempSubPharmacist.dateStart)} - ${formatDateDisplay(
              tempSubPharmacist.dateEnd
            )}`;

  return (
    <div
      className="modalBackdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modalPanel" role="dialog" aria-modal="true">
        <button
          type="button"
          className="modalCloseBtn"
          aria-label="Close modal"
          onClick={onClose}
        >
          ×
        </button>
        <div className="modalBody">
          <div className={`modalBodyInner ${guideMode ? "is-guide" : ""}`}>
            {guideMode ? (
              <button
                type="button"
                className="guideDim"
                onClick={onDismissGuide}
                aria-label="Close guide mode"
              />
            ) : null}
            <h4 className="modalTitle">
              ข้อมูลเภสัชกรผู้มีหน้าที่ปฏิบัติการแทน {activeSlot ? `(รายการ ${activeSlot})` : ""}
            </h4>

            <div className="modalFormGridTop">
              <div
                className={`modalFieldBox ${isPharmacistInvalid ? "is-invalid" : ""}`}
                data-guide-field="pharmacistId"
                onClick={() => onFieldInteract("pharmacistId")}
              >
                <label className="modalFieldLabel" htmlFor="modal-pharmacist-select">
                  ชื่อเภสัชกร
                </label>
                <select
                  id="modal-pharmacist-select"
                  className="modalFieldInput"
                  value={tempSubPharmacist.pharmacistId}
                  disabled={ptPharmacistsLoading}
                  onChange={(event) => onSelectPharmacist(event.target.value)}
                >
                  <option value="">
                    {ptPharmacistsLoading ? "กำลังโหลดรายชื่อเภสัชกร..." : "เลือกเภสัชกร"}
                  </option>
                  {ptPharmacists.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.display_name}
                    </option>
                  ))}
                </select>
                {ptPharmacistsError ? (
                  <p className="fieldHelp">โหลดรายชื่อเภสัชกรไม่สำเร็จ</p>
                ) : null}
                {!ptPharmacistsError && isPharmacistInvalid ? (
                  <p className="fieldHelp">กรุณาเลือกเภสัชกร</p>
                ) : null}
              </div>

              <div className="modalFieldBox">
                <label className="modalFieldLabel" htmlFor="modal-license-display">
                  เลขที่ใบอนุญาตประกอบวิชาชีพ
                </label>
                <input
                  id="modal-license-display"
                  className="modalFieldInput"
                  value={tempSubPharmacist.pharmacistLicense}
                  readOnly
                />
              </div>
            </div>

            <div className="modalFormGridBottom">
              <div
                className={`modalFieldBox modalFieldBox--calendar ${
                  isDateRangeInvalid ? "is-invalid" : ""
                }`}
                data-guide-field="dateRange"
                onClick={() => onFieldInteract("dateRange")}
              >
                <label className="modalFieldLabel">ช่วงวันที่ปฏิบัติงานแทน</label>
                <div
                  className={`modalCalendar ${hasRangeStart ? "has-start" : ""} ${
                    isRangeComplete ? "is-complete" : ""
                  } ${isRangeCleared ? "is-cleared" : ""}`.trim()}
                >
                  <DayPicker
                    key={`range-${tempSubPharmacist.dateStart ? "has-start" : "empty"}-${
                      tempSubPharmacist.dateEnd ? "has-end" : "no-end"
                    }-${tempSubPharmacist.restartArmed ? "armed" : "normal"}`}
                    mode="range"
                    selected={selectedRange}
                    onDayClick={onDateClick}
                    weekStartsOn={0}
                  />
                  <p className="modalRangeSummary">{dateRangeSummary}</p>
                </div>
                {isDateRangeInvalid ? (
                  <p className="fieldHelp">กรุณาเลือกช่วงวันที่ให้ครบ (เริ่ม-สิ้นสุด)</p>
                ) : null}
              </div>

              <div
                className={`modalFieldBox modalFieldBox--time ${
                  isTimeRangeInvalid ? "is-invalid" : ""
                }`}
                data-guide-field="timeRange"
                onClick={() => onFieldInteract("timeRange")}
              >
                <label className="modalFieldLabel">ช่วงเวลา</label>
                <div className="modalTimeGrid">
                  <label className="modalTimeLabel" htmlFor="modal-time-start">
                    เริ่ม
                    <input
                      id="modal-time-start"
                      type="time"
                      className="modalFieldInput"
                      value={tempSubPharmacist.timeStart}
                      onChange={(event) => onTimeChange("timeStart", event.target.value)}
                    />
                  </label>
                  <label className="modalTimeLabel" htmlFor="modal-time-end">
                    สิ้นสุด
                    <input
                      id="modal-time-end"
                      type="time"
                      className="modalFieldInput"
                      value={tempSubPharmacist.timeEnd}
                      onChange={(event) => onTimeChange("timeEnd", event.target.value)}
                    />
                  </label>
                </div>
                <p className="modalRangeSummary modalTimeSummary">
                  {tempSubPharmacist.timeStart} - {tempSubPharmacist.timeEnd}
                </p>
                {isTimeRangeInvalid ? (
                  <p className="fieldHelp">
                    กรุณาเลือกเวลาให้ถูกต้อง (เริ่มต้องน้อยกว่าสิ้นสุด)
                  </p>
                ) : null}
              </div>
            </div>

            <div className="modalActions">
              <button type="button" className="modalCancelBtn" onClick={onClose}>
                ยกเลิก
              </button>
              <button type="button" className="modalSaveBtn" onClick={onSave}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PdfPreviewModal({
  isOpen,
  fileName,
  pdfUrl,
  iframeRef,
  onClose,
  onDownload,
  onPrint,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modalBackdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modalPanel modalPanel--pdfPreview" role="dialog" aria-modal="true">
        <button type="button" className="modalCloseBtn" aria-label="Close preview" onClick={onClose}>
          ×
        </button>

        <div className="modalBody pdfPreviewBody">
          <div className="pdfPreviewToolbar">
            <div className="pdfPreviewTitleWrap">
              <h4 className="modalTitle">PDF Preview</h4>
              <p className="pdfPreviewFileName">{fileName}</p>
            </div>

            <div className="pdfPreviewActions">
              <button
                type="button"
                className="pdfPreviewActionBtn"
                onClick={onPrint}
                aria-label="Print PDF"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M17 8V3H7v5H5a3 3 0 00-3 3v4h4v6h12v-6h4v-4a3 3 0 00-3-3h-2zm-8-3h6v3H9V5zm7 14H8v-5h8v5zm4-6h-2v-1h-2v1H8v-1H6v1H4v-2a1 1 0 011-1h14a1 1 0 011 1v2z"
                    fill="currentColor"
                  />
                </svg>
                <span>Print</span>
              </button>

              <button
                type="button"
                className="pdfPreviewActionBtn"
                onClick={onDownload}
                aria-label="Download PDF"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 3a1 1 0 011 1v8.59l2.3-2.29a1 1 0 111.4 1.41l-4 3.99a1 1 0 01-1.4 0l-4-3.99a1 1 0 111.4-1.41l2.3 2.29V4a1 1 0 011-1zm-7 14a1 1 0 011 1v1h12v-1a1 1 0 112 0v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2a1 1 0 011-1z"
                    fill="currentColor"
                  />
                </svg>
                <span>Download</span>
              </button>
            </div>
          </div>

          <div className="pdfPreviewFrameShell">
            {pdfUrl ? (
              <iframe ref={iframeRef} title="Generated PDF Preview" src={pdfUrl} className="pdfPreviewFrame" />
            ) : (
              <p className="muted-text">Preparing preview...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormPage() {
  const navigate = useNavigate();
  const { user, documentDate, updateDocumentDate, clearSession } = useAuth();

  const [formData, setFormData] = useState({
    branchCode: "",
    pharmacyNameTh: "",
    branchNameTh: "",
    soi: "",
    addressNo: "",
    district: "",
    province: "",
    postcode: "",
    phone: "",
    licenseNo: "",
    operatorTitle: "",
    operatorWorkHours: "",
    locationText: "",
  });
  const [role, setRole] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [branchProfile, setBranchProfile] = useState({});
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchError, setBranchError] = useState("");
  const [isBranchProfileEditing, setIsBranchProfileEditing] = useState(false);
  const isAdmin = role === "admin";

  const [settingsState, setSettingsState] = useState({
    useSystemDate: true,
    forcedDate: toIsoDate(new Date()),
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [isDateEditing, setIsDateEditing] = useState(false);

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [gridGenerating, setGridGenerating] = useState(false);
  const [isPdfPreviewModalOpen, setIsPdfPreviewModalOpen] = useState(false);
  const [previewPdfBlob, setPreviewPdfBlob] = useState(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [previewPdfFileName, setPreviewPdfFileName] = useState("document.pdf");
  const previewIframeRef = useRef(null);
  const [isSubPharmacistModalOpen, setIsSubPharmacistModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null);
  const [tempSubPharmacist, setTempSubPharmacist] = useState({
    ...INITIAL_TEMP_SUB_PHARMACIST,
  });
  const [subPharmacistSlots, setSubPharmacistSlots] = useState([null, null, null]);
  const [guideMode, setGuideMode] = useState(false);
  const [missingFields, setMissingFields] = useState({});
  const [saveGeneratedCopy, setSaveGeneratedCopy] = useState(true);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(TEMPLATE_OPTIONS[0].key);

  const [recentDocuments, setRecentDocuments] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState("");
  const [openingDocId, setOpeningDocId] = useState(null);
  const [recentDateFilter, setRecentDateFilter] = useState("");
  const [ptPharmacists, setPtPharmacists] = useState([]);
  const [ptPharmacistsLoading, setPtPharmacistsLoading] = useState(false);
  const [ptPharmacistsError, setPtPharmacistsError] = useState("");
  const pharmacistAttachmentCount = useMemo(() => {
    const uniquePharmacists = new Set();

    subPharmacistSlots.forEach((slot) => {
      if (!slot) {
        return;
      }

      const normalizedName = (slot.pharmacistName || "").trim().toLowerCase();
      const normalizedLicense = (slot.pharmacistLicense || "").trim().toLowerCase();
      const fallbackId = (slot.pharmacistId || "").trim().toLowerCase();

      const dedupeKey =
        normalizedName && normalizedLicense
          ? `${normalizedName}|${normalizedLicense}`
          : fallbackId || `${normalizedName}|${normalizedLicense}`;

      if (!dedupeKey) {
        return;
      }

      uniquePharmacists.add(dedupeKey);
    });

    return uniquePharmacists.size;
  }, [subPharmacistSlots]);

  const filteredRecentDocuments = useMemo(() => {
    if (!recentDateFilter) {
      return recentDocuments;
    }

    return recentDocuments.filter((doc) =>
      String(doc.documentDateISO || "").startsWith(recentDateFilter)
    );
  }, [recentDateFilter, recentDocuments]);

  const openPdfPreview = useCallback((blob, fileName) => {
    setPreviewPdfBlob(blob);
    setPreviewPdfFileName(fileName || "document.pdf");
    setIsPdfPreviewModalOpen(true);
  }, []);

  const closeSubPharmacistModal = useCallback(() => {
    setIsSubPharmacistModalOpen(false);
    setActiveSlot(null);
    setGuideMode(false);
    setMissingFields({});
  }, []);

  const closePdfPreviewModal = useCallback(() => {
    setIsPdfPreviewModalOpen(false);
    setPreviewPdfBlob(null);
    setPreviewPdfFileName("document.pdf");
  }, []);

  useEffect(() => {
    if (!previewPdfBlob) {
      setPreviewPdfUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(previewPdfBlob);
    setPreviewPdfUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [previewPdfBlob]);

  useEffect(() => {
    let active = true;

    const bootstrapBranchContext = async () => {
      setBranchError("");

      try {
        const profile = await getMeProfile();
        if (!active) {
          return;
        }

        const resolvedRole = profile?.role || profile?.user?.role || null;
        const assignedBranchId =
          profile?.branch_id || profile?.user?.branchId || profile?.branch?.id || null;

        setRole(resolvedRole);

        if (resolvedRole === "admin") {
          const branchListResult = await listBranches();
          if (!active) {
            return;
          }

          const availableBranches = branchListResult?.branches || [];
          setBranches(availableBranches);

          const initialBranchId =
            assignedBranchId && availableBranches.some((item) => item.id === assignedBranchId)
              ? assignedBranchId
              : availableBranches[0]?.id || null;

          setSelectedBranchId(initialBranchId);
          return;
        }

        if (!assignedBranchId) {
          setBranches([]);
          setSelectedBranchId(null);
          setBranchProfile({});
          setFormData((current) => ({
            ...current,
            ...mapBranchProfileToFormData(null),
          }));
          setBranchError("Your account is not assigned to a branch.");
          return;
        }

        setBranches(
          profile?.branch
            ? [
                {
                  id: profile.branch.id,
                  pharmacy_name: `${profile.branch.pharmacyNameTh || ""} ${
                    profile.branch.branchNameTh || ""
                  }`.trim(),
                },
              ]
            : []
        );
        setSelectedBranchId(assignedBranchId);
      } catch (error) {
        if (!active) {
          return;
        }

        setBranchError(
          error?.response?.data?.error || error?.message || "Unable to load branch context."
        );
      }
    };

    bootstrapBranchContext();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedBranchId) {
      setBranchProfile({});
      return;
    }

    let active = true;
    setBranchLoading(true);
    setBranchError("");

    getBranchById(selectedBranchId)
      .then((result) => {
        if (!active) {
          return;
        }

        const nextBranchProfile = result?.branch || {};
        setBranchProfile(nextBranchProfile);
        setFormData((current) => ({
          ...current,
          ...mapBranchProfileToFormData(nextBranchProfile),
        }));
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setBranchError(
          error?.response?.data?.error || error?.message || "Unable to load selected branch."
        );
      })
      .finally(() => {
        if (active) {
          setBranchLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedBranchId]);

  useEffect(() => {
    setIsBranchProfileEditing(false);
  }, [selectedBranchId]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let active = true;
    setSettingsLoading(true);
    setSettingsError("");

    getAdminSettings()
      .then((result) => {
        if (!active) {
          return;
        }

        setSettingsState({
          useSystemDate: result.settings.useSystemDate,
          forcedDate: result.settings.forcedDate || toIsoDate(new Date()),
        });

        if (result.documentDate) {
          updateDocumentDate(result.documentDate);
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setSettingsError(
          error?.response?.data?.error ||
            error?.message ||
            "Unable to load admin settings."
        );
      })
      .finally(() => {
        if (active) {
          setSettingsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isAdmin, updateDocumentDate]);

  const loadRecentDocuments = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    setRecentLoading(true);
    setRecentError("");

    try {
      const result = await listRecentDocuments(10);
      setRecentDocuments(result.documents || []);
    } catch (error) {
      setRecentError(
        error?.response?.data?.error ||
          error?.message ||
          "Unable to load recent documents."
      );
    } finally {
      setRecentLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    let active = true;
    setPtPharmacistsLoading(true);
    setPtPharmacistsError("");

    listPartTimePharmacists()
      .then((result) => {
        if (!active) {
          return;
        }

        const rows = Array.isArray(result?.pharmacists) ? result.pharmacists : [];
        setPtPharmacists(rows);
      })
      .catch((_error) => {
        if (!active) {
          return;
        }

        setPtPharmacists([]);
        setPtPharmacistsError("โหลดรายชื่อเภสัชกรไม่สำเร็จ");
      })
      .finally(() => {
        if (active) {
          setPtPharmacistsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadRecentDocuments();
  }, [loadRecentDocuments]);

  useEffect(() => {
    const isAnyModalOpen = isSubPharmacistModalOpen || isPdfPreviewModalOpen;
    if (!isAnyModalOpen) {
      document.body.classList.remove("modal-open");
      return;
    }

    document.body.classList.add("modal-open");
    const onKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (isPdfPreviewModalOpen) {
        closePdfPreviewModal();
        return;
      }

      if (isSubPharmacistModalOpen) {
        closeSubPharmacistModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [
    closePdfPreviewModal,
    closeSubPharmacistModal,
    isPdfPreviewModalOpen,
    isSubPharmacistModalOpen,
  ]);

  useEffect(() => {
    if (!guideMode) {
      return;
    }

    const currentInputErrors = buildGuideErrors(tempSubPharmacist);
    const hasHighlightedFields = hasGuideErrors(missingFields);
    if (!hasGuideErrors(currentInputErrors) || !hasHighlightedFields) {
      setGuideMode(false);
      setMissingFields({});
    }
  }, [guideMode, missingFields, tempSubPharmacist]);

  const currentDocumentDate = useMemo(() => {
    return documentDate || buildFallbackDocumentDate();
  }, [documentDate]);

  const handleChange = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleBranchSelectionChange = (event) => {
    if (role !== "admin") {
      return;
    }

    const nextBranchId = event.target.value;
    setSelectedBranchId(nextBranchId || null);
  };

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const handleSaveDateSettings = async () => {
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsSaving(true);

    try {
      const payload = {
        useSystemDate: settingsState.useSystemDate,
        forcedDate: settingsState.useSystemDate ? null : settingsState.forcedDate,
      };

      const result = await updateAdminSettings(payload);
      setSettingsState({
        useSystemDate: result.settings.useSystemDate,
        forcedDate: result.settings.forcedDate || toIsoDate(new Date()),
      });
      updateDocumentDate(result.documentDate || null);
      setSettingsSuccess("Date settings updated.");
      setIsDateEditing(false);
    } catch (error) {
      setSettingsError(
        error?.response?.data?.error ||
          error?.message ||
          "Unable to update admin settings."
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDownloadPreviewPdf = useCallback(() => {
    if (!previewPdfBlob) {
      return;
    }

    downloadBlob(previewPdfBlob, previewPdfFileName || "document.pdf");
  }, [previewPdfBlob, previewPdfFileName]);

  const handlePrintPreviewPdf = useCallback(() => {
    if (!previewPdfUrl) {
      return;
    }

    try {
      const frameWindow = previewIframeRef.current?.contentWindow;
      if (frameWindow) {
        frameWindow.focus();
        frameWindow.print();
        return;
      }
    } catch (_error) {
      // Some browser PDF viewers block direct print calls; fallback below.
    }

    const popup = window.open(previewPdfUrl, "_blank", "noopener,noreferrer");
    popup?.focus();
  }, [previewPdfUrl]);

  const handleGeneratePdf = async () => {
    setPdfGenerating(true);
    setPdfError("");
    setPdfStatus("");

    if (!selectedBranchId) {
      setPdfGenerating(false);
      setPdfError("Please select a branch before generating PDF.");
      return;
    }

    try {
      const { blob, fileName, documentId } = await generateDocumentPdfWithOptions(
        {
          templateKey: selectedTemplateKey,
          branchId: selectedBranchId,
          formData,
          subPharmacistSlots,
        },
        {
          save: isAdmin ? saveGeneratedCopy : false,
        }
      );

      openPdfPreview(blob, fileName);

      if (documentId) {
        setPdfStatus(`PDF generated, preview ready, and saved. ID: ${documentId}`);
        await loadRecentDocuments();
      } else {
        setPdfStatus("PDF generated and preview is ready.");
      }
    } catch (error) {
      const message = await getApiErrorMessage(
        error,
        "Unable to generate PDF. Please try again."
      );
      setPdfError(message);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleOpenDebugGrid = async () => {
    setGridGenerating(true);
    setPdfError("");

    try {
      const { blob, fileName } = await getTemplateDebugGrid(selectedTemplateKey);
      openOrDownloadBlob(blob, fileName);
    } catch (error) {
      const message = await getApiErrorMessage(
        error,
        "Unable to open template debug grid."
      );
      setPdfError(message);
    } finally {
      setGridGenerating(false);
    }
  };

  const handleOpenSavedDocument = async (documentId) => {
    setOpeningDocId(documentId);
    setPdfError("");

    try {
      const { blob, fileName } = await generatePdfFromSavedDocument(documentId);
      openPdfPreview(blob, fileName);
    } catch (error) {
      const message = await getApiErrorMessage(
        error,
        "Unable to open saved document."
      );
      setPdfError(message);
    } finally {
      setOpeningDocId(null);
    }
  };

  const clearMissingField = useCallback((fieldName) => {
    setMissingFields((current) => {
      if (!current?.[fieldName]) {
        return current;
      }

      return {
        ...current,
        [fieldName]: false,
      };
    });
  }, []);

  const handleDismissGuideMode = () => {
    setGuideMode(false);
  };

  const handleGuideFieldInteract = (fieldName) => {
    if (!guideMode) {
      return;
    }

    clearMissingField(fieldName);
  };

  const openModal = (slot) => {
    const slotIndex = slot - 1;
    const savedData = subPharmacistSlots[slotIndex];
    setActiveSlot(slot);
    setTempSubPharmacist(cloneSubPharmacistRecord(savedData));
    setGuideMode(false);
    setMissingFields({});
    setIsSubPharmacistModalOpen(true);
  };

  const closeModal = () => {
    closeSubPharmacistModal();
  };

  const handleEditSlot = (slot) => {
    openModal(slot);
  };

  const handleDeleteSlot = (slot) => {
    const isConfirmed = window.confirm("ยืนยันลบข้อมูลรายการนี้ใช่หรือไม่?");
    if (!isConfirmed) {
      return;
    }

    setSubPharmacistSlots((current) => {
      const next = [...current];
      next[slot - 1] = null;
      return next;
    });
  };

  const handlePharmacistSelectChange = (selectedId) => {
    const selected = ptPharmacists.find((option) => option.id === selectedId);
    const selectedName = selected?.display_name || "";
    const selectedLicense = selected?.license_number || "";

    setTempSubPharmacist((current) => ({
      ...current,
      pharmacistId: selectedId,
      pharmacistName: selectedName,
      pharmacistLicense: selectedLicense,
      autoText: selected ? `${selectedName} (${selectedLicense})` : "",
    }));

    if (selectedId) {
      clearMissingField("pharmacistId");
    }
  };

  const handleDateClick = (selectedDay) => {
    let isCompleteAfterClick = false;

    setTempSubPharmacist((current) => {
      const { dateStart, dateEnd, restartArmed } = current;
      let nextState;

      if (restartArmed) {
        nextState = {
          ...current,
          dateStart: selectedDay,
          dateEnd: null,
          restartArmed: false,
        };
        isCompleteAfterClick = Boolean(nextState.dateStart && nextState.dateEnd);
        return nextState;
      }

      if (!dateStart || (dateStart && dateEnd)) {
        if (dateStart && dateEnd) {
          nextState = {
            ...current,
            dateStart: null,
            dateEnd: null,
            restartArmed: true,
          };
          isCompleteAfterClick = Boolean(nextState.dateStart && nextState.dateEnd);
          return nextState;
        }

        nextState = {
          ...current,
          dateStart: selectedDay,
          dateEnd: null,
          restartArmed: false,
        };
        isCompleteAfterClick = Boolean(nextState.dateStart && nextState.dateEnd);
        return nextState;
      }

      if (isSameDate(dateStart, selectedDay)) {
        nextState = {
          ...current,
          dateEnd: selectedDay,
          restartArmed: false,
        };
        isCompleteAfterClick = Boolean(nextState.dateStart && nextState.dateEnd);
        return nextState;
      }

      if (selectedDay < dateStart) {
        nextState = {
          ...current,
          dateStart: selectedDay,
          dateEnd: dateStart,
          restartArmed: false,
        };
        isCompleteAfterClick = Boolean(nextState.dateStart && nextState.dateEnd);
        return nextState;
      }

      nextState = {
        ...current,
        dateEnd: selectedDay,
        restartArmed: false,
      };
      isCompleteAfterClick = Boolean(nextState.dateStart && nextState.dateEnd);
      return nextState;
    });

    if (isCompleteAfterClick) {
      clearMissingField("dateRange");
    }
  };

  const handleTimeChange = (field, value) => {
    let isTimeValidAfterChange = false;

    setTempSubPharmacist((current) => {
      const nextState = {
        ...current,
        [field]: value,
      };

      isTimeValidAfterChange = isValidTimeRange(nextState.timeStart, nextState.timeEnd);
      return nextState;
    });

    if (isTimeValidAfterChange) {
      clearMissingField("timeRange");
    }
  };

  const handleSaveSubPharmacist = () => {
    const errors = buildGuideErrors(tempSubPharmacist);
    if (hasGuideErrors(errors)) {
      setMissingFields(errors);
      setGuideMode(true);

      const firstInvalidField = ["pharmacistId", "dateRange", "timeRange"].find(
        (fieldName) => errors[fieldName]
      );
      if (firstInvalidField) {
        window.requestAnimationFrame(() => {
          const invalidFieldNode = document.querySelector(
            `[data-guide-field="${firstInvalidField}"]`
          );
          invalidFieldNode?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        });
      }
      return;
    }

    if (!activeSlot) {
      return;
    }

    const slotIndex = activeSlot - 1;
    const savedRecord = cloneSubPharmacistRecord(tempSubPharmacist);
    setSubPharmacistSlots((current) => {
      const next = [...current];
      next[slotIndex] = savedRecord;
      return next;
    });

    setGuideMode(false);
    setMissingFields({});
    console.log("tempSubPharmacist", {
      slot: activeSlot,
      ...tempSubPharmacist,
    });
    closeModal();
  };

  return (
    <main className="app-shell form-shell">
      <div className="header-row">
        <h3>แบบแจ้งการเข้าปฏิบัติหน้าที่แทนผู้มีหน้าที่ปฏิบัติการในสถานที่ขายยาแผนปัจจุบัน</h3>
        <div className="header-actions">
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      <p className="muted-text">
        Signed in as <strong>{user?.username}</strong> ({user?.role})
      </p>

      {pdfError ? <p className="error-text">{pdfError}</p> : null}
      {pdfStatus ? <p className="success-text">{pdfStatus}</p> : null}

      <section
        className={`section-card stack-form date-section ${
          isDateEditing ? "is-editing" : "is-locked"
        }`}
      >
        <h2>วันที่เขียนเอกสาร</h2>

        {isAdmin ? (
          <div className="stack-form">
            <label className="inline-label">
              <input
                type="radio"
                name="dateMode"
                checked={settingsState.useSystemDate}
                onChange={() => {
                  setSettingsState((current) => ({ ...current, useSystemDate: true }));
                  setIsDateEditing(false);
                }}
              />
              ใช้วันที่จากระบบ
            </label>

            <label className="inline-label">
              <input
                type="radio"
                name="dateMode"
                checked={!settingsState.useSystemDate}
                onChange={() => {
                  setSettingsState((current) => ({ ...current, useSystemDate: false }));
                  setIsDateEditing(true);
                }}
              />
              ใช้วันที่กำหนดเอง
            </label>

            <label>
              วันที่กำหนดเอง
              <input
                type="date"
                value={settingsState.forcedDate}
                onChange={(event) =>
                  setSettingsState((current) => ({
                    ...current,
                    forcedDate: event.target.value,
                  }))
                }
                disabled={settingsState.useSystemDate}
              />
            </label>

            <button
              type="button"
              onClick={handleSaveDateSettings}
              disabled={settingsLoading || settingsSaving}
            >
              {settingsSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่าวันที่"}
            </button>

            {settingsError ? <p className="error-text">{settingsError}</p> : null}
            {settingsSuccess ? <p className="success-text">{settingsSuccess}</p> : null}
          </div>
        ) : (
          <p className="muted-text">Role user: date fields are read-only.</p>
        )}

        <div className="grid-3">
          <label>
            วันที่
            <input value={String(currentDocumentDate.thai.day)} readOnly />
          </label>

          <label>
            เดือน
            <input value={currentDocumentDate.thai.monthNameTh} readOnly />
          </label>

          <label>
            พ.ศ.
            <input value={String(currentDocumentDate.thai.yearBE)} readOnly />
          </label>
        </div>

        <label>
          โหมดวันที่ที่ใช้
          <input value={currentDocumentDate.mode} readOnly />
        </label>
      </section>

      <section
        className={`section-card stack-form branch-profile ${
          isBranchProfileEditing ? "is-editing" : "is-locked"
        }`}
      >
        <div className="branchProfileHeader">
          <h2>ข้อมูลสาขา</h2>
          <button
            type="button"
            className="branchProfileEditBtn"
            onClick={() => setIsBranchProfileEditing((current) => !current)}
            aria-pressed={isBranchProfileEditing}
            aria-label={
              isBranchProfileEditing ? "ล็อกข้อมูลข้อมูลสาขา" : "เปิดโหมดแก้ไขข้อมูลสาขา"
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 20h4l10-10-4-4L4 16v4zm2-2v-1.17l8.06-8.06 1.17 1.17L7.17 18H6zM17.66 3.34l3 3a1 1 0 010 1.41l-1.25 1.25-4.41-4.41 1.25-1.25a1 1 0 011.41 0z"
                fill="currentColor"
              />
            </svg>
            <span>{isBranchProfileEditing ? "ล็อกข้อมูล" : "แก้ไขข้อมูล"}</span>
          </button>
        </div>
        <div className="pjkGrid">
          <div className="pjkCard span12">
            <label className="pjkLabel">
              <span className="pjkLabelText">เลือกสาขา</span>
              <select
                className="pjkInput"
                value={selectedBranchId || ""}
                onChange={handleBranchSelectionChange}
                disabled={role !== "admin" || branchLoading}
              >
                {branches.length === 0 ? (
                  <option value="">ไม่มีสาขา</option>
                ) : null}
                {branches.map((option) => (
                  <option key={option.id} value={option.id}>
                    {getBranchOptionLabel(option)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {branchError ? (
            <div className="span12">
              <p className="error-text">{branchError}</p>
            </div>
          ) : null}

          {branchLoading ? (
            <div className="span12">
              <p className="muted-text">กำลังโหลดข้อมูลสาขาที่เลือก...</p>
            </div>
          ) : null}

          <FieldCard label="ข้าพเจ้า" span="span12">
            <input className="pjkInput" value={CEO_NAME_TH} readOnly />
          </FieldCard>

          <FieldCard label="ใบอนุญาตเลขที่" span="span4">
            <input
              className="pjkInput"
              value={formData.licenseNo}
              readOnly={!isBranchProfileEditing}
              onChange={handleChange("licenseNo")}
            />
          </FieldCard>

          <FieldCard label="ชื่อสถานที่ขายยา" span="span4">
            <input
              className="pjkInput"
              value={`${formData.pharmacyNameTh} ${formData.branchNameTh}`.trim()}
              readOnly
            />
          </FieldCard>

          <FieldCard label="ตั้งอยู่เลขที่" span="span4">
            <input
              className="pjkInput"
              value={formData.addressNo}
              readOnly={!isBranchProfileEditing}
              onChange={handleChange("addressNo")}
            />
          </FieldCard>

          <FieldCard label="ตรอก/ซอย" span="span4">
            <input
              className="pjkInput"
              value={formData.soi}
              readOnly={!isBranchProfileEditing}
              onChange={handleChange("soi")}
            />
          </FieldCard>

          <FieldCard label="อำเภอ/เขต" span="span4">
            <input
              className="pjkInput"
              value={formData.district}
              readOnly={!isBranchProfileEditing}
              onChange={handleChange("district")}
            />
          </FieldCard>

          <FieldCard label="จังหวัด" span="span4">
            <input
              className="pjkInput"
              value={formData.province}
              readOnly={!isBranchProfileEditing}
              onChange={handleChange("province")}
            />
          </FieldCard>

          <FieldCard label="รหัสไปรษณีย์" span="span4">
            <input
              className="pjkInput"
              value={formData.postcode}
              readOnly={!isBranchProfileEditing}
              onChange={handleChange("postcode")}
            />
          </FieldCard>

          <FieldCard label="โทรศัพท์" span="span4">
            <input
              className="pjkInput"
              value={formData.phone}
              readOnly={!isBranchProfileEditing}
              onChange={handleChange("phone")}
            />
          </FieldCard>

          <FieldCard label="มี นาย/นาง/นางสาว" span="span4">
            <input
              className="pjkInput"
              value={formData.operatorTitle}
              readOnly={!isBranchProfileEditing}
              onChange={handleChange("operatorTitle")}
            />
          </FieldCard>

          <FieldCard label="เป็นผู้มีหน้าที่ปฏิบัติการ เวลาปฏิบัติการ" span="span12">
            <input
              className="pjkInput"
              value={formData.operatorWorkHours}
              readOnly={!isBranchProfileEditing}
              onChange={handleChange("operatorWorkHours")}
            />
          </FieldCard>
        </div>
      </section>

      <section className="stack-form section-card">
        <h3 className="subPharmacistHeading">
          ขอแจ้งชื่อ เภสัชกรผู้มีหน้าที่ปฏิบัติการแทนผู้มีหน้าที่ปฏิบัติการ ซึ่งไม่อาจปฏิบัติหน้าที่เป็นการชั่วคราว
          (ไม่เกินหกสิบวัน) ดังต่อไปนี้........
        </h3>
        <div className="addRowBtnList">
          {[1, 2, 3].map((item) => {
            const slotData = subPharmacistSlots[item - 1];
            if (!slotData) {
              return (
                <button
                  key={item}
                  type="button"
                  className="addRowBtn"
                  onClick={() => openModal(item)}
                >
                  <span className="addRowBtnIcon" aria-hidden="true">
                    +
                  </span>
                  <span className="addRowBtnText">คลิ๊กที่นี่เพื่อเพิ่มข้อมูล</span>
                </button>
              );
            }

            return (
              <article key={item} className="subPharmacistSavedCard">
                <div className="savedTextLine">
                  <span className="savedIndex">{item})</span>
                  <span className="savedTextLabel">ชื่อ</span>
                  <span className="savedTextFill savedTextFill--name">
                    {slotData.pharmacistName || "-"}
                  </span>
                  <span className="savedTextLabel">
                    ใบอนุญาตประกอบวิชาชีพเภสัชกรรมเลขที่
                  </span>
                  <span className="savedTextFill savedTextFill--license">
                    {slotData.pharmacistLicense || "-"}
                  </span>
                </div>

                <div className="savedTextLine">
                  <span className="savedTextLabel">ระหว่างวันที่</span>
                  <span className="savedTextFill savedTextFill--date">
                    {formatDateDisplay(slotData.dateStart)}
                  </span>
                  <span className="savedTextLabel">ถึงวันที่</span>
                  <span className="savedTextFill savedTextFill--date">
                    {formatDateDisplay(slotData.dateEnd)}
                  </span>
                  <span className="savedTextLabel">เวลาปฏิบัติการ</span>
                  <span className="savedTextFill savedTextFill--time">
                    {slotData.timeStart} - {slotData.timeEnd}
                  </span>
                </div>

                <div className="savedSlotActions">
                  <button
                    type="button"
                    className="slotActionBtn slotActionBtn--edit"
                    onClick={() => handleEditSlot(item)}
                    aria-label={`แก้ไขรายการ ${item}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 20h4l10-10-4-4L4 16v4zm2-2v-1.17l8.06-8.06 1.17 1.17L7.17 18H6zM17.66 3.34l3 3a1 1 0 010 1.41l-1.25 1.25-4.41-4.41 1.25-1.25a1 1 0 011.41 0z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="slotActionBtn slotActionBtn--delete"
                    onClick={() => handleDeleteSlot(item)}
                    aria-label={`ลบรายการ ${item}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 7h12l-1 13a2 2 0 01-2 2H9a2 2 0 01-2-2L6 7z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="supportDocsBlock">
          <p className="supportDocsIntro">พร้อมกันนี้ ข้าพเจ้าได้แนบหลักฐาน ดังต่อไปนี้</p>
          <p className="supportDocsLine">
            <span className="supportDocsIndex">๑.</span>
            <span>สำเนาใบประกอบวิชาชีพเภสัชกรรม จำนวน</span>
            <span className="supportDocsFill">{pharmacistAttachmentCount}</span>
            <span>ใบ</span>
          </p>
          <p className="supportDocsLine">
            <span className="supportDocsIndex">๒.</span>
            <span>อื่น ๆ</span>
          </p>
        </div>
      </section>

      <section className="stack-form section-card generate-section">
        <button
          type="button"
          className="generatePdfBtn"
          onClick={handleGeneratePdf}
          disabled={pdfGenerating}
        >
          {pdfGenerating ? "Generating..." : "Generate PDF"}
        </button>
      </section>

      <SubPharmacistModal
        isOpen={isSubPharmacistModalOpen}
        activeSlot={activeSlot}
        tempSubPharmacist={tempSubPharmacist}
        ptPharmacists={ptPharmacists}
        ptPharmacistsLoading={ptPharmacistsLoading}
        ptPharmacistsError={ptPharmacistsError}
        guideMode={guideMode}
        missingFields={missingFields}
        onClose={closeModal}
        onDismissGuide={handleDismissGuideMode}
        onSelectPharmacist={handlePharmacistSelectChange}
        onDateClick={handleDateClick}
        onTimeChange={handleTimeChange}
        onFieldInteract={handleGuideFieldInteract}
        onSave={handleSaveSubPharmacist}
      />

      <PdfPreviewModal
        isOpen={isPdfPreviewModalOpen}
        fileName={previewPdfFileName}
        pdfUrl={previewPdfUrl}
        iframeRef={previewIframeRef}
        onClose={closePdfPreviewModal}
        onDownload={handleDownloadPreviewPdf}
        onPrint={handlePrintPreviewPdf}
      />

      {isAdmin ? (
        <section className="section-card stack-form">
          <div className="recentHeader">
            <h2>ประวัติเอกสารล่าสุด</h2>
            <label className="recentDateFilter" htmlFor="recent-date-filter">
              กรองตามวันที่
              <input
                id="recent-date-filter"
                type="date"
                value={recentDateFilter}
                onChange={(event) => setRecentDateFilter(event.target.value)}
              />
            </label>
          </div>
          {recentLoading ? <p className="muted-text">Loading...</p> : null}
          {recentError ? <p className="error-text">{recentError}</p> : null}
          {!recentLoading && filteredRecentDocuments.length === 0 ? (
            <p className="muted-text">
              {recentDateFilter ? "No documents for selected date." : "No documents yet."}
            </p>
          ) : null}

          {filteredRecentDocuments.length > 0 ? (
            <div className="recentList">
              {filteredRecentDocuments.map((doc) => (
                <div key={doc.id} className="recent-item">
                  <div>
                    <p className="recent-id">{doc.id}</p>
                    <p className="recent-meta">
                      สาขา {doc.branchCode} | โดย {doc.createdByUsername} | วันที่{" "}
                      {doc.documentDateISO || "-"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenSavedDocument(doc.id)}
                    disabled={openingDocId === doc.id}
                  >
                    {openingDocId === doc.id ? "กำลังเตรียม..." : "ดูตัวอย่าง PDF"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export default FormPage;
