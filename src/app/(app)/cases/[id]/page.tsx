"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { generateBankPack } from "@/lib/bank-pack";
import { CASE_STATUS_COLORS, TASK_STATUS_COLORS, CATEGORY_LABELS } from "@/lib/constants";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { IsdRisksBanner } from "@/components/isd-risks-banner";
import { CaseHealthCard } from "@/components/case-health-card";
import { CaseDocumentGenerator } from "@/components/case-document-generator";
import { CaseNextAction } from "@/components/case-next-action";
const statuses = ["INTAKE", "VALIDATION", "IN_PROGRESS", "PENDING_DOCS", "READY_TO_SEND", "SENT", "FOLLOW_UP", "CLOSED", "ARCHIVED"];
const taskStatuses = ["PENDING", "IN_PROGRESS", "BLOCKED", "READY", "APPROVED", "DONE", "SKIPPED"];

interface CaseDetail {
  id: string; ref: string; status: string; isUrgent: boolean; hasDeceasedInsurance: boolean;
  categories: string[]; province: string | null; notes: string | null;
  portalToken: string; portalEnabled: boolean;
  consentAccepted: boolean; consentDate: string | null; legitimationNote: string | null;
  hasUrbanProperty: boolean;
  propertyAcquisitionValue: number | null;
  propertyTransmissionValue: number | null;
  preexistingPatrimony: number | null;
  recentResidenceChange: boolean;
  previousResidenceProvince: string | null;
  deceased: { fullName: string; deathDate: string | null; dni: string | null } | null;
  contact: { fullName: string; phone: string | null; email: string | null; relationship: string | null } | null;
  tasks: any[]; documents: any[]; approvals: any[]; auditLogs: any[];
  caseDeadlines: { certificatesAvailable: string; isdDeadline: string; isdExtensionRequestDeadline: string } | null;
  createdAt: string;
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [caseTemplates, setCaseTemplates] = useState<any[]>([]);
  const [applyTplOpen, setApplyTplOpen] = useState(false);
  const [selectedCaseTpl, setSelectedCaseTpl] = useState("");
  const [applyTplLoading, setApplyTplLoading] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [portalMessages, setPortalMessages] = useState<any[]>([]);
  const [portalReply, setPortalReply] = useState("");
  const [portalReplySending, setPortalReplySending] = useState(false);
  const [portalUnread, setPortalUnread] = useState(0);
  const [notesInput, setNotesInput] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [legitimationInput, setLegitimationInput] = useState("");
  const [legitimationSaving, setLegitimationSaving] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [taskNoteOpenId, setTaskNoteOpenId] = useState<string | null>(null);
  const [taskNotesCache, setTaskNotesCache] = useState<Record<string, { id: string; content: string; createdAt: string; user: { name: string | null; email: string } }[]>>({});
  const [taskNotesLoading, setTaskNotesLoading] = useState(false);
  const [taskNoteInput, setTaskNoteInput] = useState("");
  const [taskNoteSaving, setTaskNoteSaving] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [docRequestOpen, setDocRequestOpen] = useState(false);
  const [docRequestLoading, setDocRequestLoading] = useState(false);
  const [docRequestResult, setDocRequestResult] = useState<{ emailSubject: string; emailBody: string; documentList: string[]; contactName: string | null; contactEmail: string | null } | null>(null);
  const [docRequestCopied, setDocRequestCopied] = useState(false);
  const [smartTasksLoading, setSmartTasksLoading] = useState(false);
  const [smartTasksResult, setSmartTasksResult] = useState<{ totalAdded: number; summary: string } | null>(null);
  const [progressReportOpen, setProgressReportOpen] = useState(false);
  const [progressReportLoading, setProgressReportLoading] = useState(false);
  const [progressReportResult, setProgressReportResult] = useState<{ subject: string; body: string; completedItems: string[]; pendingItems: string[]; nextSteps: string[]; contactName: string | null; contactEmail: string | null } | null>(null);
  const [progressReportCopied, setProgressReportCopied] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [portalAiLoading, setPortalAiLoading] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffResult, setHandoffResult] = useState<{ title: string; generatedAt: string; caseRef: string; sections: { heading: string; content: string }[]; openItems: { priority: string; text: string }[]; alerts: string[]; model: string } | null>(null);
  const [handoffCopied, setHandoffCopied] = useState(false);
  const [closureCheckOpen, setClosureCheckOpen] = useState(false);
  const [closureCheckLoading, setClosureCheckLoading] = useState(false);
  const [closureCheckResult, setClosureCheckResult] = useState<{ safe: boolean; warnings: { level: "error" | "warning"; message: string }[]; stats: any } | null>(null);
  const [pendingCloseStatus, setPendingCloseStatus] = useState<string | null>(null);
  const [statusSuggestionDismissed, setStatusSuggestionDismissed] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [blockModal, setBlockModal] = useState<{ taskId: string; title: string } | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockedUntil, setBlockedUntil] = useState("");
  const [deadlineEditId, setDeadlineEditId] = useState<string | null>(null);
  const [deceasedEditOpen, setDeceasedEditOpen] = useState(false);
  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [detailsEditOpen, setDetailsEditOpen] = useState(false);
  const [fiscalEditOpen, setFiscalEditOpen] = useState(false);
  const [deceasedForm, setDeceasedForm] = useState({ fullName: "", deathDate: "", dni: "" });
  const [contactForm, setContactForm] = useState({ fullName: "", phone: "", email: "", relationship: "" });
  const [detailsForm, setDetailsForm] = useState({ province: "", categories: [] as string[], hasDeceasedInsurance: false });
  const [fiscalForm, setFiscalForm] = useState({
    hasUrbanProperty: false,
    propertyAcquisitionValue: "",
    propertyTransmissionValue: "",
    preexistingPatrimony: "",
    recentResidenceChange: false,
    previousResidenceProvince: "",
  });
  const [infoSaving, setInfoSaving] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskForm, setAddTaskForm] = useState({ title: "", category: "OTROS", description: "", deadline: "", assigneeId: "" });
  const [addTaskSaving, setAddTaskSaving] = useState(false);
  const [titleEditId, setTitleEditId] = useState<string | null>(null);

  function showError(msg: string) {
    setToastError(msg);
    setTimeout(() => setToastError(null), 5000);
  }

  function showSuccess(msg: string) {
    setToastSuccess(msg);
    setTimeout(() => setToastSuccess(null), 4000);
  }

  function copyPortalLink() {
    if (!caseData) return;
    const url = `${window.location.origin}/portal/${caseData.portalToken}`;
    navigator.clipboard.writeText(url).then(() => showSuccess("Enlace copiado al portapapeles"));
  }

  function buildPortalMailto(): string {
    if (!caseData) return "#";
    const url = `${window.location.origin}/portal/${caseData.portalToken}`;
    const contactName = caseData.contact?.fullName?.split(",")[0]?.split(" ")[0] || "";
    const deceasedName = caseData.deceased?.fullName || "su familiar";
    const subject = `Acceso al portal del expediente ${caseData.ref}`;
    const body =
`Estimad${contactName ? "o/a " + contactName : "a familia"},

Le facilitamos el enlace al portal donde puede consultar el estado del expediente de ${deceasedName}, subir documentación y comunicarse con nosotros:

${url}

Quedamos a su disposición para cualquier consulta.

Atentamente,
El equipo de gestión`;
    const to = caseData.contact?.email ? encodeURIComponent(caseData.contact.email) : "";
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const uniqueTasks = useMemo(() => {
    if (!caseData) return [];
    const seen = new Set<string>();
    return caseData.tasks.filter((t: any) => {
      const key = `${t.category}::${t.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [caseData]);

  const taskStats = useMemo(() => {
    const total = uniqueTasks.length;
    const done = uniqueTasks.filter((t: any) => t.status === "DONE" || t.status === "SKIPPED").length;
    const blocked = uniqueTasks.filter((t: any) => t.status === "BLOCKED").length;
    const inProgress = uniqueTasks.filter((t: any) => t.status === "IN_PROGRESS").length;
    const overdue = uniqueTasks.filter((t: any) => {
      const d = t.deadline ?? t.dueDate;
      return d && t.status !== "DONE" && t.status !== "SKIPPED" && new Date(d) < new Date();
    }).length;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, blocked, inProgress, overdue, progressPct };
  }, [uniqueTasks]);

  // Smart status suggestion
  const suggestedStatus = useMemo((): { status: string; label: string; reason: string } | null => {
    if (!caseData) return null;
    const s = caseData.status;
    const { total, done, inProgress, blocked, overdue } = taskStats;
    if (s === "CLOSED" || s === "ARCHIVED") return null;
    // All tasks done — suggest closing
    if (total > 0 && done === total && s !== "CLOSED") {
      return { status: "CLOSED", label: "Cerrar expediente", reason: "Todas las tareas están completadas." };
    }
    // High completion + no blocks — suggest READY_TO_SEND or SENT
    if (total > 0 && done / total >= 0.9 && blocked === 0 && overdue === 0 && s === "IN_PROGRESS") {
      return { status: "READY_TO_SEND", label: "Marcar como listo para enviar", reason: `${done}/${total} tareas completadas, sin bloqueos.` };
    }
    // Has in-progress tasks + status is INTAKE/VALIDATION → suggest IN_PROGRESS
    if (inProgress > 0 && (s === "INTAKE" || s === "VALIDATION")) {
      return { status: "IN_PROGRESS", label: "Pasar a En curso", reason: `${inProgress} tarea${inProgress !== 1 ? "s" : ""} ya en progreso.` };
    }
    // No pending tasks, in follow-up
    if (s === "FOLLOW_UP" && done === total && total > 0) {
      return { status: "CLOSED", label: "Cerrar expediente", reason: "En seguimiento con todas las tareas completadas." };
    }
    return null;
  }, [caseData, taskStats]);

  const handleDuplicate = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/duplicate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      router.push(`/cases/${data.id}`);
    } else {
      const err = await res.json().catch(() => null);
      showError(err?.error || "Error al duplicar");
    }
  }, [caseId, router]);

  useEffect(() => { fetchCase(); fetchTemplates(); fetchMembers(); fetchCaseTemplates(); fetchPortalMessages(); fetchAnalysis(); }, [caseId]);

  async function fetchAnalysis() {
    try {
      const res = await fetch(`/api/cases/${caseId}/analyze`);
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
      }
    } catch {}
  }

  async function openChat() {
    setChatOpen(true);
    if (chatHistory.length === 0) {
      setChatLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/chat`);
        if (res.ok) {
          const data = await res.json();
          setChatHistory(data.history || []);
        }
      } finally {
        setChatLoading(false);
      }
    }
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatSending) return;
    setChatSending(true);
    setChatInput("");
    setChatHistory((h) => [...h, { role: "user", content: msg }]);
    try {
      const res = await fetch(`/api/cases/${caseId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data.history || []);
      } else {
        const err = await res.json().catch(() => null);
        setChatHistory((h) => [...h, { role: "assistant", content: `Error: ${err?.error || "no se pudo enviar"}` }]);
      }
    } catch (e: any) {
      setChatHistory((h) => [...h, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setChatSending(false);
    }
  }

  async function clearChat() {
    if (!confirm("¿Borrar todo el historial de chat de este expediente?")) return;
    await fetch(`/api/cases/${caseId}/chat`, { method: "DELETE" });
    setChatHistory([]);
  }

  async function openDocRequest() {
    setDocRequestOpen(true);
    if (!docRequestResult) {
      setDocRequestLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/doc-request`);
        if (res.ok) {
          const data = await res.json();
          if (data.result) setDocRequestResult(data.result);
        }
      } finally {
        setDocRequestLoading(false);
      }
    }
  }

  async function generateDocRequestEmail() {
    setDocRequestLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/doc-request`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDocRequestResult(data.result);
      } else {
        const err = await res.json().catch(() => null);
        showError(err?.error || "Error generando solicitud");
      }
    } finally {
      setDocRequestLoading(false);
    }
  }

  function copyDocRequest() {
    if (!docRequestResult) return;
    const text = `Asunto: ${docRequestResult.emailSubject}\n\n${docRequestResult.emailBody}`;
    navigator.clipboard.writeText(text).then(() => {
      setDocRequestCopied(true);
      setTimeout(() => setDocRequestCopied(false), 2000);
    });
  }

  async function runSmartTasks() {
    if (smartTasksLoading) return;
    setSmartTasksLoading(true);
    setSmartTasksResult(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/smart-tasks`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSmartTasksResult({ totalAdded: data.totalAdded, summary: data.summary });
        fetchCase();
      } else {
        const err = await res.json().catch(() => null);
        showError(err?.error || "Error generando tareas");
      }
    } finally {
      setSmartTasksLoading(false);
    }
  }

  async function openProgressReport() {
    setProgressReportOpen(true);
    if (!progressReportResult) {
      setProgressReportLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/progress-report`);
        if (res.ok) {
          const data = await res.json();
          if (data.result) setProgressReportResult(data.result);
        }
      } finally {
        setProgressReportLoading(false);
      }
    }
  }

  async function generateProgressReportFn() {
    setProgressReportLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/progress-report`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setProgressReportResult(data.result);
      } else {
        const err = await res.json().catch(() => null);
        showError(err?.error || "Error generando informe");
      }
    } finally {
      setProgressReportLoading(false);
    }
  }

  function copyProgressReport() {
    if (!progressReportResult) return;
    const text = `Asunto: ${progressReportResult.subject}\n\n${progressReportResult.body}`;
    navigator.clipboard.writeText(text).then(() => {
      setProgressReportCopied(true);
      setTimeout(() => setProgressReportCopied(false), 2000);
    });
  }

  async function generatePortalReply() {
    const lastFamilyMsg = [...portalMessages].reverse().find((m: any) => m.fromFamily);
    if (!lastFamilyMsg && portalMessages.length === 0) {
      setPortalReply("Estimada familia,\n\nNos ponemos en contacto con usted para informarle del estado actual de los trámites. Estamos trabajando en la gestión de todos los asuntos pendientes y le mantendremos informado de cualquier novedad.\n\nQuedamos a su disposición para cualquier consulta.\n\nAtentamente,\nEl equipo de gestión");
      return;
    }
    setPortalAiLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/portal-ai-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastMessage: lastFamilyMsg?.content || "" }),
      });
      if (res.ok) {
        const data = await res.json();
        setPortalReply(data.reply || "");
      } else {
        const err = await res.json().catch(() => null);
        showError(err?.error || "Error generando respuesta");
      }
    } finally {
      setPortalAiLoading(false);
    }
  }

  async function openHandoffBriefing() {
    setHandoffOpen(true);
    if (!handoffResult) {
      setHandoffLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/handoff-briefing`);
        if (res.ok) {
          const data = await res.json();
          if (data.briefing) setHandoffResult(data.briefing);
        }
      } finally {
        setHandoffLoading(false);
      }
    }
  }

  async function generateHandoffBriefingFn() {
    setHandoffLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/handoff-briefing`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setHandoffResult(data.briefing);
      } else {
        const err = await res.json().catch(() => null);
        showError(err?.error || "Error generando briefing");
      }
    } finally {
      setHandoffLoading(false);
    }
  }

  function copyHandoff() {
    if (!handoffResult) return;
    const lines: string[] = [handoffResult.title, ""];
    if (handoffResult.alerts?.length) {
      lines.push("⚠️ ALERTAS: " + handoffResult.alerts.join(" | "), "");
    }
    for (const s of handoffResult.sections) {
      lines.push(`## ${s.heading}`, s.content, "");
    }
    if (handoffResult.openItems?.length) {
      lines.push("## Pendientes");
      for (const item of handoffResult.openItems) {
        lines.push(`[${item.priority.toUpperCase()}] ${item.text}`);
      }
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setHandoffCopied(true);
      setTimeout(() => setHandoffCopied(false), 2000);
    });
  }

  async function runAnalysis() {
    setAnalysisLoading(true);
    setAnalysisOpen(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/analyze`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
      } else {
        const err = await res.json().catch(() => null);
        showError(err?.error || "Error al analizar expediente");
      }
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function fetchCase() {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`);
      if (res.ok) {
        const data = await res.json();
        setCaseData(data);
        setNotesInput(data.notes || "");
        setLegitimationInput(data.legitimationNote || "");
      }
    } finally {
      setLoading(false);
    }
  }
  async function fetchTemplates() {
    const res = await fetch("/api/templates");
    if (res.ok) setTemplates(await res.json());
  }
  async function fetchMembers() {
    const res = await fetch("/api/org/members");
    if (res.ok) setMembers(await res.json());
  }

  async function fetchCaseTemplates() {
    const res = await fetch("/api/case-templates");
    if (res.ok) setCaseTemplates(await res.json());
  }

  async function fetchPortalMessages() {
    const res = await fetch(`/api/cases/${caseId}/portal-messages`);
    if (res.ok) {
      const data = await res.json();
      setPortalMessages(data);
      setPortalUnread(data.filter((m: any) => m.fromFamily && !m.readAt).length);
    }
  }

  async function sendPortalReply() {
    if (!portalReply.trim()) return;
    setPortalReplySending(true);
    const res = await fetch(`/api/cases/${caseId}/portal-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: portalReply.trim() }),
    });
    setPortalReplySending(false);
    if (res.ok) {
      setPortalReply("");
      fetchPortalMessages();
    } else {
      const err = await res.json().catch(() => null);
      showError(err?.error || "Error al enviar mensaje");
    }
  }

  async function applyTemplate() {
    if (!selectedCaseTpl) return;
    setApplyTplLoading(true);
    const res = await fetch(`/api/cases/${caseId}/apply-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: selectedCaseTpl }),
    });
    setApplyTplLoading(false);
    if (res.ok) {
      const data = await res.json();
      setApplyTplOpen(false);
      setSelectedCaseTpl("");
      fetchCase();
      showSuccess(`Plantilla aplicada: ${data.added} tarea(s) añadida(s)`);
    } else {
      const err = await res.json().catch(() => null);
      showError(err?.error || "Error al aplicar plantilla");
    }
  }

  async function updateStatus(status: string) {
    if (status === "CLOSED" || status === "ARCHIVED") {
      // Show closure safeguard modal before proceeding
      setPendingCloseStatus(status);
      setClosureCheckOpen(true);
      setClosureCheckResult(null);
      setClosureCheckLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/closure-check`);
        if (res.ok) setClosureCheckResult(await res.json());
      } finally {
        setClosureCheckLoading(false);
      }
      return;
    }
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchCase();
  }

  async function confirmClose() {
    if (!pendingCloseStatus) return;
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: pendingCloseStatus }),
    });
    setClosureCheckOpen(false);
    setPendingCloseStatus(null);
    setClosureCheckResult(null);
    fetchCase();
  }

  async function updateTaskStatus(taskId: string, status: string, reason?: string, until?: string) {
    if (status === "BLOCKED" && reason === undefined) {
      const task = caseData?.tasks.find((t: any) => t.id === taskId);
      setBlockReason(task?.blockReason || "");
      setBlockedUntil(task?.blockedUntil ? new Date(task.blockedUntil).toISOString().slice(0, 10) : "");
      setBlockModal({ taskId, title: task?.title || "" });
      return;
    }
    await fetch(`/api/cases/${caseId}/tasks`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        status,
        ...(status === "BLOCKED" && { blockReason: reason || null, blockedUntil: until || null }),
      }),
    });
    fetchCase();
  }

  async function assignTask(taskId: string, assigneeId: string | null) {
    await fetch(`/api/cases/${caseId}/tasks`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, assigneeId }),
    });
    fetchCase();
  }

  async function setTaskDependency(taskId: string, dependsOnId: string | null) {
    await fetch(`/api/cases/${caseId}/tasks`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, dependsOnId }),
    });
    fetchCase();
  }

  async function updateTaskDeadline(taskId: string, deadline: string | null) {
    await fetch(`/api/cases/${caseId}/tasks`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, deadline: deadline || null }),
    });
    fetchCase();
  }

  async function saveDeceasedInfo() {
    setInfoSaving(true);
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deceased: deceasedForm }),
    });
    setDeceasedEditOpen(false);
    setInfoSaving(false);
    fetchCase();
  }

  async function saveContactInfo() {
    setInfoSaving(true);
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact: contactForm }),
    });
    setContactEditOpen(false);
    setInfoSaving(false);
    fetchCase();
  }

  async function updateTaskTitle(taskId: string, title: string) {
    if (!title.trim()) return;
    await fetch(`/api/cases/${caseId}/tasks`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, title: title.trim() }),
    });
    fetchCase();
  }

  async function deleteTask(taskId: string, title: string) {
    if (!confirm(`¿Eliminar la tarea "${title}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/cases/${caseId}/tasks?taskId=${encodeURIComponent(taskId)}`, { method: "DELETE" });
    if (res.ok) fetchCase();
    else showError("Error al eliminar la tarea");
  }

  async function deleteDocument(docId: string, fileName: string) {
    if (!confirm(`¿Eliminar "${fileName}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    if (res.ok) fetchCase();
    else showError("Error al eliminar el documento");
  }

  async function createTask() {
    if (!addTaskForm.title.trim()) return;
    setAddTaskSaving(true);
    const res = await fetch(`/api/cases/${caseId}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: addTaskForm.title.trim(),
        category: addTaskForm.category,
        description: addTaskForm.description.trim() || null,
        dueDate: addTaskForm.deadline || null,
        assigneeId: addTaskForm.assigneeId || null,
        sortOrder: (caseData?.tasks?.length ?? 0) + 1,
      }),
    });
    setAddTaskSaving(false);
    if (res.ok) {
      setAddTaskOpen(false);
      setAddTaskForm({ title: "", category: "OTROS", description: "", deadline: "", assigneeId: "" });
      fetchCase();
    }
  }

  async function saveDetailsInfo() {
    setInfoSaving(true);
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ province: detailsForm.province, categories: detailsForm.categories, hasDeceasedInsurance: detailsForm.hasDeceasedInsurance }),
    });
    setDetailsEditOpen(false);
    setInfoSaving(false);
    fetchCase();
  }

  async function saveFiscalInfo() {
    setInfoSaving(true);
    const numericOrNull = (v: string) => {
      const t = v.trim();
      if (!t) return null;
      const n = Number(t.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hasUrbanProperty: fiscalForm.hasUrbanProperty,
        propertyAcquisitionValue: numericOrNull(fiscalForm.propertyAcquisitionValue),
        propertyTransmissionValue: numericOrNull(fiscalForm.propertyTransmissionValue),
        preexistingPatrimony: numericOrNull(fiscalForm.preexistingPatrimony),
        recentResidenceChange: fiscalForm.recentResidenceChange,
        previousResidenceProvince: fiscalForm.previousResidenceProvince.trim() || null,
      }),
    });
    setFiscalEditOpen(false);
    setInfoSaving(false);
    fetchCase();
  }

  async function saveNotes() {
    setNotesSaving(true);
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesInput }),
    });
    setNotesSaving(false);
  }

  async function saveLegitimation() {
    setLegitimationSaving(true);
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legitimationNote: legitimationInput }),
    });
    setLegitimationSaving(false);
    fetchCase();
  }

  async function toggleConsent() {
    const newValue = !caseData?.consentAccepted;
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consentAccepted: newValue }),
    });
    fetchCase();
  }

  async function togglePortalEnabled() {
    const newValue = !caseData?.portalEnabled;
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalEnabled: newValue }),
    });
    setCaseData((prev) => prev ? { ...prev, portalEnabled: newValue } : prev);
  }

  async function postComment() {
    if (!commentInput.trim()) return;
    setCommentSaving(true);
    const res = await fetch(`/api/cases/${caseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentInput.trim() }),
    });
    if (res.ok) {
      setCommentInput("");
      fetchCase();
    }
    setCommentSaving(false);
  }

  async function toggleTaskNotes(taskId: string) {
    if (taskNoteOpenId === taskId) { setTaskNoteOpenId(null); return; }
    setTaskNoteOpenId(taskId);
    if (!taskNotesCache[taskId]) {
      setTaskNotesLoading(true);
      const res = await fetch(`/api/tasks/${taskId}/notes`);
      const data = res.ok ? await res.json() : [];
      setTaskNotesCache((c) => ({ ...c, [taskId]: data }));
      setTaskNotesLoading(false);
    }
  }

  async function saveTaskNote(taskId: string) {
    if (!taskNoteInput.trim()) return;
    setTaskNoteSaving(true);
    const res = await fetch(`/api/tasks/${taskId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: taskNoteInput.trim() }),
    });
    if (res.ok) {
      const note = await res.json();
      setTaskNotesCache((c) => ({ ...c, [taskId]: [...(c[taskId] ?? []), note] }));
      setTaskNoteInput("");
      fetchCase();
    }
    setTaskNoteSaving(false);
  }

  async function generateChecklist() {
    const res = await fetch("/api/autopilot/checklist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId }),
    });
    if (res.ok) fetchCase();
    else showError("Error generando checklist");
  }

  async function generateDraft(templateId: string) {
    const res = await fetch("/api/autopilot/draft", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, templateId }),
    });
    if (res.ok) {
      const data = await res.json();
      showSuccess("Borrador generado y enviado a aprobación");
      fetchCase();
    }
  }

  const [uploadHint, setUploadHint] = useState<{ fileName: string; suggestions: string[] } | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      if (!data.taskId && data.suggestions) {
        setUploadHint({ fileName: file.name, suggestions: data.suggestions });
      } else {
        setUploadHint(null);
      }
    }
    fetchCase();
    e.target.value = "";
  }

  async function handleApproval(approvalId: string, status: string) {
    await fetch(`/api/approvals/${approvalId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchCase();
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;
  if (!caseData) return <div className="text-center py-12 text-gray-400">Expediente no encontrado</div>;

  const tabs = ["overview", "tasks", "documents", "bankpack", "templates", "portal", "activity", "export"];
  const tabLabels: Record<string, string> = {
    overview: "Resumen", tasks: "Tareas", documents: "Documentos",
    bankpack: "Paquete banco", templates: "Plantillas", portal: "Portal", activity: "Actividad", export: "Exportar",
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{caseData.ref}</h1>
              {analysis?.healthScore !== undefined && (
                <button
                  onClick={() => setAnalysisOpen(true)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm hover:scale-105 transition-transform ${
                    analysis.healthScore >= 70 ? "bg-green-500" :
                    analysis.healthScore >= 40 ? "bg-orange-500" : "bg-red-500"
                  }`}
                  title={`Score IA: ${analysis.healthScore}/100 — ver análisis`}
                >
                  {analysis.healthScore}
                </button>
              )}
            </div>
            <p className="text-gray-500">{caseData.deceased?.fullName}</p>
          </div>
          <div className="flex items-center gap-3">
            {caseData.isUrgent && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Urgente</span>}
            {/* AI actions dropdown */}
            <div className="relative">
              <button
                onClick={() => setAiMenuOpen((v) => !v)}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-md text-sm font-medium hover:opacity-90 inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                IA
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {aiMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAiMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-20 py-1 overflow-hidden">
                    <button
                      onClick={() => { setAiMenuOpen(false); runAnalysis(); }}
                      disabled={analysisLoading}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 flex items-center gap-3 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <div>
                        <div className="font-medium">{analysisLoading ? "Analizando..." : "Analizar expediente"}</div>
                        <div className="text-xs text-gray-400">Score 0-100 con riesgos</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setAiMenuOpen(false); openChat(); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 flex items-center gap-3"
                    >
                      <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      <div>
                        <div className="font-medium">Chat con el expediente</div>
                        <div className="text-xs text-gray-400">Asistente con contexto completo</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setAiMenuOpen(false); openDocRequest(); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 flex items-center gap-3"
                    >
                      <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      <div>
                        <div className="font-medium">Solicitar documentación</div>
                        <div className="text-xs text-gray-400">Email listo para cliente</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setAiMenuOpen(false); openProgressReport(); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-teal-50 flex items-center gap-3"
                    >
                      <svg className="w-4 h-4 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <div>
                        <div className="font-medium">Informe para familia</div>
                        <div className="text-xs text-gray-400">Carta de actualización</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setAiMenuOpen(false); openHandoffBriefing(); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 flex items-center gap-3"
                    >
                      <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      <div>
                        <div className="font-medium">Briefing de traspaso</div>
                        <div className="text-xs text-gray-400">Resumen para ceder el expediente</div>
                      </div>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <a
                      href={`/cases/${caseId}/isd`}
                      onClick={() => setAiMenuOpen(false)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 flex items-center gap-3"
                    >
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      <div>
                        <div className="font-medium">Calculadora ISD</div>
                        <div className="text-xs text-gray-400">Modelo 650 / Sucesiones</div>
                      </div>
                    </a>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={handleDuplicate}
              className="px-3 py-1 border rounded-md text-sm text-gray-600 hover:bg-gray-50"
              title="Duplicar expediente"
            >
              Duplicar
            </button>
            <select value={caseData.status} onChange={(e) => updateStatus(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm">
              {statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>
        {taskStats.total > 0 && (
          <div className="mt-3 flex items-center gap-4">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${taskStats.progressPct === 100 ? "bg-green-500" : "bg-primary"}`}
                style={{ width: `${taskStats.progressPct}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
              <span className="font-medium text-gray-900">{taskStats.progressPct}%</span>
              <span>{taskStats.done}/{taskStats.total} tareas</span>
              {taskStats.inProgress > 0 && <span className="text-blue-600">{taskStats.inProgress} en curso</span>}
              {taskStats.blocked > 0 && <span className="text-red-600">{taskStats.blocked} bloqueadas</span>}
              {taskStats.overdue > 0 && <span className="text-red-700 font-medium">{taskStats.overdue} vencidas</span>}
            </div>
          </div>
        )}
      </div>

      {/* Smart status suggestion banner */}
      {suggestedStatus && statusSuggestionDismissed !== suggestedStatus.status && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-900">Sugerencia: {suggestedStatus.label}</p>
            <p className="text-xs text-emerald-700">{suggestedStatus.reason}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => updateStatus(suggestedStatus.status)}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              Aplicar
            </button>
            <button
              onClick={() => setStatusSuggestionDismissed(suggestedStatus.status)}
              className="p-1 text-emerald-400 hover:text-emerald-600"
              title="Descartar sugerencia"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      {/* Block task modal */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-semibold">Bloquear tarea</h3>
              <button onClick={() => setBlockModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">{blockModal.title}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del bloqueo</label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  rows={3}
                  placeholder="Ej: Esperando documentacion del banco, pendiente de firma notarial..."
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disponible a partir de (opcional)</label>
                <input
                  type="date"
                  value={blockedUntil}
                  onChange={(e) => setBlockedUntil(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/50"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setBlockModal(null)}
                  className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    updateTaskStatus(blockModal.taskId, "BLOCKED", blockReason, blockedUntil);
                    setBlockModal(null);
                  }}
                  className="px-4 py-2 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600"
                >
                  Marcar como bloqueada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {(toastError || toastSuccess) && (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
          {toastError && (
            <div className="flex items-center gap-3 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto max-w-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="flex-1">{toastError}</span>
              <button onClick={() => setToastError(null)} className="shrink-0 hover:opacity-70">✕</button>
            </div>
          )}
          {toastSuccess && (
            <div className="flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto max-w-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="flex-1">{toastSuccess}</span>
              <button onClick={() => setToastSuccess(null)} className="shrink-0 hover:opacity-70">✕</button>
            </div>
          )}
        </div>
      )}

      <div className="flex border-b mb-6 gap-1">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tabLabels[t]}
            {t === "tasks" && ` (${uniqueTasks.length})`}
            {t === "documents" && ` (${caseData.documents.length})`}
            {t === "portal" && portalUnread > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs bg-red-500 text-white rounded-full">{portalUnread}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          <CaseNextAction caseId={caseId} />
          <CaseHealthCard caseId={caseId} />
          <IsdRisksBanner caseId={caseId} />
          {/* Stats cards */}
          {(() => {
            const daysSinceDeath = caseData.deceased?.deathDate
              ? Math.floor((Date.now() - new Date(caseData.deceased.deathDate).getTime()) / (1000 * 60 * 60 * 24))
              : null;
            const linkedDocs = caseData.documents.filter((d: any) => d.task).length;
            const nextDeadline = caseData.caseDeadlines
              ? [caseData.caseDeadlines.certificatesAvailable, caseData.caseDeadlines.isdExtensionRequestDeadline, caseData.caseDeadlines.isdDeadline]
                  .map((d) => new Date(d))
                  .filter((d) => d.getTime() > Date.now())
                  .sort((a, b) => a.getTime() - b.getTime())[0]
              : null;
            const daysToNextDeadline = nextDeadline ? Math.ceil((nextDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

            return (
              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border text-center">
                  <p className="text-2xl font-bold text-gray-900">{taskStats.total > 0 ? `${taskStats.done}/${taskStats.total}` : "—"}</p>
                  <p className="text-xs text-gray-500 mt-1">Tareas completadas</p>
                  {taskStats.total > 0 && (
                    <div className="mt-2 bg-gray-200 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${taskStats.done === taskStats.total ? "bg-green-500" : "bg-primary"}`} style={{ width: `${taskStats.progressPct}%` }} />
                    </div>
                  )}
                </div>
                <div className="bg-white p-4 rounded-lg border text-center">
                  <p className="text-2xl font-bold text-gray-900">{caseData.documents.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Documentos</p>
                  {caseData.documents.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">{linkedDocs} vinculados</p>
                  )}
                </div>
                <div className="bg-white p-4 rounded-lg border text-center">
                  <p className={`text-2xl font-bold ${daysSinceDeath !== null && daysSinceDeath > 150 ? "text-red-600" : "text-gray-900"}`}>
                    {daysSinceDeath !== null ? daysSinceDeath : "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Dias desde fallecimiento</p>
                  {daysSinceDeath !== null && daysSinceDeath > 150 && (
                    <p className="text-xs text-red-500 mt-1">Plazo ISD proximo</p>
                  )}
                </div>
                <div className="bg-white p-4 rounded-lg border text-center">
                  {daysToNextDeadline !== null ? (
                    <>
                      <p className={`text-2xl font-bold ${daysToNextDeadline <= 14 ? "text-red-600" : daysToNextDeadline <= 30 ? "text-orange-600" : "text-gray-900"}`}>
                        {daysToNextDeadline}d
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Proximo plazo</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-green-600">OK</p>
                      <p className="text-xs text-gray-500 mt-1">Sin plazos urgentes</p>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="bg-white p-6 rounded-lg border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Fallecido</h3>
              {!deceasedEditOpen && (
                <button
                  onClick={() => {
                    setDeceasedForm({
                      fullName: caseData.deceased?.fullName || "",
                      deathDate: caseData.deceased?.deathDate ? new Date(caseData.deceased.deathDate).toISOString().slice(0, 10) : "",
                      dni: caseData.deceased?.dni || "",
                    });
                    setDeceasedEditOpen(true);
                  }}
                  className="text-xs text-gray-400 hover:text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50"
                >
                  Editar
                </button>
              )}
            </div>
            {deceasedEditOpen ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Nombre completo</label>
                  <input
                    className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={deceasedForm.fullName}
                    onChange={(e) => setDeceasedForm((f) => ({ ...f, fullName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Fecha de fallecimiento</label>
                  <input
                    type="date"
                    className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={deceasedForm.deathDate}
                    onChange={(e) => setDeceasedForm((f) => ({ ...f, deathDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">DNI/NIE</label>
                  <input
                    className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={deceasedForm.dni}
                    onChange={(e) => setDeceasedForm((f) => ({ ...f, dni: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveDeceasedInfo} disabled={infoSaving} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                    {infoSaving ? "Guardando…" : "Guardar"}
                  </button>
                  <button onClick={() => setDeceasedEditOpen(false)} className="px-3 py-1 text-xs border rounded hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p><strong>Nombre:</strong> {caseData.deceased?.fullName}</p>
                {caseData.deceased?.deathDate && <p><strong>Fecha:</strong> {new Date(caseData.deceased.deathDate).toLocaleDateString("es-ES")}</p>}
                {caseData.deceased?.dni && <p><strong>DNI:</strong> {caseData.deceased.dni}</p>}
              </>
            )}
          </div>
          <div className="bg-white p-6 rounded-lg border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Solicitante</h3>
              {!contactEditOpen && (
                <button
                  onClick={() => {
                    setContactForm({
                      fullName: caseData.contact?.fullName || "",
                      phone: caseData.contact?.phone || "",
                      email: caseData.contact?.email || "",
                      relationship: caseData.contact?.relationship || "",
                    });
                    setContactEditOpen(true);
                  }}
                  className="text-xs text-gray-400 hover:text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50"
                >
                  Editar
                </button>
              )}
            </div>
            {contactEditOpen ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Nombre completo</label>
                  <input
                    className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={contactForm.fullName}
                    onChange={(e) => setContactForm((f) => ({ ...f, fullName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Telefono</label>
                  <input
                    className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Email</label>
                  <input
                    type="email"
                    className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Relacion con el fallecido</label>
                  <input
                    className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={contactForm.relationship}
                    onChange={(e) => setContactForm((f) => ({ ...f, relationship: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveContactInfo} disabled={infoSaving} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                    {infoSaving ? "Guardando…" : "Guardar"}
                  </button>
                  <button onClick={() => setContactEditOpen(false)} className="px-3 py-1 text-xs border rounded hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p><strong>Nombre:</strong> {caseData.contact?.fullName}</p>
                {caseData.contact?.phone && (
                  <p className="flex items-center gap-2">
                    <span><strong>Teléfono:</strong> {caseData.contact.phone}</span>
                    {(() => {
                      const waText = `Hola ${caseData.contact?.fullName?.split(",")[1]?.trim() ?? caseData.contact?.fullName ?? ""}, te escribo del expediente ${caseData.ref}${caseData.deceased?.fullName ? ` (${caseData.deceased.fullName})` : ""}.`;
                      const waUrl = buildWhatsAppUrl({ phone: caseData.contact.phone, text: waText });
                      return waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir WhatsApp con el contacto"
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M20.52 3.48A11.94 11.94 0 0012.04 0C5.5 0 .2 5.3.2 11.84c0 2.09.55 4.13 1.6 5.93L0 24l6.4-1.68a11.84 11.84 0 005.64 1.44h.01c6.54 0 11.84-5.3 11.84-11.84a11.78 11.78 0 00-3.37-8.44zM12.04 21.5h-.01a9.66 9.66 0 01-4.93-1.35l-.36-.21-3.8 1 1.02-3.7-.23-.38a9.6 9.6 0 01-1.46-5.02c0-5.31 4.32-9.62 9.62-9.62 2.57 0 4.99 1 6.81 2.82a9.55 9.55 0 012.81 6.8c0 5.32-4.32 9.66-9.47 9.66zm5.27-7.21c-.29-.14-1.71-.84-1.97-.94-.26-.1-.46-.14-.65.15-.19.29-.74.94-.91 1.13-.17.19-.34.22-.62.07-1.71-.86-2.83-1.53-3.96-3.45-.3-.52.3-.49.85-1.6.09-.19.04-.36-.02-.5-.06-.14-.65-1.57-.9-2.15-.23-.55-.47-.48-.65-.49h-.55c-.19 0-.5.07-.76.36-.26.29-1 1-1 2.43s1.02 2.82 1.17 3.01c.14.19 2.01 3.07 4.87 4.31.68.29 1.21.47 1.62.6.68.22 1.3.19 1.79.12.55-.08 1.71-.7 1.95-1.37.24-.67.24-1.25.17-1.37-.07-.12-.27-.2-.55-.34z" />
                          </svg>
                          WhatsApp
                        </a>
                      ) : null;
                    })()}
                  </p>
                )}
                {caseData.contact?.email && <p><strong>Email:</strong> {caseData.contact.email}</p>}
                {caseData.contact?.relationship && <p><strong>Relación:</strong> {caseData.contact.relationship}</p>}
              </>
            )}
          </div>
          <div className="bg-white p-6 rounded-lg border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Detalles</h3>
              {!detailsEditOpen && (
                <button
                  onClick={() => {
                    setDetailsForm({
                      province: caseData.province || "",
                      categories: [...caseData.categories],
                      hasDeceasedInsurance: caseData.hasDeceasedInsurance,
                    });
                    setDetailsEditOpen(true);
                  }}
                  className="text-xs text-gray-400 hover:text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50"
                >
                  Editar
                </button>
              )}
            </div>
            {detailsEditOpen ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Provincia</label>
                  <input
                    className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={detailsForm.province}
                    onChange={(e) => setDetailsForm((f) => ({ ...f, province: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Categorias</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                      <label key={val} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={detailsForm.categories.includes(val)}
                          onChange={(e) => setDetailsForm((f) => ({
                            ...f,
                            categories: e.target.checked
                              ? [...f.categories, val]
                              : f.categories.filter((c) => c !== val),
                          }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={detailsForm.hasDeceasedInsurance}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, hasDeceasedInsurance: e.target.checked }))}
                    />
                    Seguro de decesos
                  </label>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveDetailsInfo} disabled={infoSaving} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                    {infoSaving ? "Guardando…" : "Guardar"}
                  </button>
                  <button onClick={() => setDetailsEditOpen(false)} className="px-3 py-1 text-xs border rounded hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p><strong>Provincia:</strong> {caseData.province || "No especificada"}</p>
                <p><strong>Categorias:</strong> {caseData.categories.length > 0 ? caseData.categories.map((c) => CATEGORY_LABELS[c] || c).join(", ") : "—"}</p>
                <p><strong>Seguro decesos:</strong> {caseData.hasDeceasedInsurance ? "Si" : "No"}</p>
                <p><strong>Creado:</strong> {new Date(caseData.createdAt).toLocaleDateString("es-ES")}</p>
              </>
            )}
          </div>
          <div className="bg-white p-6 rounded-lg border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Datos fiscales</h3>
              {!fiscalEditOpen && (
                <button
                  onClick={() => {
                    setFiscalForm({
                      hasUrbanProperty: caseData.hasUrbanProperty,
                      propertyAcquisitionValue:
                        caseData.propertyAcquisitionValue != null ? String(caseData.propertyAcquisitionValue) : "",
                      propertyTransmissionValue:
                        caseData.propertyTransmissionValue != null ? String(caseData.propertyTransmissionValue) : "",
                      preexistingPatrimony:
                        caseData.preexistingPatrimony != null ? String(caseData.preexistingPatrimony) : "",
                      recentResidenceChange: caseData.recentResidenceChange,
                      previousResidenceProvince: caseData.previousResidenceProvince ?? "",
                    });
                    setFiscalEditOpen(true);
                  }}
                  className="text-xs text-gray-400 hover:text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50"
                >
                  Editar
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Estos datos alimentan el Radar ISD: tramos del coeficiente multiplicador,
              plazo y no-sujeción de la plusvalía municipal (IIVTNU).
            </p>
            {fiscalEditOpen ? (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fiscalForm.hasUrbanProperty}
                    onChange={(e) => setFiscalForm((f) => ({ ...f, hasUrbanProperty: e.target.checked }))}
                  />
                  Inmueble urbano en el caudal
                </label>
                {fiscalForm.hasUrbanProperty && (
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div>
                      <label className="text-xs text-gray-500">Valor adquisición (€)</label>
                      <input
                        className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                        inputMode="decimal"
                        placeholder="180000"
                        value={fiscalForm.propertyAcquisitionValue}
                        onChange={(e) =>
                          setFiscalForm((f) => ({ ...f, propertyAcquisitionValue: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Valor transmisión (€)</label>
                      <input
                        className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                        inputMode="decimal"
                        placeholder="240000"
                        value={fiscalForm.propertyTransmissionValue}
                        onChange={(e) =>
                          setFiscalForm((f) => ({ ...f, propertyTransmissionValue: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500">Patrimonio preexistente del heredero (€)</label>
                  <input
                    className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    inputMode="decimal"
                    placeholder="402678"
                    value={fiscalForm.preexistingPatrimony}
                    onChange={(e) => setFiscalForm((f) => ({ ...f, preexistingPatrimony: e.target.value }))}
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Tramos del art. 22 Ley 29/1987: 402.678 €, 2.007.380 € y 4.020.770 €.
                  </p>
                </div>
                <div className="border-t pt-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fiscalForm.recentResidenceChange}
                      onChange={(e) =>
                        setFiscalForm((f) => ({ ...f, recentResidenceChange: e.target.checked }))
                      }
                    />
                    Cambio de residencia en los 5 años previos
                  </label>
                  {fiscalForm.recentResidenceChange && (
                    <div className="mt-2 pl-6">
                      <label className="text-xs text-gray-500">Provincia / CCAA previa (opcional)</label>
                      <input
                        className="mt-0.5 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="Barcelona"
                        value={fiscalForm.previousResidenceProvince}
                        onChange={(e) =>
                          setFiscalForm((f) => ({ ...f, previousResidenceProvince: e.target.value }))
                        }
                      />
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Activa la alerta del art. 28 Ley 22/2009 cuando la CCAA actual bonifica
                        sensiblemente más que la previa.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveFiscalInfo}
                    disabled={infoSaving}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {infoSaving ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    onClick={() => setFiscalEditOpen(false)}
                    className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>
                  <strong>Inmueble urbano:</strong> {caseData.hasUrbanProperty ? "Sí" : "No declarado"}
                </p>
                {caseData.hasUrbanProperty && (
                  <>
                    <p>
                      <strong>Valor adquisición:</strong>{" "}
                      {caseData.propertyAcquisitionValue != null
                        ? `${caseData.propertyAcquisitionValue.toLocaleString("es-ES")} €`
                        : "—"}
                    </p>
                    <p>
                      <strong>Valor transmisión:</strong>{" "}
                      {caseData.propertyTransmissionValue != null
                        ? `${caseData.propertyTransmissionValue.toLocaleString("es-ES")} €`
                        : "—"}
                    </p>
                  </>
                )}
                <p>
                  <strong>Patrimonio preexistente:</strong>{" "}
                  {caseData.preexistingPatrimony != null
                    ? `${caseData.preexistingPatrimony.toLocaleString("es-ES")} €`
                    : "—"}
                </p>
                <p>
                  <strong>Cambio residencia &lt;5 años:</strong>{" "}
                  {caseData.recentResidenceChange ? "Sí" : "No"}
                  {caseData.recentResidenceChange && caseData.previousResidenceProvince
                    ? ` (previa: ${caseData.previousResidenceProvince})`
                    : ""}
                </p>
              </>
            )}
          </div>
          <div className="bg-white p-6 rounded-lg border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Portal familia</h3>
              <div className="flex items-center gap-2">
                {!caseData.portalEnabled && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Desactivado</span>
                )}
                {portalUnread > 0 && (
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">{portalUnread} mensaje{portalUnread !== 1 ? "s" : ""} nuevo{portalUnread !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <input type="text" readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${caseData.portalToken}`}
                className="flex-1 px-3 py-2 border rounded-md text-sm bg-gray-50" />
              <button onClick={copyPortalLink}
                className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50">Copiar</button>
              <a href={buildPortalMailto()}
                className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50 inline-flex items-center gap-1"
                title={caseData.contact?.email ? `Enviar a ${caseData.contact.email}` : "Abrir borrador de email"}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </a>
            </div>
            <button onClick={() => setTab("portal")} className="text-sm text-primary hover:underline">
              {portalUnread > 0 ? `Ver mensajes (${portalUnread} nuevo${portalUnread !== 1 ? "s" : ""}) →` : "Ver portal y mensajes →"}
            </button>
          </div>

          {/* Case-level deadlines */}
          {caseData.caseDeadlines && (
            <div className="md:col-span-2 bg-white p-6 rounded-lg border">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Plazos legales clave
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Certificados disponibles", date: caseData.caseDeadlines.certificatesAvailable, desc: "Ultimas voluntades + seguros (15 dias habiles)" },
                  { label: "Solicitud prorroga ISD", date: caseData.caseDeadlines.isdExtensionRequestDeadline, desc: "Limite para solicitar prorroga del Modelo 650" },
                  { label: "Plazo ISD (Modelo 650)", date: caseData.caseDeadlines.isdDeadline, desc: "6 meses desde fallecimiento" },
                ].map((d) => {
                  const days = Math.ceil((new Date(d.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const expired = days <= 0;
                  const urgent = days > 0 && days <= 14;
                  return (
                    <div key={d.label} className={`p-3 rounded-lg border ${expired ? "bg-red-50 border-red-200" : urgent ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"}`}>
                      <p className="text-xs text-gray-500">{d.label}</p>
                      <p className={`text-lg font-bold ${expired ? "text-red-600" : urgent ? "text-orange-600" : "text-gray-900"}`}>
                        {new Date(d.date).toLocaleDateString("es-ES")}
                      </p>
                      <p className={`text-xs mt-1 ${expired ? "text-red-500 font-medium" : urgent ? "text-orange-500" : "text-gray-400"}`}>
                        {expired ? "VENCIDO" : `${days} dias restantes`}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{d.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-3">Notas internas</h3>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              rows={4}
              placeholder="Anota observaciones, instrucciones internas o recordatorios sobre este expediente..."
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={saveNotes}
                disabled={notesSaving || notesInput === (caseData?.notes || "")}
                className="px-4 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {notesSaving ? "Guardando..." : "Guardar notas"}
              </button>
              {notesInput !== (caseData?.notes || "") && (
                <span className="text-xs text-gray-400">Sin guardar</span>
              )}
            </div>
          </div>

          {/* AI Analysis card */}
          {analysis && (
            <div className="md:col-span-2 bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl text-white ${
                    analysis.status === "excellent" ? "bg-green-500" :
                    analysis.status === "good" ? "bg-blue-500" :
                    analysis.status === "warning" ? "bg-orange-500" : "bg-red-500"
                  }`}>
                    {analysis.healthScore}
                  </div>
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      Analisis IA del expediente
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        analysis.status === "excellent" ? "bg-green-100 text-green-700" :
                        analysis.status === "good" ? "bg-blue-100 text-blue-700" :
                        analysis.status === "warning" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                      }`}>
                        {analysis.status === "excellent" ? "Excelente" :
                         analysis.status === "good" ? "Correcto" :
                         analysis.status === "warning" ? "Atencion" : "Critico"}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Generado {new Date(analysis.generatedAt).toLocaleString("es-ES")}
                      {analysis.model && analysis.model !== "stub" && analysis.model !== "heuristic" && (
                        <span className="ml-2 text-purple-600">· {analysis.model}</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAnalysisOpen(true)}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                >
                  Ver detalle →
                </button>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
              {(analysis.criticalIssues?.length > 0 || analysis.suggestedActions?.length > 0) && (
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  {analysis.criticalIssues?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Issues criticos</p>
                      <ul className="space-y-1 text-sm">
                        {analysis.criticalIssues.slice(0, 2).map((issue: any, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                              issue.severity === "high" ? "bg-red-500" : issue.severity === "medium" ? "bg-orange-500" : "bg-yellow-500"
                            }`} />
                            <span className="text-gray-700">{issue.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysis.suggestedActions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Siguientes acciones</p>
                      <ul className="space-y-1 text-sm">
                        {analysis.suggestedActions.slice(0, 2).map((action: any, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                              action.priority === "high" ? "bg-purple-600" : action.priority === "medium" ? "bg-blue-500" : "bg-gray-400"
                            }`} />
                            <span className="text-gray-700">{action.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pipeline visualization */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-4">Pipeline</h3>
            <div className="flex gap-1">
              {statuses.map((s) => (
                <div key={s} className={`flex-1 py-2 text-center text-xs rounded ${
                  s === caseData.status ? CASE_STATUS_COLORS[s] + " font-bold ring-2 ring-primary" : "bg-gray-50 text-gray-400"
                }`}>{s.replace(/_/g, " ")}</div>
              ))}
            </div>
          </div>

          {/* Consentimiento y legitimación */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Consentimiento y legitimacion RGPD
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Consent toggle */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Estado del consentimiento informado</p>
                <button
                  onClick={toggleConsent}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    caseData.consentAccepted
                      ? "border-green-400 bg-green-50 hover:bg-green-100"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors shrink-0 ${
                    caseData.consentAccepted ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"
                  }`}>
                    <div className="w-4 h-4 bg-white rounded-full shadow" />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${caseData.consentAccepted ? "text-green-800" : "text-gray-600"}`}>
                      {caseData.consentAccepted ? "Consentimiento aceptado" : "Sin consentimiento registrado"}
                    </p>
                    {caseData.consentAccepted && caseData.consentDate && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Registrado el {new Date(caseData.consentDate).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                      </p>
                    )}
                    {!caseData.consentAccepted && (
                      <p className="text-xs text-gray-400 mt-0.5">Haz clic para marcar como aceptado</p>
                    )}
                  </div>
                </button>
                {caseData.consentAccepted && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Cumple con el art. 13 del RGPD y la LOPDGDD
                  </div>
                )}
              </div>

              {/* Legitimation note */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Nota de legitimacion y base juridica</p>
                <textarea
                  value={legitimationInput}
                  onChange={(e) => setLegitimationInput(e.target.value)}
                  rows={4}
                  placeholder="Documenta la base juridica del tratamiento: relacion contractual, interes legitimo, obligacion legal... Indica tambien la fuente de los datos si no fue directamente del interesado."
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={saveLegitimation}
                    disabled={legitimationSaving || legitimationInput === (caseData.legitimationNote || "")}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {legitimationSaving ? "Guardando..." : "Guardar nota"}
                  </button>
                  {legitimationInput !== (caseData.legitimationNote || "") && (
                    <span className="text-xs text-gray-400">Sin guardar</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div>
          {caseData.tasks.length > 0 && (
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                Checklist generado por IA
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {smartTasksResult && (
                  <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
                    +{smartTasksResult.totalAdded} tareas añadidas
                  </span>
                )}
                <button
                  onClick={runSmartTasks}
                  disabled={smartTasksLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  title="Generar tareas adicionales según categorías del expediente"
                >
                  {smartTasksLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Generando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Tareas IA
                    </>
                  )}
                </button>
                {caseTemplates.length > 0 && (
                  <button
                    onClick={() => setApplyTplOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    Aplicar plantilla
                  </button>
                )}
              </div>
            </div>
          )}
          {(() => {
            return Object.entries(
              uniqueTasks.reduce((acc: Record<string, any[]>, t: any) => {
                (acc[t.category] = acc[t.category] || []).push(t);
                return acc;
              }, {})
            ).map(([cat, tasks]) => (
            <div key={cat} className="mb-6">
              <h3 className="font-semibold text-sm text-gray-500 mb-2">{cat}</h3>
              <div className="space-y-2">
                {(tasks as any[]).map((task: any) => (
                  <div key={task.id} className={`bg-white p-4 rounded-lg border ${
                    task.status === "BLOCKED" ? "border-l-4 border-l-red-400" :
                    task.status === "READY" ? "border-l-4 border-l-yellow-400" :
                    task.status === "DONE" ? "border-l-4 border-l-green-400" : ""
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {titleEditId === task.id ? (
                            <input
                              autoFocus
                              defaultValue={task.title}
                              className="font-medium text-sm border-b border-blue-400 bg-transparent focus:outline-none px-0.5"
                              onBlur={(e) => {
                                setTitleEditId(null);
                                if (e.target.value.trim() && e.target.value.trim() !== task.title) {
                                  updateTaskTitle(task.id, e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") { setTitleEditId(null); }
                              }}
                            />
                          ) : (
                            <p
                              className="font-medium cursor-text hover:text-blue-600"
                              title="Haz clic para editar el titulo"
                              onClick={() => setTitleEditId(task.id)}
                            >
                              {task.title}
                            </p>
                          )}
                          {task.documents && task.documents.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded" title={`${task.documents.length} doc(s) vinculado(s)`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                              {task.documents.length}
                            </span>
                          )}
                        </div>
                        {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
                        {task.assignee && (
                          <p className="text-xs text-blue-600 mt-1">
                            Asignado a: {task.assignee.name || task.assignee.email}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {task.status === "BLOCKED" && task.blockReason && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              {task.blockReason}
                            </span>
                          )}
                          {task.blockedUntil && task.status === "BLOCKED" && (
                            <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded">
                              Disponible: {new Date(task.blockedUntil).toLocaleDateString("es-ES")}
                            </span>
                          )}
                          {deadlineEditId === task.id ? (
                            <input
                              type="date"
                              autoFocus
                              defaultValue={(task.deadline ?? task.dueDate) ? new Date((task.deadline ?? task.dueDate)!).toISOString().slice(0, 10) : ""}
                              className="text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              onBlur={(e) => {
                                setDeadlineEditId(null);
                                // tasks with no system deadline use dueDate; ISD tasks update deadline
                                const val = e.target.value || null;
                                if (task.deadline !== null && task.deadline !== undefined) {
                                  updateTaskDeadline(task.id, val);
                                } else {
                                  fetch(`/api/cases/${caseId}/tasks`, {
                                    method: "PATCH", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ taskId: task.id, dueDate: val }),
                                  }).then(() => fetchCase());
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") { setDeadlineEditId(null); }
                              }}
                            />
                          ) : (task.deadline ?? task.dueDate) && task.status !== "DONE" && task.status !== "SKIPPED" ? (() => {
                            const effectiveDate = task.deadline ?? task.dueDate;
                            const days = Math.ceil((new Date(effectiveDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            const expired = days <= 0;
                            const urgent = days > 0 && days <= 14;
                            const isSystemDeadline = !!task.deadline;
                            return (
                              <button
                                onClick={() => setDeadlineEditId(task.id)}
                                title="Editar plazo"
                                className={`text-xs px-2 py-0.5 rounded cursor-pointer hover:ring-1 hover:ring-blue-300 ${expired ? "bg-red-100 text-red-700 font-medium" : urgent ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}
                              >
                                {expired ? "VENCIDO" : `${isSystemDeadline ? "Plazo" : "Vence"}: ${days}d`} - {new Date(effectiveDate!).toLocaleDateString("es-ES")}
                              </button>
                            );
                          })() : task.status !== "DONE" && task.status !== "SKIPPED" ? (
                            <button
                              onClick={() => setDeadlineEditId(task.id)}
                              title="Añadir plazo"
                              className="text-xs px-1.5 py-0.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                            >
                              <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </button>
                          ) : null}
                          {task.dependsOn && task.dependsOn.status !== "DONE" && task.dependsOn.status !== "SKIPPED" && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded" title={`Bloqueada hasta que se complete: ${task.dependsOn.title}`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                              Espera: {task.dependsOn.title.length > 28 ? task.dependsOn.title.slice(0, 28) + "…" : task.dependsOn.title}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <button
                          onClick={() => { toggleTaskNotes(task.id); setTaskNoteInput(""); }}
                          title="Notas de gestión"
                          className={`p-1.5 rounded transition relative ${taskNoteOpenId === task.id ? "text-amber-600 bg-amber-50" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          {task._count?.notes > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 text-[9px] bg-amber-500 text-white rounded-full flex items-center justify-center font-bold">{task._count.notes > 9 ? "9+" : task._count.notes}</span>
                          )}
                        </button>
                        <select
                          value={task.assigneeId || ""}
                          onChange={(e) => assignTask(task.id, e.target.value || null)}
                          className="text-xs px-2 py-1 border rounded max-w-[120px]"
                          title="Asignar a"
                        >
                          <option value="">Sin asignar</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>{m.name || m.email}</option>
                          ))}
                        </select>
                        <select
                          value={task.dependsOnId || ""}
                          onChange={(e) => setTaskDependency(task.id, e.target.value || null)}
                          className="text-xs px-2 py-1 border rounded max-w-[110px]"
                          title="Depende de"
                        >
                          <option value="">Sin dependencia</option>
                          {uniqueTasks.filter((t: any) => t.id !== task.id).map((t: any) => (
                            <option key={t.id} value={t.id}>{t.title.length > 22 ? t.title.slice(0, 22) + "…" : t.title}</option>
                          ))}
                        </select>
                        <select value={task.status} onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                          className="text-xs px-2 py-1 border rounded">
                          {taskStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span className={`text-xs px-2 py-1 rounded-full ${TASK_STATUS_COLORS[task.status] || ""}`}>
                          {task.status}
                        </span>
                        <button
                          onClick={() => deleteTask(task.id, task.title)}
                          title="Eliminar tarea"
                          className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    {/* Inline task notes panel */}
                    {taskNoteOpenId === task.id && (
                      <div className="mt-3 pt-3 border-t border-amber-100">
                        {taskNotesLoading && !taskNotesCache[task.id] ? (
                          <p className="text-xs text-gray-400 py-2">Cargando notas...</p>
                        ) : (
                          <>
                            {(taskNotesCache[task.id] ?? []).length === 0 ? (
                              <p className="text-xs text-gray-400 mb-2">Sin notas aún. Anota llamadas, respuestas, documentos pendientes...</p>
                            ) : (
                              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                                {(taskNotesCache[task.id] ?? []).map((note) => (
                                  <div key={note.id} className="flex gap-2 text-sm">
                                    <span className="text-xs text-gray-400 shrink-0 pt-0.5 w-24">
                                      {new Date(note.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    <div>
                                      <span className="text-xs font-medium text-gray-500">{note.user.name || note.user.email}: </span>
                                      <span className="text-gray-700 whitespace-pre-wrap">{note.content}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={taskNoteInput}
                                onChange={(e) => setTaskNoteInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTaskNote(task.id); } }}
                                placeholder="Escribe una nota y pulsa Enter..."
                                className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                              />
                              <button
                                onClick={() => saveTaskNote(task.id)}
                                disabled={taskNoteSaving || !taskNoteInput.trim()}
                                className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
                              >
                                Guardar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ));
          })()}
          {/* Add task form */}
          {addTaskOpen ? (
            <div className="bg-white p-4 rounded-lg border border-blue-200 space-y-3 mb-4">
              <h4 className="text-sm font-semibold text-gray-700">Nueva tarea</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <input
                    autoFocus
                    placeholder="Titulo de la tarea *"
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={addTaskForm.title}
                    onChange={(e) => setAddTaskForm((f) => ({ ...f, title: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") createTask(); if (e.key === "Escape") setAddTaskOpen(false); }}
                  />
                </div>
                <div>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={addTaskForm.category}
                    onChange={(e) => setAddTaskForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={addTaskForm.deadline}
                    onChange={(e) => setAddTaskForm((f) => ({ ...f, deadline: e.target.value }))}
                    placeholder="Fecha limite (opcional)"
                  />
                </div>
                <div>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={addTaskForm.assigneeId}
                    onChange={(e) => setAddTaskForm((f) => ({ ...f, assigneeId: e.target.value }))}
                  >
                    <option value="">Sin asignar</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name || m.email}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <textarea
                    rows={2}
                    placeholder="Descripcion (opcional)"
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                    value={addTaskForm.description}
                    onChange={(e) => setAddTaskForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createTask}
                  disabled={addTaskSaving || !addTaskForm.title.trim()}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {addTaskSaving ? "Guardando…" : "Crear tarea"}
                </button>
                <button onClick={() => setAddTaskOpen(false)} className="px-4 py-1.5 text-sm border rounded hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddTaskOpen(true)}
              className="w-full py-2 text-sm text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-gray-200 hover:border-blue-300 flex items-center justify-center gap-1.5 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Añadir tarea
            </button>
          )}
          {caseData.tasks.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-gray-400 mb-4">No hay tareas asignadas a este expediente.</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={runSmartTasks}
                  disabled={smartTasksLoading}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {smartTasksLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Generando tareas...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generar tareas con IA
                    </>
                  )}
                </button>
                <button
                  onClick={generateChecklist}
                  className="px-4 py-2 bg-purple-100 text-purple-700 text-sm font-medium rounded-md hover:bg-purple-200 inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Checklist autopilot
                </button>
                {caseTemplates.length > 0 && (
                  <button
                    onClick={() => setApplyTplOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    Aplicar plantilla
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "documents" && (
        <div>
          <div className="mb-4 flex items-center gap-4">
            <label className="inline-block px-4 py-2 bg-primary text-white rounded-md text-sm cursor-pointer hover:bg-primary/90">
              Subir documento
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
            <p className="text-xs text-gray-500">
              Los documentos se vinculan automaticamente a tareas por nombre de archivo
            </p>
          </div>
          {uploadHint && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    No se pudo vincular &quot;{uploadHint.fileName}&quot; a ninguna tarea
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Renombra el archivo incluyendo alguna de estas palabras clave y vuelve a subirlo:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {uploadHint.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">{s}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => setUploadHint(null)} className="text-xs text-amber-600 underline mt-2">Cerrar</button>
                </div>
              </div>
            </div>
          )}
          <div className="bg-white rounded-lg border divide-y">
            {caseData.documents.map((doc: any) => (
              <div key={doc.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-sm">{doc.fileName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-400">
                      {new Date(doc.createdAt).toLocaleString("es-ES")}
                      {doc.isPortalUpload && " (portal familia)"}
                    </p>
                    {doc.task && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
                        {doc.task.title}
                      </span>
                    )}
                    {!doc.task && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                        Sin vincular
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {doc.downloadUrl && (
                    <a href={doc.downloadUrl} target="_blank" rel="noreferrer"
                      className="text-sm text-primary hover:underline">Descargar</a>
                  )}
                  <button
                    onClick={() => deleteDocument(doc.id, doc.fileName)}
                    title="Eliminar documento"
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {caseData.documents.length === 0 && (
              <p className="px-6 py-8 text-center text-gray-400">No hay documentos</p>
            )}
          </div>
        </div>
      )}

      {tab === "bankpack" && (() => {
        // Build set of available docTags from linked documents and DONE tasks
        const availableTags = new Set<string>();
        caseData.documents.forEach((d: any) => {
          if (d.task?.category) {
            const linkedTask = caseData.tasks.find((t: any) => t.id === d.task.id);
            if (linkedTask?.docTag) availableTags.add(linkedTask.docTag);
          }
        });
        caseData.tasks.forEach((t: any) => {
          if (t.status === "DONE" && t.docTag) availableTags.add(t.docTag);
        });

        const { requirements: bankDocs, ready, total: totalRequired } = generateBankPack(availableTags);

        return (
          <div>
            <div className="bg-white p-6 rounded-lg border mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Paquete documental para banco</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Checklist estandar para procesar la sucesion en entidades bancarias espanolas
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{ready}/{totalRequired}</p>
                  <p className="text-xs text-gray-500">documentos listos</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <a
                  href={`/api/cases/${caseData.id}/bank-pack?format=pdf`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90"
                >
                  Descargar PDF unificado
                </a>
                <a
                  href={`/api/cases/${caseData.id}/bank-pack?format=zip`}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 text-sm rounded-md hover:bg-gray-50"
                >
                  Descargar ZIP (con originales)
                </a>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${totalRequired > 0 ? (ready / totalRequired) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="bg-white rounded-lg border divide-y">
              {bankDocs.map((doc, i) => {
                const isReady = doc.docTags.length > 0 && doc.docTags.some((t) => availableTags.has(t));
                return (
                  <div key={i} className="px-6 py-4 flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      isReady ? "bg-green-500 text-white" : doc.required ? "bg-gray-200 text-gray-400" : "bg-gray-100 text-gray-300"
                    }`}>
                      {isReady ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <span className="text-xs">{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{doc.name}</p>
                        {doc.required && <span className="text-xs text-red-600">*</span>}
                        {!doc.required && <span className="text-xs text-gray-400">(opcional)</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                      isReady ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {isReady ? "Listo" : "Pendiente"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              * Documentos obligatorios segun BdE y normativa sucesoria. Algunos bancos pueden solicitar documentacion adicional especifica.
            </p>
          </div>
        );
      })()}

      {tab === "templates" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            El autopiloto prepara acciones; el envio/ejecucion requiere aprobacion profesional.
          </p>
          {templates.map((tpl: any) => (
            <div key={tpl.id} className="bg-white p-4 rounded-lg border flex items-center justify-between">
              <div>
                <p className="font-medium">{tpl.name}</p>
                <p className="text-xs text-gray-400">{tpl.type} {tpl.category ? `- ${tpl.category}` : ""}</p>
              </div>
              <button onClick={() => generateDraft(tpl.id)}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200">
                Generar borrador
              </button>
            </div>
          ))}
          {/* Pending approvals */}
          {caseData.approvals.filter((a: any) => a.status === "PENDING").length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Aprobaciones pendientes</h3>
              {caseData.approvals.filter((a: any) => a.status === "PENDING").map((a: any) => (
                <div key={a.id} className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-2">
                  <p className="text-sm font-medium">{a.action}</p>
                  {a.details && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.details.substring(0, 300)}...</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleApproval(a.id, "APPROVED")}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm">Aprobar</button>
                    <button onClick={() => handleApproval(a.id, "REJECTED")}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm">Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "portal" && (
        <div className="space-y-6">
          {/* Portal link */}
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Portal de la familia</h3>
              <button
                onClick={togglePortalEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  caseData.portalEnabled ? "bg-green-500" : "bg-gray-300"
                }`}
                title={caseData.portalEnabled ? "Deshabilitar acceso al portal" : "Habilitar acceso al portal"}
                aria-label={caseData.portalEnabled ? "Portal activo" : "Portal desactivado"}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    caseData.portalEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {!caseData.portalEnabled && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                El acceso al portal está desactivado. La familia no puede ver este expediente.
              </div>
            )}
            <p className="text-sm text-gray-500 mb-3">
              Comparte este enlace con la familia. Pueden ver el estado, subir documentos y enviarte mensajes.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/portal/${caseData.portalToken}`}
                className="flex-1 px-3 py-2 border rounded-md text-sm bg-gray-50"
              />
              <button
                onClick={copyPortalLink}
                className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
              >
                Copiar
              </button>
              <a
                href={buildPortalMailto()}
                className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50 inline-flex items-center gap-1"
                title={caseData.contact?.email ? `Enviar a ${caseData.contact.email}` : "Abrir borrador de email"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </a>
              <a
                href={`/portal/${caseData.portalToken}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50 inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                Ver
              </a>
            </div>
          </div>

          {/* Messages */}
          <div className="bg-white rounded-lg border">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Mensajes con la familia</h3>
              {portalUnread > 0 && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                  {portalUnread} sin leer
                </span>
              )}
            </div>

            <div className="divide-y max-h-[28rem] overflow-y-auto">
              {portalMessages.length === 0 ? (
                <p className="px-6 py-10 text-center text-gray-400">
                  Sin mensajes aún. La familia puede escribirte desde el portal.
                </p>
              ) : (
                portalMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex p-4 ${msg.fromFamily ? "bg-blue-50/40" : ""}`}
                  >
                    <div className={`flex-1 ${msg.fromFamily ? "" : "pl-8"}`}>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={`text-xs font-semibold ${msg.fromFamily ? "text-blue-700" : "text-gray-700"}`}>
                          {msg.fromFamily ? (msg.authorName || "Familia") : "Tú (gestoría)"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {msg.fromFamily && !msg.readAt && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">Nuevo</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Cmd+Enter para enviar</span>
                <button
                  onClick={generatePortalReply}
                  disabled={portalAiLoading}
                  className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-100 disabled:opacity-50 inline-flex items-center gap-1.5"
                  title="Generar respuesta con IA basada en el contexto del expediente"
                >
                  {portalAiLoading ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  )}
                  {portalAiLoading ? "Generando..." : "Redactar con IA"}
                </button>
              </div>
              <textarea
                value={portalReply}
                onChange={(e) => setPortalReply(e.target.value)}
                rows={4}
                placeholder="Escribe un mensaje a la familia..."
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendPortalReply(); }}
              />
              <div className="flex justify-end">
                <button
                  onClick={sendPortalReply}
                  disabled={portalReplySending || !portalReply.trim()}
                  className="px-4 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {portalReplySending ? "Enviando..." : "Enviar a familia"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div>
          {/* Comment input */}
          <div className="bg-white rounded-lg border p-4 mb-6">
            <textarea
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              rows={2}
              placeholder="Escribe un comentario interno..."
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment(); }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">Cmd+Enter para enviar</span>
              <button
                onClick={postComment}
                disabled={commentSaving || !commentInput.trim()}
                className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {commentSaving ? "Enviando..." : "Comentar"}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
            {caseData.auditLogs.map((log: any) => {
              const isComment = log.action === "case.comment";
              const isCreate = log.action.includes("created");
              const isStatus = log.action.includes("status");
              const isTask = log.action.includes("task");
              const isDelete = log.action.includes("delete");
              const isAssign = log.action.includes("assign");
              const iconColor = isComment ? "bg-primary" : isCreate ? "bg-green-500" : isDelete ? "bg-red-500" : isStatus ? "bg-blue-500" : isTask ? "bg-purple-500" : isAssign ? "bg-cyan-500" : "bg-gray-400";
              const now = Date.now();
              const logTime = new Date(log.createdAt).getTime();
              const diffMin = Math.floor((now - logTime) / 60000);
              const relativeTime = diffMin < 1 ? "ahora" : diffMin < 60 ? `hace ${diffMin}m` : diffMin < 1440 ? `hace ${Math.floor(diffMin / 60)}h` : new Date(log.createdAt).toLocaleString("es-ES");
              const userName = log.user?.name || log.user?.email || "Sistema";

              if (isComment) {
                return (
                  <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                    <div className={`relative z-10 w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ml-[14px] ${iconColor}`} />
                    <div className="flex-1 min-w-0 bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">{userName}</span>
                        <span className="text-xs text-gray-400 shrink-0">{relativeTime}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{log.details}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className={`relative z-10 w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ml-[14px] ${iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm">
                        <span className="text-gray-500">{userName}</span>
                        <span className="mx-1.5 text-gray-300">·</span>
                        <span className="font-medium text-gray-900">{log.action.replace(/\./g, " · ")}</span>
                      </p>
                      <span className="text-xs text-gray-400 shrink-0">{relativeTime}</span>
                    </div>
                    {log.details && (
                      <p className="text-sm text-gray-500 mt-0.5">{log.details}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {caseData.auditLogs.length === 0 && (
            <p className="px-6 py-8 text-center text-gray-400">Sin actividad registrada</p>
          )}
        </div>
      )}

      {tab === "export" && (
        <div className="space-y-4">
          <CaseDocumentGenerator caseId={caseId} />
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-1">Resumen para la familia</h3>
            <p className="text-sm text-gray-500 mb-4">
              PDF en lenguaje sencillo para tener informada a la familia: qué se ha completado, en qué se trabaja y próximos pasos.
            </p>
            <a
              href={`/api/cases/${caseId}/family-summary`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Descargar resumen para la familia (PDF)
            </a>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-1">Borrador Modelo 650</h3>
            <p className="text-sm text-gray-500 mb-4">
              Genera un PDF de trabajo con los datos del expediente pre-rellenos — causante, heredero, plazos, bienes y cuota estimada.
              No sustituye al modelo oficial de la AEAT.
            </p>
            <a
              href={`/api/cases/${caseId}/modelo650`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar borrador Modelo 650 (PDF)
            </a>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-1">Dossier completo del expediente</h3>
            <p className="text-sm text-gray-500 mb-4">Resumen completo con todas las tareas y documentos del expediente.</p>
            <div className="flex gap-3 flex-wrap">
              <a href={`/api/cases/${caseId}/export`} target="_blank" rel="noreferrer"
                className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-700">
                Descargar dossier PDF
              </a>
              <a href={`/cases/${caseId}/print`} target="_blank" rel="noreferrer"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50">
                Vista para imprimir
              </a>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat drawer */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setChatOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-purple-600 to-blue-600">
              <div className="flex items-center gap-2 text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="font-semibold">Asistente IA del expediente</h3>
              </div>
              <div className="flex items-center gap-1">
                {chatHistory.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="text-white/70 hover:text-white text-xs px-2 py-1 rounded"
                    title="Borrar historial"
                  >
                    Borrar
                  </button>
                )}
                <button onClick={() => setChatOpen(false)} className="text-white/70 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {chatLoading ? (
                <p className="text-center text-gray-400 text-sm">Cargando historial...</p>
              ) : chatHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 mb-4">
                    Pregunta cualquier cosa sobre este expediente. La IA conoce los datos, tareas, documentos y plazos.
                  </p>
                  <div className="space-y-2 text-left">
                    {[
                      "¿Cuáles son los siguientes pasos prioritarios?",
                      "¿Qué documentos faltan para enviar al banco?",
                      "¿Cuándo vence el plazo del Modelo 650?",
                      "Resume el estado actual en 3 frases.",
                    ].map((sugg) => (
                      <button
                        key={sugg}
                        onClick={() => { setChatInput(sugg); }}
                        className="block w-full text-left px-3 py-2 text-sm bg-white border border-gray-200 rounded-md hover:border-purple-300 hover:bg-purple-50 text-gray-700"
                      >
                        {sugg}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                      msg.role === "user"
                        ? "bg-purple-600 text-white"
                        : "bg-white border border-gray-200 text-gray-800"
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {chatSending && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-lg bg-white border border-gray-200">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Pregunta lo que necesites..."
                  disabled={chatSending}
                  className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:bg-gray-100"
                />
                <button
                  onClick={sendChat}
                  disabled={chatSending || !chatInput.trim()}
                  className="px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Enter para enviar · La IA puede cometer errores, verifica datos críticos.</p>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {analysisOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-xl">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h2 className="text-lg font-semibold">Analisis IA del expediente</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runAnalysis}
                  disabled={analysisLoading}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium disabled:opacity-50"
                >
                  {analysisLoading ? "Regenerando..." : "Regenerar"}
                </button>
                <button onClick={() => setAnalysisOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {analysisLoading && !analysis ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mb-4" />
                  <p className="text-gray-500">Analizando expediente con IA...</p>
                  <p className="text-xs text-gray-400 mt-1">Esto puede tardar 5-15 segundos</p>
                </div>
              ) : analysis ? (
                <>
                  {/* Score & Summary */}
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl text-white shrink-0 ${
                      analysis.status === "excellent" ? "bg-green-500" :
                      analysis.status === "good" ? "bg-blue-500" :
                      analysis.status === "warning" ? "bg-orange-500" : "bg-red-500"
                    }`}>
                      {analysis.healthScore}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">Score de salud</p>
                      <p className="text-gray-800 leading-relaxed">{analysis.summary}</p>
                      {analysis.estimatedDaysToClose !== null && (
                        <p className="text-xs text-gray-500 mt-2">
                          Estimacion al cierre: <span className="font-semibold text-gray-700">{analysis.estimatedDaysToClose} dias</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Critical issues */}
                  {analysis.criticalIssues?.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Issues criticos
                      </h3>
                      <div className="space-y-2">
                        {analysis.criticalIssues.map((issue: any, i: number) => (
                          <div key={i} className={`p-3 rounded-lg border-l-4 ${
                            issue.severity === "high" ? "bg-red-50 border-red-500" :
                            issue.severity === "medium" ? "bg-orange-50 border-orange-500" : "bg-yellow-50 border-yellow-500"
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm">{issue.title}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                issue.severity === "high" ? "bg-red-200 text-red-800" :
                                issue.severity === "medium" ? "bg-orange-200 text-orange-800" : "bg-yellow-200 text-yellow-800"
                              }`}>
                                {issue.severity === "high" ? "alta" : issue.severity === "medium" ? "media" : "baja"}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{issue.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested actions */}
                  {analysis.suggestedActions?.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Acciones sugeridas
                      </h3>
                      <div className="space-y-2">
                        {analysis.suggestedActions.map((action: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                              <p className="font-medium text-sm">{action.title}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                action.priority === "high" ? "bg-purple-200 text-purple-800" :
                                action.priority === "medium" ? "bg-blue-200 text-blue-800" : "bg-gray-200 text-gray-700"
                              }`}>
                                {action.priority === "high" ? "alta" : action.priority === "medium" ? "media" : "baja"}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 ml-8">{action.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risks */}
                  {analysis.risks?.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Riesgos identificados
                      </h3>
                      <div className="space-y-2">
                        {analysis.risks.map((risk: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded uppercase tracking-wider">{risk.category}</span>
                            </div>
                            <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Riesgo:</span> {risk.description}</p>
                            <p className="text-sm text-green-700"><span className="font-medium">Mitigacion:</span> {risk.mitigation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 pt-3 border-t">
                    Generado el {new Date(analysis.generatedAt).toLocaleString("es-ES")}
                    {analysis.model && <> · Modelo: {analysis.model}</>}
                    <br />
                    Este analisis es una sugerencia automatica. Las decisiones legales y fiscales finales son responsabilidad del profesional.
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">Aun no se ha generado ningun analisis para este expediente.</p>
                  <button
                    onClick={runAnalysis}
                    className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
                  >
                    Generar primer analisis
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Progress Report Modal */}
      {progressReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold">Informe de progreso para la familia</h2>
                <p className="text-sm text-gray-500 mt-0.5">Carta de actualización lista para enviar</p>
              </div>
              <button onClick={() => setProgressReportOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {progressReportLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex items-center gap-3 text-gray-500">
                    <svg className="w-5 h-5 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generando informe...
                  </div>
                </div>
              ) : progressReportResult ? (
                <div className="space-y-5">
                  {progressReportResult.contactEmail && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
                      <svg className="w-4 h-4 text-teal-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Destinatario: <strong>{progressReportResult.contactName || "familia"}</strong>{progressReportResult.contactEmail ? ` — ${progressReportResult.contactEmail}` : ""}</span>
                    </div>
                  )}

                  {/* Summary badges */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-green-700">{progressReportResult.completedItems.length}</div>
                      <div className="text-xs text-green-600 mt-0.5">Trámites completados</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-blue-700">{progressReportResult.pendingItems.length}</div>
                      <div className="text-xs text-blue-600 mt-0.5">En curso / pendientes</div>
                    </div>
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-teal-700">{progressReportResult.nextSteps.length}</div>
                      <div className="text-xs text-teal-600 mt-0.5">Próximos pasos</div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Asunto</label>
                    <div className="w-full px-4 py-3 bg-gray-50 border rounded-lg text-sm font-medium">
                      {progressReportResult.subject}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Carta</label>
                    <textarea
                      value={progressReportResult.body}
                      onChange={(e) => setProgressReportResult({ ...progressReportResult, body: e.target.value })}
                      rows={14}
                      className="w-full px-4 py-3 bg-gray-50 border rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-teal-300"
                    />
                  </div>

                  {progressReportResult.nextSteps.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Próximos pasos incluidos</label>
                      <ul className="space-y-1">
                        {progressReportResult.nextSteps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-gray-700">{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-center max-w-sm">
                    Genera una carta de actualización profesional para la familia con el estado actual de todos los trámites.
                  </p>
                  <button
                    onClick={generateProgressReportFn}
                    className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700"
                  >
                    Generar informe
                  </button>
                </div>
              )}
            </div>

            {progressReportResult && !progressReportLoading && (
              <div className="flex items-center justify-between gap-3 p-6 border-t shrink-0">
                <button
                  onClick={generateProgressReportFn}
                  disabled={progressReportLoading}
                  className="px-4 py-2 text-sm border border-teal-300 text-teal-700 rounded-md hover:bg-teal-50 disabled:opacity-50"
                >
                  Regenerar
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setProgressReportOpen(false)} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
                    Cerrar
                  </button>
                  {progressReportResult.contactEmail && (
                    <a
                      href={`mailto:${progressReportResult.contactEmail}?subject=${encodeURIComponent(progressReportResult.subject)}&body=${encodeURIComponent(progressReportResult.body)}`}
                      className="px-4 py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 inline-flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Enviar por email
                    </a>
                  )}
                  <button
                    onClick={copyProgressReport}
                    className={`px-4 py-2 text-sm rounded-md inline-flex items-center gap-2 transition-colors ${
                      progressReportCopied ? "bg-green-500 text-white" : "bg-gray-800 text-white hover:bg-gray-700"
                    }`}
                  >
                    {progressReportCopied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Copiado
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        Copiar carta
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Request Modal */}
      {docRequestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold">Solicitud de documentacion al cliente</h2>
                <p className="text-sm text-gray-500 mt-0.5">Email listo para enviar o copiar</p>
              </div>
              <button onClick={() => setDocRequestOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {docRequestLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex items-center gap-3 text-gray-500">
                    <svg className="w-5 h-5 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generando solicitud con IA...
                  </div>
                </div>
              ) : docRequestResult ? (
                <div className="space-y-4">
                  {docRequestResult.contactEmail && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                      <span>Destinatario: <strong>{docRequestResult.contactName || "cliente"}</strong>{docRequestResult.contactEmail ? ` — ${docRequestResult.contactEmail}` : ""}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Asunto</label>
                    <div className="w-full px-4 py-3 bg-gray-50 border rounded-lg text-sm font-medium">
                      {docRequestResult.emailSubject}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Cuerpo del email</label>
                    <textarea
                      value={docRequestResult.emailBody}
                      onChange={(e) => setDocRequestResult({ ...docRequestResult, emailBody: e.target.value })}
                      rows={16}
                      className="w-full px-4 py-3 bg-gray-50 border rounded-lg text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>

                  {docRequestResult.documentList.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Documentos incluidos en la solicitud</label>
                      <div className="flex flex-wrap gap-1.5">
                        {docRequestResult.documentList.map((doc, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                            {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-center max-w-sm">
                    Genera automaticamente un email personalizado solicitando los documentos pendientes para este expediente.
                  </p>
                  <button
                    onClick={generateDocRequestEmail}
                    className="px-6 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600"
                  >
                    Generar solicitud
                  </button>
                </div>
              )}
            </div>

            {docRequestResult && !docRequestLoading && (
              <div className="flex items-center justify-between gap-3 p-6 border-t shrink-0">
                <button
                  onClick={generateDocRequestEmail}
                  disabled={docRequestLoading}
                  className="px-4 py-2 text-sm border border-amber-300 text-amber-700 rounded-md hover:bg-amber-50 disabled:opacity-50"
                >
                  Regenerar
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setDocRequestOpen(false)} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
                    Cerrar
                  </button>
                  {docRequestResult.contactEmail && (
                    <a
                      href={`mailto:${docRequestResult.contactEmail}?subject=${encodeURIComponent(docRequestResult.emailSubject)}&body=${encodeURIComponent(docRequestResult.emailBody)}`}
                      className="px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 inline-flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Abrir en email
                    </a>
                  )}
                  <button
                    onClick={copyDocRequest}
                    className={`px-4 py-2 text-sm rounded-md inline-flex items-center gap-2 transition-colors ${
                      docRequestCopied ? "bg-green-500 text-white" : "bg-gray-800 text-white hover:bg-gray-700"
                    }`}
                  >
                    {docRequestCopied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Copiado
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        Copiar email
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Closure Safeguard Modal */}
      {closureCheckOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center gap-3 px-6 py-4 border-b">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Cerrar expediente {pendingCloseStatus === "ARCHIVED" ? "(archivar)" : ""}
                </h2>
                <p className="text-xs text-gray-500">Revisión previa al cierre</p>
              </div>
            </div>

            <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {closureCheckLoading && (
                <p className="text-center text-gray-400 py-4">Verificando estado del expediente...</p>
              )}
              {!closureCheckLoading && closureCheckResult && (
                <>
                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Tareas completadas", value: `${closureCheckResult.stats.doneTasks}/${closureCheckResult.stats.totalTasks}`, ok: closureCheckResult.stats.pendingTasks === 0 },
                      { label: "Vencidas", value: String(closureCheckResult.stats.overdueTasks), ok: closureCheckResult.stats.overdueTasks === 0 },
                      { label: "ISD restante", value: closureCheckResult.stats.isdDaysRemaining !== null ? `${closureCheckResult.stats.isdDaysRemaining}d` : "—", ok: closureCheckResult.stats.isdDaysRemaining === null || closureCheckResult.stats.isdDaysRemaining <= 0 },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-lg p-3 text-center border ${s.ok ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                        <p className={`text-lg font-bold ${s.ok ? "text-green-700" : "text-amber-700"}`}>{s.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {closureCheckResult.warnings.length === 0 ? (
                    <div className="flex items-center gap-2 py-3 px-4 bg-green-50 rounded-lg border border-green-200">
                      <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-green-800 font-medium">Todo en orden. El expediente está listo para cerrar.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {closureCheckResult.warnings.map((w, i) => (
                        <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${
                          w.level === "error"
                            ? "bg-red-50 border-red-200"
                            : "bg-amber-50 border-amber-200"
                        }`}>
                          <svg className={`w-4 h-4 shrink-0 mt-0.5 ${w.level === "error" ? "text-red-600" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className={`text-sm ${w.level === "error" ? "text-red-800" : "text-amber-800"}`}>{w.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => { setClosureCheckOpen(false); setPendingCloseStatus(null); }}
                className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              {!closureCheckLoading && closureCheckResult && (
                <>
                  {closureCheckResult.warnings.some((w) => w.level === "error") ? (
                    <button
                      disabled
                      className="px-4 py-2 text-sm bg-gray-200 text-gray-500 rounded-md cursor-not-allowed"
                      title="Resuelva los errores antes de cerrar"
                    >
                      No se puede cerrar
                    </button>
                  ) : (
                    <button
                      onClick={confirmClose}
                      className={`px-4 py-2 text-sm text-white rounded-md ${
                        closureCheckResult.warnings.length > 0
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {closureCheckResult.warnings.length > 0 ? "Cerrar igualmente" : "Confirmar cierre"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Handoff Briefing Modal */}
      {handoffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-indigo-50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-semibold text-indigo-900">Briefing de traspaso</h2>
                {handoffResult && (
                  <p className="text-xs text-indigo-600 mt-0.5">
                    Generado {new Date(handoffResult.generatedAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {handoffResult.model !== "heuristic" && ` · ${handoffResult.model}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generateHandoffBriefingFn}
                  disabled={handoffLoading}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {handoffLoading ? "Generando..." : handoffResult ? "Regenerar" : "Generar"}
                </button>
                <button onClick={() => setHandoffOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {handoffLoading && !handoffResult && (
                <p className="text-center text-gray-400 py-8">Generando briefing...</p>
              )}
              {!handoffLoading && !handoffResult && (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No hay briefing generado todavía.</p>
                  <button onClick={generateHandoffBriefingFn} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">
                    Generar briefing
                  </button>
                </div>
              )}
              {handoffResult && (
                <>
                  {handoffResult.alerts?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1">
                      {handoffResult.alerts.map((a, i) => (
                        <p key={i} className="text-sm text-red-700 font-medium flex items-center gap-2">
                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          {a}
                        </p>
                      ))}
                    </div>
                  )}

                  {handoffResult.sections.map((s, i) => (
                    <div key={i} className="border rounded-lg overflow-hidden">
                      <div className="bg-indigo-50 px-4 py-2">
                        <h3 className="text-sm font-semibold text-indigo-800">{s.heading}</h3>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.content}</p>
                      </div>
                    </div>
                  ))}

                  {handoffResult.openItems?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Pendientes</h3>
                      <div className="space-y-2">
                        {handoffResult.openItems.map((item, i) => (
                          <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${
                            item.priority === "high" ? "border-red-200 bg-red-50" :
                            item.priority === "medium" ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
                          }`}>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${
                              item.priority === "high" ? "bg-red-200 text-red-800" :
                              item.priority === "medium" ? "bg-amber-200 text-amber-800" : "bg-gray-200 text-gray-700"
                            }`}>
                              {item.priority === "high" ? "ALTA" : item.priority === "medium" ? "MEDIA" : "BAJA"}
                            </span>
                            <p className="text-sm text-gray-700">{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {handoffResult && (
              <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button
                  onClick={copyHandoff}
                  className="px-4 py-2 text-sm border rounded-md hover:bg-gray-100 flex items-center gap-1.5"
                >
                  {handoffCopied ? "✓ Copiado" : "Copiar texto"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apply Template Modal */}
      {applyTplOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Aplicar plantilla de tareas</h2>
              <button onClick={() => { setApplyTplOpen(false); setSelectedCaseTpl(""); }}
                className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-500 mb-4">Las tareas ya existentes en el expediente no se duplicarán.</p>
              {caseTemplates.map((tpl: any) => (
                <label key={tpl.id} className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedCaseTpl === tpl.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}>
                  <input
                    type="radio"
                    name="caseTemplate"
                    value={tpl.id}
                    checked={selectedCaseTpl === tpl.id}
                    onChange={() => setSelectedCaseTpl(tpl.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{tpl.name}</span>
                      {tpl.isDefault && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Por defecto</span>
                      )}
                      <span className="text-xs text-gray-400">{tpl.tasks?.length ?? 0} tareas</span>
                    </div>
                    {tpl.description && <p className="text-sm text-gray-500 mt-0.5">{tpl.description}</p>}
                    {tpl.categories?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {tpl.categories.map((c: string) => (
                          <span key={c} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => { setApplyTplOpen(false); setSelectedCaseTpl(""); }}
                className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={applyTemplate}
                disabled={!selectedCaseTpl || applyTplLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {applyTplLoading ? "Aplicando..." : "Aplicar plantilla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
