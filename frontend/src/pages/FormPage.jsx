import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminSettings, updateAdminSettings } from "../api/admin.js";
import {
  generateDocumentPdfWithOptions,
  generatePdfFromSavedDocument,
  getTemplateDebugGrid,
  listRecentDocuments,
} from "../api/documents.js";
import { useAuth } from "../components/AuthProvider.jsx";

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

function PjkField({ id, label, hint = "", span = 12, children }) {
  return (
    <div className={`pjkFieldCard pjkSpan${span}`}>
      <label className="pjkLabel" htmlFor={id}>
        {label}
      </label>
      {hint ? <p className="pjkHint">{hint}</p> : null}
      <div>{children}</div>
    </div>
  );
}

function FormPage() {
  const navigate = useNavigate();
  const { user, branch, documentDate, updateDocumentDate, clearSession } = useAuth();
  const isAdmin = user?.role === "admin";

  const [formData, setFormData] = useState({
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

  const [settingsState, setSettingsState] = useState({
    useSystemDate: true,
    forcedDate: toIsoDate(new Date()),
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [gridGenerating, setGridGenerating] = useState(false);
  const [saveGeneratedCopy, setSaveGeneratedCopy] = useState(true);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(TEMPLATE_OPTIONS[0].key);

  const [recentDocuments, setRecentDocuments] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState("");
  const [openingDocId, setOpeningDocId] = useState(null);

  useEffect(() => {
    if (!branch) {
      return;
    }

    setFormData({
      pharmacyNameTh: branch.pharmacyNameTh || "",
      branchNameTh: branch.branchNameTh || "",
      soi: branch.soi || "",
      addressNo: branch.addressNo || "",
      district: branch.district || "",
      province: branch.province || "",
      postcode: branch.postcode || "",
      phone: branch.phone || "",
      licenseNo: branch.licenseNo || "",
      operatorTitle: branch.operatorTitle || "",
      operatorWorkHours: branch.operatorWorkHours || "",
      locationText: branch.locationText || "",
    });
  }, [branch]);

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
    loadRecentDocuments();
  }, [loadRecentDocuments]);

  const currentDocumentDate = useMemo(() => {
    return documentDate || buildFallbackDocumentDate();
  }, [documentDate]);

  const handleChange = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
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

  const handleGeneratePdf = async () => {
    setPdfGenerating(true);
    setPdfError("");
    setPdfStatus("");

    try {
      const { blob, fileName, documentId } = await generateDocumentPdfWithOptions(
        {
          templateKey: selectedTemplateKey,
          formData,
        },
        {
          save: isAdmin ? saveGeneratedCopy : false,
        }
      );

      openOrDownloadBlob(blob, fileName);

      if (documentId) {
        setPdfStatus(`PDF generated and saved. ID: ${documentId}`);
        await loadRecentDocuments();
      } else {
        setPdfStatus("PDF generated.");
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
      openOrDownloadBlob(blob, fileName);
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

  return (
    <main className="app-shell form-shell">
      <div className="header-row">
        <h1>Form Profile</h1>
        <div className="header-actions">
          <button type="button" onClick={handleGeneratePdf} disabled={pdfGenerating}>
            {pdfGenerating ? "Generating..." : "Generate PDF"}
          </button>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      <p className="muted-text">
        Signed in as <strong>{user?.username}</strong> ({user?.role})
      </p>
      <section className="section-card stack-form">
        <h2>Template</h2>
        <label>
          Template key
          <select
            value={selectedTemplateKey}
            onChange={(event) => setSelectedTemplateKey(event.target.value)}
          >
            {TEMPLATE_OPTIONS.map((template) => (
              <option key={template.key} value={template.key}>
                {template.label} ({template.key})
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleOpenDebugGrid} disabled={gridGenerating}>
          {gridGenerating ? "Preparing grid..." : "Open debug grid PDF"}
        </button>
      </section>
      {isAdmin ? (
        <label className="inline-label">
          <input
            type="checkbox"
            checked={saveGeneratedCopy}
            onChange={(event) => setSaveGeneratedCopy(event.target.checked)}
          />
          Save generated document record
        </label>
      ) : null}
      {pdfError ? <p className="error-text">{pdfError}</p> : null}
      {pdfStatus ? <p className="success-text">{pdfStatus}</p> : null}

      <section className="section-card stack-form">
        <h2>Branch Profile</h2>
        <div className="pjkFormGrid">
          <PjkField id="field-ceo-name" label="ข้าพเจ้า" span={6}>
            <input id="field-ceo-name" className="pjkInput" value={CEO_NAME_TH} readOnly />
          </PjkField>

          <PjkField id="field-pharmacy-name" label="ชื่อสถานที่ขายยา" span={6}>
            <input
              id="field-pharmacy-name"
              className="pjkInput"
              value={`${formData.pharmacyNameTh} ${formData.branchNameTh}`.trim()}
              readOnly
            />
          </PjkField>

          <PjkField id="field-address-no" label="ตั้งอยู่เลขที่" span={6}>
            <input
              id="field-address-no"
              className="pjkInput"
              value={formData.addressNo}
              onChange={handleChange("addressNo")}
            />
          </PjkField>

          <PjkField id="field-soi" label="ตรอก/ซอย" span={6}>
            <input
              id="field-soi"
              className="pjkInput"
              value={formData.soi}
              onChange={handleChange("soi")}
            />
          </PjkField>

          <PjkField id="field-district" label="อำเภอ/เขต" span={4}>
            <input
              id="field-district"
              className="pjkInput"
              value={formData.district}
              onChange={handleChange("district")}
            />
          </PjkField>

          <PjkField id="field-province" label="จังหวัด" span={4}>
            <input
              id="field-province"
              className="pjkInput"
              value={formData.province}
              onChange={handleChange("province")}
            />
          </PjkField>

          <PjkField id="field-postcode" label="รหัสไปรษณีย์" span={4}>
            <input
              id="field-postcode"
              className="pjkInput"
              value={formData.postcode}
              onChange={handleChange("postcode")}
            />
          </PjkField>

          <PjkField id="field-phone" label="โทรศัพท์" span={6}>
            <input
              id="field-phone"
              className="pjkInput"
              value={formData.phone}
              onChange={handleChange("phone")}
            />
          </PjkField>

          <PjkField id="field-operator-title" label="มี นาย/นาง/นางสาว" span={6}>
            <input
              id="field-operator-title"
              className="pjkInput"
              value={formData.operatorTitle}
              onChange={handleChange("operatorTitle")}
            />
          </PjkField>

          <PjkField
            id="field-operator-work-hours"
            label="เป็นผู้มีหน้าที่ปฏิบัติการ เวลาปฏิบัติการ"
            span={12}
          >
            <input
              id="field-operator-work-hours"
              className="pjkInput"
              value={formData.operatorWorkHours}
              onChange={handleChange("operatorWorkHours")}
            />
          </PjkField>

          <PjkField id="field-license-no" label="ใบอนุญาตเลขที่" span={6}>
            <input
              id="field-license-no"
              className="pjkInput"
              value={formData.licenseNo}
              onChange={handleChange("licenseNo")}
            />
          </PjkField>

          <PjkField id="field-location-text" label="เขียนที่" span={6}>
            <input
              id="field-location-text"
              className="pjkInput"
              value={formData.locationText}
              onChange={handleChange("locationText")}
              readOnly={!isAdmin}
            />
          </PjkField>
        </div>
      </section>

      <section className="section-card stack-form">
        <h2>Date</h2>

        {isAdmin ? (
          <div className="stack-form">
            <label className="inline-label">
              <input
                type="radio"
                name="dateMode"
                checked={settingsState.useSystemDate}
                onChange={() =>
                  setSettingsState((current) => ({ ...current, useSystemDate: true }))
                }
              />
              ใช้วันที่จากระบบ
            </label>

            <label className="inline-label">
              <input
                type="radio"
                name="dateMode"
                checked={!settingsState.useSystemDate}
                onChange={() =>
                  setSettingsState((current) => ({ ...current, useSystemDate: false }))
                }
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
              {settingsSaving ? "Saving..." : "Save date settings"}
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

      {isAdmin ? (
        <section className="section-card stack-form">
          <h2>Recent Documents</h2>
          {recentLoading ? <p className="muted-text">Loading...</p> : null}
          {recentError ? <p className="error-text">{recentError}</p> : null}
          {!recentLoading && recentDocuments.length === 0 ? (
            <p className="muted-text">No documents yet.</p>
          ) : null}

          {recentDocuments.map((doc) => (
            <div key={doc.id} className="recent-item">
              <div>
                <p className="recent-id">{doc.id}</p>
                <p className="recent-meta">
                  Branch {doc.branchCode} | By {doc.createdByUsername} | Date{" "}
                  {doc.documentDateISO || "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenSavedDocument(doc.id)}
                disabled={openingDocId === doc.id}
              >
                {openingDocId === doc.id ? "Opening..." : "Open PDF"}
              </button>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}

export default FormPage;
