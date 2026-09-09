"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

const SECTIONS = [
    { num: "01", title: "Introduction", icon: "🏢", id: "sec-01" },
    { num: "02", title: "Our Service", icon: "☁️", id: "sec-02" },
    { num: "03", title: "Your Subscription", icon: "📅", id: "sec-03" },
    { num: "04", title: "Your Responsibilities", icon: "✅", id: "sec-04" },
    { num: "05", title: "Our Responsibilities", icon: "🛡️", id: "sec-05" },
    { num: "06", title: "Data Protection", icon: "🔒", id: "sec-06" },
    { num: "07", title: "Limitation of Liability", icon: "🔏", id: "sec-07" },
    { num: "08", title: "Updates to Services", icon: "📝", id: "sec-08" },
    { num: "09", title: "Acceptance", icon: "✍️", id: "sec-09" },
];

export default function EngagementLetterPage() {
    const { data: session, update: updateSession, status } = useSession();
    const router = useRouter();
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [activeSection, setActiveSection] = useState(0);

    // --- Modal State ---
    const [showTaxModal, setShowTaxModal] = useState(false);
    const [modalStep, setModalStep] = useState(1); // 1 to 10: Questions, 11: Success
    const [formData, setFormData] = useState({
        businessType: "",
        businessName: "",
        utr: "",
        govGatewayStatus: "",
        isRegisteredForMTD: "",
        currentAccountant: "",
        incomeSources: [],
        annualTurnover: "",
        recordKeepingMethod: "",
        accountantNotes: "",
        prevSubmittedMTDThisYear: "",
        submittedQuarters: [],
        whoSubmittedQuarters: "",
        hasOutstandingMTDSubmissions: "",
        reviewPreviousMTDSubmissions: "",
        firstQuarterToManage: "",
        hasGatewayCredentials: "",
        previousMTDSoftware: "",
        otherActiveIncomeSources: ""
    });
    const [files, setFiles] = useState({
        governmentId: null,
        utrConfirmation: null,
        previousTaxReturn: null,
        businessBankStatements: null,
        proofOfAddress: null
    });
    const [validated, setValidated] = useState(false);

    useEffect(() => {
        if (session?.user) {
            setFormData(prev => ({
                ...prev,
                name: session.user.name || session.user.firstName || "",
                surname: session.user.surname || session.user.lastName || "",
                address: session.user.address || ""
            }));
        }
    }, [session]);

    // Calculate max date for Date of Birth (must be at least 18 years old)
    const today = new Date();
    const maxDobDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString().split('T')[0];


    // ── Scroll → active nav item ─────────────────────────────────────────────
    useEffect(() => {
        const onScroll = () => {
            const scrollTop = window.scrollY || window.pageYOffset;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const pct = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0;
            setScrollProgress(pct);

            const mid = window.innerHeight * 0.4;
            let best = 0;
            SECTIONS.forEach((s, idx) => {
                const el = document.getElementById(s.id);
                if (!el) return;
                const top = el.getBoundingClientRect().top;
                if (top <= mid) best = idx;
            });
            setActiveSection(best);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const getPos = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if (e.touches) return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY,
        };
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const startDraw = useCallback((e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#37a267";

        const pos = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        setIsDrawing(true);
    }, []);

    const draw = useCallback((e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const pos = getPos(e, canvas);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        setHasSignature(true);
    }, [isDrawing]);

    const endDraw = useCallback(() => setIsDrawing(false), []);

    const clearSignature = () => {
        const canvas = canvasRef.current;
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const handleSubmitLetter = async () => {
        if (!accepted || !termsAccepted) return toast.error("Please accept the terms first.");
        if (!hasSignature) return toast.error("Please draw your signature.");
        const signature = canvasRef.current.toDataURL("image/png");
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/";
            await axios.post(
                `${apiUrl}client/accept-engagement-letter`,
                { signature, accepted: true },
                { headers: { Authorization: `Bearer ${session?.accessToken}` } }
            );
            await updateSession({ isEngagementLetterAccepted: true });

            // Check role for redirection or modal
            if (session?.user?.userRole === 'MTD') {
                setShowTaxModal(true);
                setLoading(false);
            } else {
                toast.success("Engagement letter signed! Welcome aboard 🎉");
                setTimeout(() => {
                    window.location.assign("/dashboard");
                }, 1000);
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || "Something went wrong.");
            setLoading(false);
        }
    };

    const handleTaxInfoSubmit = async () => {
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/";
            
            const submitData = new FormData();
            
            // Append all text fields
            Object.keys(formData).forEach(key => {
                if (key === 'incomeSources' || key === 'submittedQuarters') {
                    submitData.append(key, JSON.stringify(formData[key]));
                } else {
                    submitData.append(key, formData[key]);
                }
            });
            
            // Append files
            const typeMap = {
                governmentId: "Government ID",
                utrConfirmation: "UTR Confirmation Letter/Document",
                previousTaxReturn: "Previous Tax Return",
                businessBankStatements: "Business Bank Statements",
                proofOfAddress: "Proof of Address"
            };

            Object.keys(files).forEach(key => {
                if (files[key]) {
                    submitData.append('documents', files[key]);
                    submitData.append('documentTypes', typeMap[key]);
                }
            });

            await axios.post(
                `${apiUrl}client/submit-tax-info`,
                submitData,
                { 
                    headers: { 
                        Authorization: `Bearer ${session?.accessToken}`,
                        'Content-Type': 'multipart/form-data'
                    } 
                }
            );
            await updateSession({ isTaxInfoSubmitted: true });
            setModalStep(21);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to submit information.");
        } finally {
            setLoading(false);
        }
    };

    const getNextStep = (currentStep, data) => {
        if (currentStep === 6) {
            if (data.prevSubmittedMTDThisYear === 'Yes, some quarters have been submitted') return 7;
            if (data.prevSubmittedMTDThisYear === 'Yes, all required quarters have been submitted') return 8;
            return 9;
        }
        if (currentStep === 7) return 8;
        if (currentStep === 8) return 9;
        if (currentStep === 12) {
            if (data.prevSubmittedMTDThisYear === 'Yes, all required quarters have been submitted' || data.prevSubmittedMTDThisYear === 'Yes, some quarters have been submitted') return 13;
            return 14;
        }
        if (currentStep === 13) return 14;
        return currentStep + 1;
    };

    const getPrevStep = (currentStep, data) => {
        if (currentStep === 9) {
            if (data.prevSubmittedMTDThisYear === 'Yes, some quarters have been submitted' || data.prevSubmittedMTDThisYear === 'Yes, all required quarters have been submitted') return 8;
            return 6;
        }
        if (currentStep === 8) {
            if (data.prevSubmittedMTDThisYear === 'Yes, some quarters have been submitted') return 7;
            return 6;
        }
        if (currentStep === 14) {
            if (data.prevSubmittedMTDThisYear === 'Yes, all required quarters have been submitted' || data.prevSubmittedMTDThisYear === 'Yes, some quarters have been submitted') return 13;
            return 12;
        }
        return currentStep - 1;
    };

    const handleNextStep = () => {
        setValidated(true);

        if (modalStep === 1 && !formData.businessType) return toast.error("Please select a business type.");
        if (modalStep === 2 && !formData.businessName) return toast.error("Please enter your business name.");
        if (modalStep === 3) {
            const cleanedUtr = formData.utr.replace(/\s+/g, '');
            if (!/^\d{10}$/.test(cleanedUtr)) return toast.error("Please enter a valid 10-digit UTR.");
        }
        if (modalStep === 4 && !formData.govGatewayStatus) return toast.error("Please select an option.");
        if (modalStep === 5 && !formData.isRegisteredForMTD) return toast.error("Please select an option.");
        
        if (modalStep === 6 && !formData.prevSubmittedMTDThisYear) return toast.error("Please select an option.");
        if (modalStep === 7 && formData.submittedQuarters.length === 0) return toast.error("Please select at least one quarter.");
        if (modalStep === 8 && !formData.whoSubmittedQuarters) return toast.error("Please select an option.");
        if (modalStep === 9 && !formData.hasOutstandingMTDSubmissions) return toast.error("Please select an option.");
        if (modalStep === 10 && !formData.reviewPreviousMTDSubmissions) return toast.error("Please select an option.");
        if (modalStep === 11 && !formData.firstQuarterToManage) return toast.error("Please select an option.");
        if (modalStep === 12 && !formData.hasGatewayCredentials) return toast.error("Please select an option.");
        if (modalStep === 13 && !formData.previousMTDSoftware) return toast.error("Please select an option.");
        if (modalStep === 14 && !formData.otherActiveIncomeSources) return toast.error("Please select an option.");

        if (modalStep === 15 && !formData.currentAccountant) return toast.error("Please select an option.");
        if (modalStep === 16 && formData.incomeSources.length === 0) return toast.error("Please select at least one income source.");
        if (modalStep === 17 && !formData.annualTurnover) return toast.error("Please select your annual turnover.");
        if (modalStep === 18 && !formData.recordKeepingMethod) return toast.error("Please select a record keeping method.");
        if (modalStep === 19) {
            if (!files.governmentId) return toast.error("Government ID is required.");
            if (!files.utrConfirmation) return toast.error("UTR Confirmation is required.");
        }

        setValidated(false);
        setModalStep(prev => getNextStep(prev, formData));
    };
    
    const handlePrevStep = () => {
        if (modalStep > 1) {
            setModalStep(prev => getPrevStep(prev, formData));
            setValidated(false);
        }
    };

    const handleFileChange = (e, key) => {
        const file = e.target.files[0];
        if (file) {
            setFiles(prev => ({ ...prev, [key]: file }));
        }
    };

    const toggleIncomeSource = (source) => {
        setFormData(prev => {
            const current = [...prev.incomeSources];
            if (current.includes(source)) {
                return { ...prev, incomeSources: current.filter(s => s !== source) };
            } else {
                return { ...prev, incomeSources: [...current, source] };
            }
        });
    };

    const toggleSubmittedQuarter = (q) => {
        setFormData(prev => {
            const current = [...prev.submittedQuarters];
            if (current.includes(q)) {
                return { ...prev, submittedQuarters: current.filter(s => s !== q) };
            } else {
                return { ...prev, submittedQuarters: [...current, q] };
            }
        });
    };

    if (status === "loading") return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#06130f" }}>
            <div className="el-spinner" />
        </div>
    );

    return (
        <div className="el-page">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
                
                * { box-sizing: border-box; margin: 0; padding: 0; }
                
                .el-page {
                  font-family: 'Outfit', sans-serif;
                  background: #06130f;
                  min-height: 100vh;
                  color: #fff;
                  line-height: 1.6;
                  display: flex;
                  flex-direction: column;
                  overflow-x: hidden;
                }

                .el-page p, .el-page li {
                  color: rgba(255,255,255,0.65) !important;
                }

                .el-main-layout { display: flex; max-width: 1400px; margin: 0 auto; width: 100%; justify-content: center; }

                /* Sidebar */
                .el-sidebar { width: 280px; height: 100vh; position: sticky; top: 0; padding: 40px 20px; border-right: 1px solid rgba(255,255,255,0.03); display: none; }
                @media (min-width: 1280px) { .el-sidebar { display: block; } }

                .el-side-tag { font-size: 12px; font-weight: 800; color: #b3ed97; text-transform: uppercase; letter-spacing: 0px; margin-bottom: 20px; padding-left: 16px; opacity: 1; }
                .el-side-nav { display: flex; flex-direction: column; gap: 4px; }
                .el-side-item { padding: 12px 16px; border-radius: 12px; font-size: 14px; font-weight: 500; color: #fff; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 0px; }
                .el-side-item:hover { color: #000; background: #fff; }
                .el-side-item.active { background: #fff; color: #000; font-weight: 700; }
                .el-side-item .icon { font-size: 16px; width: 20px; text-align: center; color: #fff; }

                /* Content Area */
                .el-content { flex: 1; padding: 80px 40px 40px 0; max-width: 850px; }

                .el-doc-header { text-align: center; margin-bottom: 60px; }
                .el-doc-header h1 { font-size: clamp(32px, 5vw, 56px); font-weight: 900; margin-bottom: 12px; letter-spacing: -2px; line-height: 1.1; }
                .el-doc-header h1 span { color: #b3ed97; }
                .el-doc-header p { font-size: 16px; color: #fff !important; max-width: 600px; margin: 0 auto; }

                .el-progress-box { margin: 40px auto; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px; border-radius: 24px; background: #fff; border: 1px solid #fff; width: fit-content; min-width: 300px; }
                .el-progress-top-row { display: flex; align-items: center; gap: 15px; width: 100%; justify-content: center; }
                .el-progress-pct { font-size: 28px; font-weight: 900; color: var(--theme-color); line-height: 1; }
                .el-progress-label { font-size: 13px; font-weight: 800; color: #000; text-transform: uppercase; letter-spacing: 0; }
                .el-progress-track { width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; }
                .el-progress-fill { height: 100%; background: var(--theme-color); transition: 0.4s ease; box-shadow: 0 0 15px rgba(55, 162, 103, 0.3); }

                .el-info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 60px; }
                .el-info-card { background: #fff; border: 1px solid #fff; padding: 24px; border-radius: 20px; }
                .el-info-card label { display: block; font-size: 13px; font-weight: 800; color: #000; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0; }
                .el-info-card p { font-size: 15px; font-weight: 600; color: #000 !important; }

                .el-section { margin-bottom: 30px; scroll-margin-top: 40px; }
                .el-section-head { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
                .el-section-num { font-size: 12px; font-weight: 900; color: #fff; background: var(--theme-color); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; }
                .el-section-title { font-size: 20px; font-weight: 800; color: #fff; }

                .el-card { background: #fff; border: 1px solid #fff; border-radius: 24px; padding: 25px; }
                .el-card p { font-size: 15px; color: #000 !important; margin-bottom: 0px; }
                .el-card strong { color: #000; }
                .el-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
                .el-list li { position: relative; padding-left: 24px; color: #000 !important; font-size: 14px; }
                .el-list li::before { content: '→'; position: absolute; left: 0; color: #000; font-weight: 900; }

                .el-footer-gate { position: relative; padding: 40px 20px; background: none; z-index: 10; display: flex; justify-content: center; width: 100%; }
                .el-gate-glass { width: 100%; max-width: 1000px; background: #fff; backdrop-filter: blur(30px); border: 1px solid #fff; border-radius: 28px; padding: 24px; display: flex; align-items: flex-end; gap: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
                @media (max-width: 768px) { 
                    .el-gate-glass { flex-direction: column; align-items: stretch; gap: 20px; padding: 20px; }
                    .el-footer-gate { padding: 20px 20px 60px 20px; margin-top: 0; }
                    .el-content { padding: 40px 20px !important; }
                }
                
                .el-chk-col { flex: 1; }
                .el-chk-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; cursor: pointer; }
                .el-toggle { width: 44px; height: 24px; background: #b3ed97; border-radius: 50px; position: relative; transition: 0.3s; }
                .el-toggle::after { content: ''; position: absolute; left: 4px; top: 4px; width: 16px; height: 16px; background: #fff; border-radius: 50%; transition: 0.3s; }
            .el-toggle.on { background: var(--theme-color); }
                .el-toggle.on::after { left: calc(100% - 20px); }
                .el-chk-label { font-size: 13px; font-weight: 600; color: #000; }

                .el-sig-col { flex: 2; position: relative; }
                .el-sig-canvas-box { border-radius: 16px; background: #000; border: 1px solid rgba(255,255,255,0.06); height: 110px; width: 100%; position: relative; }
                .el-sig-canvas { width: 100%; height: 110px; display: block; cursor: crosshair; }
                .el-clear { position: absolute; right: 10px; bottom: 10px; font-size: 9px; font-weight: 800; color: #fff; border: 1px solid #fff; padding: 3px 8px; border-radius: 4px; cursor: pointer; text-transform: uppercase; }

                .el-submit-col { flex: 1; display: flex; flex-direction: column; gap: 10px; }
                .el-btn-main { background: #37a267; color: #fff; font-size: 14px; font-weight: 800; padding: 16px; border-radius: 14px; border: none; cursor: pointer; transition: 0.3s; }
                .el-btn-main:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(55, 162, 103, 0.3); }
                .el-btn-main:disabled { opacity: 0.4; cursor: not-allowed; }

                .el-spinner { width: 40px; height: 40px; border: 4px solid rgba(55, 162, 103, 0.1); border-top-color: #37a267; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* --- MODAL STYLES --- */
                .tx-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(12px);
                    display: flex; align-items: center; justify-content: center; z-index: 2000;
                    opacity: 0; animation: fadeIn 0.3s forwards;
                }
                @keyframes fadeIn { to { opacity: 1; } }

                .tx-modal {
                    background: #0b1e19; border: 1px solid rgba(55, 162, 103, 0.2);
                    width: 100%; max-width: 550px; border-radius: 32px; padding: 40px;
                    box-shadow: 0 40px 100px rgba(0,0,0,0.8); position: relative;
                }
                
                .tx-modal-step { display: flex; gap: 8px; margin-bottom: 24px; }
                .tx-step-dot { flex: 1; height: 4px; background: rgba(255,255,255,0.1); border-radius: 10px; }
                .tx-step-dot.active { background: var(--theme-color); box-shadow: 0 0 10px rgba(55, 162, 103, 0.5); }

                .tx-title { font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 8px; letter-spacing: -0.5px; }
                .tx-sub { font-size: 15px; color: #fff; margin-bottom: 32px; }

                .tx-form-group { margin-bottom: 20px; }
                .tx-label { display: block; font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px; }
                .tx-input {
                    width: 100%; background: #fff !important; border: 1px solid rgba(255,255,255,0.1);
                    padding: 14px 18px; border-radius: 12px; color: #000; font-size: 15px; outline: none;
                    transition: 0.2s;
                }
                .tx-input:focus { border-color: #37a267; background: #fff; }
                .tx-input.error { border-color: #ff4d4d; background: rgba(255, 77, 77, 0.05); }
                .tx-radio-label.error { border-color: #ff4d4d; background: rgba(255, 77, 77, 0.05); }
                .tx-label span { color: #ff4d4d; margin-left: 4px; }

                .tx-radio-group { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
                .tx-radio-label {
                    display: flex; align-items: center; gap: 14px; padding: 14px 20px;
                    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 14px; cursor: pointer; transition: 0.2s;
                }
                .tx-radio-label:hover { background: rgba(255,255,255,0.04); }
                .tx-radio-label.active { border-color: var(--theme-color); background: rgba(55, 162, 103, 0.05); }
                .tx-radio-circle { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.2); border-radius: 50%; position: relative; }
                .tx-radio-label.active .tx-radio-circle { border-color: var(--theme-color); }
                .tx-radio-label.active .tx-radio-circle::after { content: ''; position: absolute; inset: 3px; background: var(--theme-color); border-radius: 50%; }

                .tx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

                .tx-btn-next {
                    width: 100%; padding: 16px; background: var(--theme-color); color: #fff;
                    font-weight: 800; border: none; border-radius: 14px; cursor: pointer;
                    font-size: 15px; transition: 0.3s;
                }
                .tx-btn-next:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(55, 162, 103,0.3); }

                .tx-success-icon {
                    width: 80px; height: 80px; background: rgba(55, 162, 103, 0.1); border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; font-size: 40px; margin: 0 auto 24px;
                    color: #37a267;
                }
            `}</style>

            <div className="el-main-layout">
                <aside className="el-sidebar">
                    <div className="el-side-tag">Document Outline</div>
                    <nav className="el-side-nav">
                        {SECTIONS.map((s, idx) => (
                            <div key={s.id} className={`el-side-item ${activeSection === idx ? 'active' : ''}`} onClick={() => scrollToSection(s.id)}>
                                <span className="icon">{s.icon}</span> {s.title}
                            </div>
                        ))}
                    </nav>
                </aside>

                <main className="el-content">
                    <div className="el-doc-header">
                        <h1>TaxSimba <span>Subscription Agreement</span></h1>
                        <p>Welcome to TaxSimba. By subscribing to our platform, you agree to the following terms.</p>

                        <div className="el-progress-box">
                            <div className="el-progress-top-row">
                                <span className="el-progress-label">READING PROGRESS</span>
                                <span className="el-progress-pct">{scrollProgress}%</span>
                            </div>
                            <div className="el-progress-track">
                                <div className="el-progress-fill" style={{ width: `${scrollProgress}%` }} />
                            </div>
                        </div>

                        <div className="el-info-grid">
                            <div className="el-info-card">
                                <label>Client Signatory</label>
                                <p>{session?.user?.firstName} {session?.user?.lastName}</p>
                            </div>
                            <div className="el-info-card">
                                <label>Reference Date</label>
                                <p>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                        </div>
                    </div>

                    {SECTIONS.map((section, idx) => (
                        <section key={section.id} className="el-section" id={section.id}>
                            <div className="el-section-head">
                                <span className="el-section-num">{section.num}</span>
                                <h2 className="el-section-title">{section.title}</h2>
                            </div>
                            <div className="el-card">
                                {idx === 0 && (
                                    <>
                                        <p>Welcome to <strong>TaxSimba</strong>.</p>
                                        <p>By subscribing to our platform, you agree to the following terms.</p>
                                    </>
                                )}
                                {idx === 1 && (
                                    <>
                                        <p>TaxSimba provides access to a cloud-based platform designed to help individuals and businesses manage their tax compliance, Making Tax Digital (MTD) obligations, document management, and communication with assigned accounting professionals.</p>
                                        <p style={{ marginTop: 16 }}>Services available to you depend on your selected subscription plan.</p>
                                    </>
                                )}
                                {idx === 2 && (
                                    <>
                                        <p>Your subscription begins when your first payment is successfully processed.</p>
                                        <p>Your subscription renews automatically on a monthly basis unless cancelled.</p>
                                        <p style={{ marginTop: 16 }}>You may cancel your subscription at any time through your dashboard. Cancellation will take effect at the end of your current billing period.</p>
                                    </>
                                )}
                                {idx === 3 && (
                                    <>
                                        <p>You agree to:</p>
                                        <ul className="el-list">
                                            <li>Provide accurate and complete information.</li>
                                            <li>Upload documents and records requested by TaxSimba or your assigned accountant.</li>
                                            <li>Maintain access to any HMRC, Government Gateway, or other required accounts.</li>
                                            <li>Review information and submissions when requested.</li>
                                        </ul>
                                    </>
                                )}
                                {idx === 4 && (
                                    <>
                                        <p>We will:</p>
                                        <ul className="el-list">
                                            <li>Provide access to the TaxSimba platform and subscribed services.</li>
                                            <li>Maintain secure storage of your information.</li>
                                            <li>Provide accountant support included within your plan.</li>
                                            <li>Notify you of any information or documents required from you.</li>
                                        </ul>
                                    </>
                                )}
                                {idx === 5 && (
                                    <>
                                        <p>Your information is processed securely and in accordance with applicable data protection laws.</p>
                                        <p>We will never sell your personal data.</p>
                                        <p style={{ marginTop: 16 }}>Information may only be shared where required to deliver services, comply with legal obligations, or where you have provided authorisation.</p>
                                    </>
                                )}
                                {idx === 6 && (
                                    <>
                                        <p>TaxSimba relies on information provided by you. You remain responsible for ensuring information submitted to us is accurate and complete.</p>
                                        <p style={{ marginTop: 16 }}>To the maximum extent permitted by law, TaxSimba’s liability shall be limited to the subscription fees paid by you during the preceding 12 months.</p>
                                    </>
                                )}
                                {idx === 7 && (
                                    <p>We may improve, modify, or update our platform and services from time to time. Material changes affecting your subscription will be communicated to you.</p>
                                )}
                                {idx === 8 && (
                                    <>
                                        <p>By clicking “Agree & Continue”, you confirm that:</p>
                                        <ul className="el-list" style={{ marginTop: 12 }}>
                                            <li><span style={{ color: '#37a267', fontWeight: 900, marginRight: 8 }}>✓</span>You have read and understood this Agreement.</li>
                                            <li><span style={{ color: '#37a267', fontWeight: 900, marginRight: 8 }}>✓</span>You agree to TaxSimba’s Terms of Service and Privacy Policy.</li>
                                            <li><span style={{ color: '#37a267', fontWeight: 900, marginRight: 8 }}>✓</span>You authorise TaxSimba to provide services under your selected subscription plan.</li>
                                            <li><span style={{ color: '#37a267', fontWeight: 900, marginRight: 8 }}>✓</span>The information you provide will be accurate and complete.</li>
                                        </ul>
                                    </>
                                )}
                            </div>
                        </section>
                    ))}
                </main>
            </div>

            <div className="el-footer-gate">
                <div className="el-gate-glass">
                    <div className="el-chk-col">
                        <div className="el-chk-row" onClick={() => setAccepted(!accepted)}>
                            <div className={`el-toggle ${accepted ? 'on' : ''}`} />
                            <div className="el-chk-label">I agree to the TaxSimba Subscription Agreement</div>
                        </div>
                        <div className="el-chk-row" onClick={() => setTermsAccepted(!termsAccepted)}>
                            <div className={`el-toggle ${termsAccepted ? 'on' : ''}`} />
                            <div className="el-chk-label">I agree to the Terms of Service and Privacy Policy</div>
                        </div>
                    </div>

                    <div className="el-sig-col">
                        <div className="el-sig-canvas-box">
                            <canvas ref={canvasRef} width={1000} height={220} className="el-sig-canvas" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                            <div className="el-clear" onClick={clearSignature}>Clear</div>
                        </div>
                    </div>

                    <div className="el-submit-col">
                        <div style={{ fontSize: 12, color: '#000', textAlign: 'center', fontWeight: 600, paddingBottom: 8 }}>
                            No long-term contracts. Cancel anytime. Dedicated accountant support included. Secure HMRC compliant service.
                        </div>
                        <button className="el-btn-main" onClick={handleSubmitLetter} disabled={loading || !accepted || !termsAccepted || !hasSignature}>
                            {loading ? "PROCESSING..." : "AGREE & CONTINUE →"}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- TAX INFO MODAL (MTD ONLY) --- */}
            {showTaxModal && (
                <div className="tx-overlay">
                    <div className="tx-modal" style={{ maxWidth: 600 }}>
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#b3ed97', textTransform: 'uppercase', marginBottom: 12 }}>
                                {modalStep <= 20 ? `Progress: ${((modalStep - 1) / 20 * 100).toFixed(0)}% Complete` : ''}
                            </div>
                            <div className="tx-step-dot" style={{ background: 'rgba(255,255,255,0.1)', height: 4, width: '100%', marginBottom: 16 }}>
                                <div style={{ height: '100%', background: 'var(--theme-color)', width: `${modalStep <= 20 ? ((modalStep - 1) / 20 * 100) : 100}%`, transition: '0.3s', borderRadius: 4 }} />
                            </div>
                            {modalStep <= 20 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Question {modalStep} of 20</div>}
                        </div>

                        {modalStep === 1 && (
                            <div className="tx-fade-in">
                                <h2 className="tx-title" style={{ fontSize: 24 }}>Welcome to TaxSimba</h2>
                                <p className="tx-sub" style={{ marginBottom: 24 }}>Let’s get your business set up for Making Tax Digital. This should only take 2–3 minutes.</p>
                                
                                <label className="tx-label">What type of business do you operate? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Sole Trader', 'Landlord / Property Business', 'Partnership', 'Limited Company'].map(type => (
                                        <div key={type} className={`tx-radio-label ${formData.businessType === type ? 'active' : ''} ${validated && !formData.businessType ? 'error' : ''}`} onClick={() => setFormData({ ...formData, businessType: type })}>
                                            <div className="tx-radio-circle" /> {type}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                            </div>
                        )}

                        {modalStep === 2 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">What is your business name? <span>*</span></label>
                                <div className="tx-form-group">
                                    <input className={`tx-input ${validated && !formData.businessName ? 'error' : ''}`} value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} placeholder="Enter Business Name" />
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 3 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">What is your Unique Taxpayer Reference (UTR)? <span>*</span></label>
                                <div className="tx-form-group">
                                    <input className={`tx-input ${validated && !formData.utr ? 'error' : ''}`} value={formData.utr} onChange={(e) => setFormData({ ...formData, utr: e.target.value })} placeholder="Enter 10-digit UTR Number" maxLength={10} />
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 4 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">Do you have a Government Gateway account? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Yes', 'No', 'Not Sure'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.govGatewayStatus === val ? 'active' : ''} ${validated && !formData.govGatewayStatus ? 'error' : ''}`} onClick={() => setFormData({ ...formData, govGatewayStatus: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 5 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">Are you already registered for Making Tax Digital (MTD)? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Yes', 'No', 'Not Sure'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.isRegisteredForMTD === val ? 'active' : ''} ${validated && !formData.isRegisteredForMTD ? 'error' : ''}`} onClick={() => setFormData({ ...formData, isRegisteredForMTD: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 6 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">Have you previously submitted any MTD quarterly updates for this tax year? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Yes, all required quarters have been submitted', 'Yes, some quarters have been submitted', 'No, I have not submitted any quarterly updates', 'I’m not sure'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.prevSubmittedMTDThisYear === val ? 'active' : ''} ${validated && !formData.prevSubmittedMTDThisYear ? 'error' : ''}`} onClick={() => setFormData({ ...formData, prevSubmittedMTDThisYear: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 7 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">If some quarters have already been submitted, please select which ones: <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Q1 (6 April – 5 July)', 'Q2 (6 July – 5 October)', 'Q3 (6 October – 5 January)', 'Q4 (6 January – 5 April)'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.submittedQuarters.includes(val) ? 'active' : ''} ${validated && formData.submittedQuarters.length === 0 ? 'error' : ''}`} onClick={() => toggleSubmittedQuarter(val)}>
                                            <div className="tx-radio-circle" style={{ borderRadius: 4 }} /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 8 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">Who submitted these quarterly updates? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['I submitted them myself', 'My previous accountant submitted them', 'Another software provider submitted them', 'I’m not sure'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.whoSubmittedQuarters === val ? 'active' : ''} ${validated && !formData.whoSubmittedQuarters ? 'error' : ''}`} onClick={() => setFormData({ ...formData, whoSubmittedQuarters: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 9 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">Do you have any outstanding or overdue MTD quarterly submissions? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Yes', 'No', 'I’m not sure'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.hasOutstandingMTDSubmissions === val ? 'active' : ''} ${validated && !formData.hasOutstandingMTDSubmissions ? 'error' : ''}`} onClick={() => setFormData({ ...formData, hasOutstandingMTDSubmissions: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 10 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">Would you like us to review your previous MTD submissions and identify any missing quarters? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Yes', 'No'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.reviewPreviousMTDSubmissions === val ? 'active' : ''} ${validated && !formData.reviewPreviousMTDSubmissions ? 'error' : ''}`} onClick={() => setFormData({ ...formData, reviewPreviousMTDSubmissions: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 11 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">What is the first quarter you would like us to manage on your behalf? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Q1 (6 April – 5 July)', 'Q2 (6 July – 5 October)', 'Q3 (6 October – 5 January)', 'Q4 (6 January – 5 April)', 'I’m not sure / Need advice'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.firstQuarterToManage === val ? 'active' : ''} ${validated && !formData.firstQuarterToManage ? 'error' : ''}`} onClick={() => setFormData({ ...formData, firstQuarterToManage: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 12 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">Do you have your HMRC Government Gateway credentials available to share/link? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Yes', 'No', 'I’m not sure'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.hasGatewayCredentials === val ? 'active' : ''} ${validated && !formData.hasGatewayCredentials ? 'error' : ''}`} onClick={() => setFormData({ ...formData, hasGatewayCredentials: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 13 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">What software did you use for previous MTD submissions? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Xero', 'QuickBooks', 'FreeAgent', 'Spreadsheets / Bridging software', 'Other', 'Not sure'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.previousMTDSoftware === val ? 'active' : ''} ${validated && !formData.previousMTDSoftware ? 'error' : ''}`} onClick={() => setFormData({ ...formData, previousMTDSoftware: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 14 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">Do you have any other active income sources that might affect your MTD status? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Yes', 'No', 'I’m not sure'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.otherActiveIncomeSources === val ? 'active' : ''} ${validated && !formData.otherActiveIncomeSources ? 'error' : ''}`} onClick={() => setFormData({ ...formData, otherActiveIncomeSources: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 15 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">Who currently handles your accounting? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['I manage it myself', 'Another accountant', 'No accountant currently'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.currentAccountant === val ? 'active' : ''} ${validated && !formData.currentAccountant ? 'error' : ''}`} onClick={() => setFormData({ ...formData, currentAccountant: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 16 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">What are your sources of income? (Select all that apply) <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Self-Employment', 'Rental Income', 'Employment (PAYE)', 'Dividends', 'Other'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.incomeSources.includes(val) ? 'active' : ''} ${validated && formData.incomeSources.length === 0 ? 'error' : ''}`} onClick={() => toggleIncomeSource(val)}>
                                            <div className="tx-radio-circle" style={{ borderRadius: 4 }} /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 17 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">What is your estimated annual turnover/income? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Under £10,000', '£10,000 – £50,000', '£50,000 – £100,000', 'Over £100,000'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.annualTurnover === val ? 'active' : ''} ${validated && !formData.annualTurnover ? 'error' : ''}`} onClick={() => setFormData({ ...formData, annualTurnover: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 18 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">How do you currently keep your records? <span>*</span></label>
                                <div className="tx-radio-group">
                                    {['Accounting Software', 'Spreadsheet', 'Paper Records', 'Bank Statements Only', 'Not Sure'].map(val => (
                                        <div key={val} className={`tx-radio-label ${formData.recordKeepingMethod === val ? 'active' : ''} ${validated && !formData.recordKeepingMethod ? 'error' : ''}`} onClick={() => setFormData({ ...formData, recordKeepingMethod: val })}>
                                            <div className="tx-radio-circle" /> {val}
                                        </div>
                                    ))}
                                </div>
                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 19 && (
                            <div className="tx-fade-in">
                                <label className="tx-label" style={{ fontSize: 14 }}>Please upload the following documents:</label>
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>File types: JPG, PNG, PDF. Max size: 5MB.</p>
                                
                                <div className="tx-form-group" style={{ marginBottom: 16 }}>
                                    <label className="tx-label">Government ID (Passport/Driving License) <span style={{color: '#ff4d4d'}}>*</span></label>
                                    <input type="file" className="tx-input" onChange={(e) => handleFileChange(e, 'governmentId')} accept=".pdf,.jpg,.jpeg,.png" style={{ background: '#fff', color: '#000', padding: '10px' }} />
                                    {files.governmentId && <div style={{ fontSize: 11, color: '#b3ed97', marginTop: 4 }}>✓ {files.governmentId.name}</div>}
                                </div>
                                <div className="tx-form-group" style={{ marginBottom: 16 }}>
                                    <label className="tx-label">UTR Confirmation Letter/Document <span style={{color: '#ff4d4d'}}>*</span></label>
                                    <input type="file" className="tx-input" onChange={(e) => handleFileChange(e, 'utrConfirmation')} accept=".pdf,.jpg,.jpeg,.png" style={{ background: '#fff', color: '#000', padding: '10px' }} />
                                    {files.utrConfirmation && <div style={{ fontSize: 11, color: '#b3ed97', marginTop: 4 }}>✓ {files.utrConfirmation.name}</div>}
                                </div>
                                <div className="tx-form-group" style={{ marginBottom: 16 }}>
                                    <label className="tx-label">Previous Tax Return (Optional)</label>
                                    <input type="file" className="tx-input" onChange={(e) => handleFileChange(e, 'previousTaxReturn')} accept=".pdf,.jpg,.jpeg,.png" style={{ background: '#fff', color: '#000', padding: '10px' }} />
                                    {files.previousTaxReturn && <div style={{ fontSize: 11, color: '#b3ed97', marginTop: 4 }}>✓ {files.previousTaxReturn.name}</div>}
                                </div>
                                <div className="tx-form-group" style={{ marginBottom: 16 }}>
                                    <label className="tx-label">Business Bank Statements (Optional)</label>
                                    <input type="file" className="tx-input" onChange={(e) => handleFileChange(e, 'businessBankStatements')} accept=".pdf,.jpg,.jpeg,.png" style={{ background: '#fff', color: '#000', padding: '10px' }} />
                                    {files.businessBankStatements && <div style={{ fontSize: 11, color: '#b3ed97', marginTop: 4 }}>✓ {files.businessBankStatements.name}</div>}
                                </div>
                                <div className="tx-form-group" style={{ marginBottom: 24 }}>
                                    <label className="tx-label">Proof of Address (Optional)</label>
                                    <input type="file" className="tx-input" onChange={(e) => handleFileChange(e, 'proofOfAddress')} accept=".pdf,.jpg,.jpeg,.png" style={{ background: '#fff', color: '#000', padding: '10px' }} />
                                    {files.proofOfAddress && <div style={{ fontSize: 11, color: '#b3ed97', marginTop: 4 }}>✓ {files.proofOfAddress.name}</div>}
                                </div>

                                <button className="tx-btn-next" onClick={handleNextStep}>Continue</button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 20 && (
                            <div className="tx-fade-in">
                                <label className="tx-label">Is there anything else your accountant should know? (Optional)</label>
                                <div className="tx-form-group">
                                    <textarea 
                                        className="tx-input" 
                                        value={formData.accountantNotes} 
                                        onChange={(e) => setFormData({ ...formData, accountantNotes: e.target.value })} 
                                        placeholder="Add any additional notes here..." 
                                        rows={4}
                                        style={{ resize: 'none' }}
                                    />
                                </div>
                                <button className="tx-btn-next" onClick={handleTaxInfoSubmit} disabled={loading}>
                                    {loading ? "SUBMITTING..." : "Complete Setup"}
                                </button>
                                <button style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: '#fff', marginTop: 8, cursor: 'pointer', fontSize: 13 }} onClick={handlePrevStep} disabled={loading}>← Go Back</button>
                            </div>
                        )}

                        {modalStep === 21 && (
                            <div className="tx-fade-in" style={{ textAlign: 'center' }}>
                                <div className="tx-success-icon">✓</div>
                                <h2 className="tx-title" style={{ fontSize: 24 }}>Thank you!</h2>
                                <p className="tx-sub" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>
                                    Your information has been successfully submitted.<br/><br/>
                                    Our team is reviewing your details and will activate your Making Tax Digital dashboard shortly.
                                </p>
                                <button className="tx-btn-next" style={{ marginTop: 20 }} onClick={() => window.location.assign("/mtd-dashboard")}>Go to Dashboard →</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
