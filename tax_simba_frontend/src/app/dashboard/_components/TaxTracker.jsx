'use client';
import { useFetchTaxReturnData, useFetchTaxReturnDataById } from "@/hooks/fetchData";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import EmailModal from "./EmailModal";
import axios from "axios";
import { toast } from "react-hot-toast";
import { FaDownload } from "react-icons/fa";

const statusToLabelAndClass = (status) => {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "assigned":
      return { label: "Work in Progress", className: "wip" };
    case "preparation_started":
      return { label: "Preparation started", className: "wip" };
    case "draft_ready":
      return { label: "Work In Progress • Draft ready", className: "wip" };
    case "submitted":
    case "completed":
      return { label: "Final submission", className: "completed" };
    default:
      return { label: "Work in Progress", className: "wip" };
  }
};

// fallback steps if detail API not yet loaded (keeps your original feel)
const fallbackStepsFromStatus = (status) => {
  const order = ["assigned", "preparation_started", "draft_ready", "submitted"];
  const labels = {
    assigned: "Assigned",
    preparation_started: "Preparation started",
    draft_ready: "Draft ready",
    submitted: "Final submission",
  };
  const s = (status || "").toLowerCase();
  const currentIdx = Math.max(0, order.indexOf(s));
  return order.map((key, idx) => ({
    key,
    label: labels[key],
    completed: idx < currentIdx,
    current: idx === currentIdx,
    order: idx + 1,
  }));
};


const computePercentFromSteps = (steps) => {
  if (!steps || steps.length === 0) return 0;
  const currentIndex = steps.findIndex((st) => st.current);
  const pct = ((currentIndex) / steps.length) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

const TaxTracker = ({ setTrackUpdate }) => {
  const pathname = usePathname();
  const { data: sessionData, status } = useSession();

  const [showModal, setShowModal ] = useState(false);
  const [taxReturns, setTaxReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openIdx, setOpenIdx] = useState(null);
  const [emailIds, setEmailIds] = useState({
    accountantId : null,
    taxReturnId: null
  }); 
  const pendingReturns = ( taxReturns.length >0 && taxReturns?.filter(
    (file) => file?.taxReturn?.status !== 'completed'
  )) || [];
    
  // cache details by id so we can render progress per opened item
  const [detailsById, setDetailsById] = useState({});
  const access_token = sessionData?.accessToken;

  const handleTaxReturnData = async () => {
    const data = await useFetchTaxReturnData(access_token);
    if (data) setTaxReturns(data);
    setLoading(false);
  };

  const fetchDetailIfNeeded = async (id) => {
    if (!id) return null;
    if (detailsById[id]) return detailsById[id];
    const res = await useFetchTaxReturnDataById(access_token, id);
    setDetailsById((prev) => ({ ...prev, [id]: res }));
    if (typeof setTrackUpdate === "function") setTrackUpdate(res);
    return res;
  };

  const onToggle = async (idx, id) => {
    setOpenIdx((prev) => (prev === idx ? null : idx));
    if (openIdx !== idx) {
      await fetchDetailIfNeeded(id);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && access_token) {
      handleTaxReturnData();
    }
  }, [status, access_token]);

  const handleMailSend = async ({ subject, body, accountantId, taxReturnId, token }) => {
    if (!subject || !body || !accountantId || !taxReturnId) {
      console.error("All fields are required");
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}client/send-to-specific-accountant`,
        {
          subject,
          message: body,
          accountantId,
          taxReturnId,
          priority: "high"
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        toast.success("Email sent successfully");
        // optionally show a success toast
      } else {
        console.error("Failed to send email:", response.data.message);
        toast.error("Failed to send email");
      }
    } catch (err) {
      console.error("Error sending email:", err);
      toast.error("Failed to send email");
    } finally {
      setShowModal(false); // close modal after sending
    }
  };

  return (
    <>
      <div className="tracker">
        {pathname === "/dashboard" && (
          <>
            <div className="tracker_heading">
              <h2>Tax Tracker</h2>
              <p>You can view the status of your tax return file</p>
            </div>
            <div className="tax_rtn_reg">
              <p>
                <strong>Tax Return Year 2025-2026</strong>
              </p>
              <p>Reg. No. </p>
            </div>
          </>
        )}

        <div className="accordion texreturn_accordion" id="taxReturn">
          {loading && <p>Loading...</p>}

          {!loading && (!pendingReturns || pendingReturns.length === 0) && (
            <p>No tax returns found.</p>
          )}

          {!loading &&
            pendingReturns?.length > 0 &&
            pendingReturns.map((item, index) => {
              const id = item?.taxReturn?.id ?? index;
              const isOpen = openIdx === index;
              const regNo = item?.taxReturn?.taxReturnId || "—";
              const year = item?.taxReturn?.taxYear || "—";
              const status = (item?.taxReturn?.status || "")
              const detail = detailsById[id];
              const steps =
                    detail?.progressSteps?.length
                      ? detail.progressSteps.slice(1)
                      : fallbackStepsFromStatus(status);

              const totalSteps = detail?.totalSteps || steps.length;
              const progressPercent =
                typeof detail?.progressPercentage === "number"
                  ? detail.progressPercentage
                  : computePercentFromSteps(steps);
                  const currentStep = steps.find((step) => step.key === status);


              return (
                <div
                  className={`accordion-item ${isOpen ? "active" : ""}`}
                  key={id}
                >
                  {/* header toggles open/close */}
                  <h2
                    className="accordion-header"
                    onClick={() => onToggle(index, item?.taxReturn?.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <button
                      className={`accordion-button ${isOpen ? "" : "collapsed"}`}
                      type="button"
                      aria-expanded={isOpen}
                    >
                      <div className="acc_reg_left">
                        <div className="accordion_reg">
                          <h3>Reg. No. {regNo}</h3>
                          <p>Tax Return Year {year}</p>
                        </div>
                        <div className="wip">
                          {/* {status} */}
                          {currentStep?.label || "Work in Progress"}
                        </div>
                      </div>
                      <div className="chat" onClick={()=>{
                        setShowModal(true);
                        setEmailIds({
                          accountantId : item?.accountant?.id,
                          taxReturnId: item?.taxReturn?.id
                        })
                      }}>
                        <img src="/images/message.png" alt="chat" />
                      </div>
                    </button>
                  </h2>

                  <div className={`accordion-collapse ${isOpen ? "show" : "collapse"}`}>
                    <div className="accordion-body">
                      <div className="progress_holder">
                        <div className="total_progress">
                          {/* Progress Line */}
                          <div className="progress-line">
                            <div
                              className="progress-fill"
                              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                            />
                            <div className="steps-dots">
                              {steps.map((st, i) => {
                                const dotClass = st.completed
                                  ? "completed"
                                  : st.current
                                  ? "active"
                                  : "";
                                return <div key={st.key || i} className={`dot ${dotClass}`} />;
                              })}
                            </div>
                          </div>
                          {/* Step Boxes */}
                          <div className="step-boxes">
                            {steps.map((st, i) => {
                              const stateClass = st.completed
                                ? "completed"
                                : st.current
                                ? "active"
                                : "inactive";
                              const [line1, line2] = (st.label || "").split(" ");

                              return (
                                <div key={i} className={`step-box ${stateClass}`}>
                                  <div className="icon">
                                    <i className="fa-regular fa-user" />
                                  </div>
                                  <div>
                                    {st.label}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Upload notice (kept as-is, static copy) */}
                        <div className="upload_valid">
                          <p>
                            <span>
                              <i className="fa-solid fa-circle-info" />
                            </span>
                            Your address proof was rejected. Please upload a valid document.
                          </p>
                          <button className="border_btn upload_btn">
                            <input type="file" />
                            <span>
                              <img src="/images/upload.png" alt="upload" />
                            </span>
                            Upload Document
                          </button>
                        </div>

                        {/* Already uploaded (first 3) */}
                        <div className="already_uploads">
                          {(item?.allFiles || []).slice(0, 3).map((f) => (
                            <div className="after_upload" key={f.id}>
                              <div className="doc_dtls_prt">
                                <figure>
                                  <img src="/images/pdf.png" alt="doc" />
                                </figure>
                                <div className="doc_dtls">
                                  <h6>{f.filename}</h6>
                                  <span className="size_kb">
                                    {(f.fileSize / 1024).toFixed(1)} KB
                                  </span>
                                </div>
                              </div>
                              <div className="upload_cntrol">
                                <a
                                  className="upload_cntrls_btn"
                                  href={f.downloadUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <FaDownload size={16} className="text-secondary" />
                                </a>
                                <a className="upload_cntrls_btn" href="javascript:void(0)">
                                  <img src="/images/del.png" alt="delete" />
                                </a>
                              </div>
                            </div>
                          ))}

                          {(item?.allFiles || []).length === 0 && (
                            <p>No documents uploaded yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {pathname === "/dashboard" && (
          <div
            className="new_tax_return"
            style={{ backgroundImage: "url(/images/banner_small.png)" }}
          >
            <h2>
              New Tax Return Year 2025-2026{" "}
              <span>
                <Link href="/tax-return-form">Ready to start</Link>
              </span>
            </h2>
            <p>6 Apr 2025 - 5 Apr 2026</p>
            <p>Due on 31 Jan 2027</p>
            <button className="border_btn">Start Now</button>
          </div>
        )}
      </div>
      {/* Email Modal */}
      <EmailModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSend={handleMailSend}
        ids = {emailIds}
        token = {access_token}
      />
    </>
  );
};

export default TaxTracker;

