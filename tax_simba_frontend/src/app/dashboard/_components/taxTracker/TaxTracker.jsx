'use client';
import { useFetchTaxReturnData, useFetchTaxReturnDataById } from "@/hooks/fetchData";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { IoDocumentAttachSharp } from "react-icons/io5";
import { handleDownload } from "@/app/lib/downloadFiles";
import UploadDocuments from "./UploadDocuments";
import DraftFeedback from "./DraftFeedback";
import ChatBox from "./ChatBox";
import axios from "axios";
import { CheckCircle, Clock, FileText, User } from "lucide-react";
// P0: Stripe Checkout only — Elements PaymentModal removed from tracker.
import { getFileIcon } from "@/utils/commonHelper";
import { FaCheck, FaClock } from "react-icons/fa";

// Helper to compute UK tax year for filing (April 6 - April 5 of previous year)
const getUKTaxYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // months are 0-indexed
  // Tax return is filed for the previous tax year
  return month >= 4 ? `${year - 1}-${year}` : `${year - 2}-${year - 1}`;
};
const statusToLabelAndClass = (status) => {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "pending_payment":
      return { label: "To be assigned", className: "wip", icon: <FaClock /> };
    case "assigned":
      return { label: "Work in Progress", className: "wip" };
    case "preparation_started":
      return { label: "Preparation started", className: "wip active" };
    case "draft_ready":
      return { label: "Work In Progress • Draft ready", className: "wip active" };
    case "submitted":
      return { label: "Final submission", className: "completed active" };
    case "completed":
      return { label: "Completed", className: "completed" };
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

const TaxTracker = ({ serverSession, setIsDocUpdated, setTrackUpdate, taxPrice, setIsRefresh, isRefresh, fromYear, toYear }) => {
  console.log("TaxTracker serverSession", serverSession?.accessToken);
  const pathname = usePathname();
  const { data: sessionData, status } = useSession();
  const [taxReturns, setTaxReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openIdx, setOpenIdx] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [emailIds, setEmailIds] = useState({
    accountantId: null,
    taxReturnId: null
  });
  const [messages, setMessages] = useState([]);
  const pendingReturns = (taxReturns.length > 0 && taxReturns?.filter(
    (file) => {
      const isPending = file?.taxReturn?.status !== 'completed';
      if (!isPending) return false;

      if (fromYear && toYear) {
        const year = parseInt(file?.taxReturn?.taxYear);
        return year >= parseInt(fromYear) && year <= parseInt(toYear);
      }
      return true;
    }
  )) || [];
  // for files display inside each item

  console.log("pendingReturns", pendingReturns);
  const [showAllMap, setShowAllMap] = useState({});

  // cache details by id so we can render progress per opened item
  const [detailsById, setDetailsById] = useState({});
  const access_token = sessionData?.accessToken;

  const handleTaxReturnData = async () => {
    setLoading(true);
    const data = await useFetchTaxReturnData(access_token);
    const realData = (data && data.length > 0) ? data : [];
    setTaxReturns(realData);
    setLoading(false);
  };

  const fetchDetailIfNeeded = async (id) => {
    if (!id) return null;
    if (detailsById[id]) return detailsById[id];
    try {
      const res = await useFetchTaxReturnDataById(access_token, id);
      if (res && res.progressSteps) {
        setDetailsById((prev) => ({ ...prev, [id]: res }));
        if (typeof setTrackUpdate === "function") setTrackUpdate(res);
        return res;
      }
    } catch (err) {
      console.error("Error fetching detail:", err);
    }
    return null;
  };

  // const onToggle = async (idx, id) => {
  //   setOpenIdx((prev) => (prev === idx ? null : idx));
  //   if (openIdx !== idx) {
  //     await fetchDetailIfNeeded(id);
  //   }
  // };

  const onToggle = async (idx, id, item) => {
    setOpenIdx((prev) => (prev === idx ? null : idx));

    if (openIdx !== idx) {
      // Fetch the tax return details if they are not already loaded
      await fetchDetailIfNeeded(id);

      // Set emailIds only when the tax return is opened
      const accountantId = item?.accountant?.id;
      const taxReturnId = item?.taxReturn?.id;
      setEmailIds({
        accountantId: accountantId,
        taxReturnId: taxReturnId,
      });
    }
  };



  const fetchMessages = async () => {
    if (!emailIds?.taxReturnId) {
      return; // Don't proceed until the taxReturnId is set
    }

    setLoading(true);

    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}client/communication-log/${emailIds?.taxReturnId}`,
        { page: 1, limit: 1000 },
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
        }
      );


      if (res.data.success) {
        setMessages(res.data.data.emails || []);
      } else {
        console.error('Failed to fetch chat data:', res.data.message);
      }

      const emails = res.data?.data?.emails || [];
      const formatted = emails.map((email) => ({
        id: email.id,
        sender: email.accountant?.name || "Accountant",
        message: email.parsedEmailData?.messageText || "",
        time: email.sentAt,
      }));

      setMessages(formatted.reverse()); // Reverse to show most recent messages first
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false); // Turn off loading state
    }
  };

  useEffect(() => {
    // Only fetch messages if taxReturnId is available
    if (emailIds?.taxReturnId) {
      // fetchMessages();
    }
  }, [emailIds?.taxReturnId]);

  useEffect(() => {
    if (status === "authenticated" && access_token) {
      handleTaxReturnData();
    } else if (status === "unauthenticated" || status === "loading") {
      setTaxReturns([]);
      setLoading(false);
    }
  }, [status, access_token]);

  const handlePayment = (_data) => {
    // P0: Elements checkout removed — purchases go through /planlist Stripe Checkout.
    toast.error("Please complete purchase from Plans (Stripe Checkout).");
  };


  const toggleShowAll = (id) => {
    setShowAllMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStepIcon = (stepKey) => {
    const icons = {
      "assigned": User,
      "preparation_started": Clock,
      "draft_ready": FileText,
      "submitted": FileText,
      "completed": CheckCircle
    }
    return icons[stepKey] || CheckCircle;
  };

  return (
    <>
      <div className="tracker">
        {(pathname === "/dashboard" || pathname === "/dashboard/tax-tracker") && (
          <>
            <div className="tracker_heading">
              <h2>Tax Tracker</h2>
              <p>You can view the status of your tax return file</p>
            </div>
            <div className="tax_rtn_reg">
              <p>
                <strong>Tax Return Year {getUKTaxYear()}</strong>
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
              // const id = item?.taxReturn?.id ?? index;
              const id = item?.taxReturn?.id;
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


              // get files to display based on showAll state
              const showAll = showAllMap[id] || false;
              const files = item?.files?.allFiles || [];
              const filesToDisplay = showAll ? files : files.slice(0, 5);
              const requiredDocs = item?.files?.allFiles?.filter(f => f.uploadStatus != "completed") || [];
              const statusInfo = statusToLabelAndClass(status);

              return (
                <div
                  className={`accordion-item ${isOpen ? "active" : ""}`}
                  key={id}
                >
                  {/* header toggles open/close */}
                  <h2
                    className="accordion-header"
                    onClick={() => onToggle(index, item?.taxReturn?.id, item)}
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

                        </div>


                        {item?.taxReturn?.status == "pending_payment" ? (
                          <div
                            className={statusInfo.className}
                            style={{ cursor: "pointer" }}
                            title="To be assigned"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggle(index, item?.taxReturn?.id, item);
                            }}
                          >
                            {statusInfo.icon}
                            {" "}
                            {statusInfo.label}
                          </div>
                        ) : (
                          <div
                            className={statusInfo.className}
                            style={{ cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggle(index, item?.taxReturn?.id, item);
                            }}
                          >
                            {currentStep?.label || statusInfo.label}
                          </div>
                        )}
                      </div>
                      <div className="chat"
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmailIds({
                            accountantId: item?.accountant?.id,
                            taxReturnId: item?.taxReturn?.id
                          })
                          setShowChat(true);
                        }}>
                        <img src="/images/message.png" alt="chat" />
                      </div>
                    </button>
                  </h2>

                  <div className={`accordion-collapse ${isOpen ? "show" : "collapse"}`}>
                    <div className="accordion-body">
                      <div className="progress_holder">
                        <div className="total_progress">

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
                                return <div key={st.key || i} className={`dot ${dotClass}`} > {(st.completed || st.current) && <FaCheck className="text-white" size={10} />} </div>;
                              })}
                            </div>
                          </div>

                          <div className="step-boxes">
                            {steps.map((st, i) => {
                              const stateClass = st.completed
                                ? "completed"
                                : st.current
                                  ? "active"
                                  : "inactive";
                              const [line1, line2] = (st.label || "").split(" ");
                              const StepIcon = getStepIcon(st.key);

                              return (
                                <div key={i} className={`step-box ${stateClass}`}>
                                  {
                                    st.label.toLowerCase() == "draft ready" ?
                                      <DraftFeedback state={stateClass} item={item} />
                                      :
                                      <>
                                        <div className="icon">
                                          <StepIcon className='lucid_icon' />
                                        </div>
                                        <div>
                                          {st.label}
                                        </div>
                                      </>
                                  }
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {
                          requiredDocs.length > 0 && (
                            <UploadDocuments requiredDocs={requiredDocs} item={item} ids={emailIds} setTaxReturns={setTaxReturns} setIsDocUpdated={setIsDocUpdated} />
                          )
                        }


                        <div className="mt-4">
                          <div className="row g-2 align-items-center">
                            {filesToDisplay.length === 0 ? (
                              <div className="col-12">
                                <p className="text-muted text-center">No documents uploaded yet.</p>
                              </div>
                            ) : (
                              <>
                                {filesToDisplay.map((file, idx) => (
                                  <div key={idx} className="col-6 col-sm-4 col-md-3 col-lg-2 col-xl-2">
                                    <div
                                      className="card h-100 shadow-sm border-0 hover-shadow small-card"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => handleDownload(file.downloadUrl, file.filename)}
                                    >
                                      <img
                                        src={getFileIcon(file)}
                                        className="card-img-top"
                                        alt={file.filename}
                                        style={{ height: "100px", objectFit: "cover" }}
                                      />
                                      <div className="card-body p-2 d-flex flex-column justify-content-between">
                                        <div className="d-flex align-items-center mb-1">
                                          <span
                                            className="fw-semibold text-truncate"
                                            title={file.filename}
                                            style={{ maxWidth: "80px", fontSize: "0.9rem" }}
                                          >
                                            {file.filename}
                                          </span>
                                        </div>
                                        <small className="text-muted" style={{ fontSize: "0.8rem" }}>
                                          {(file.fileSize / 1024).toFixed(1)} KB
                                        </small>
                                      </div>
                                    </div>
                                  </div>
                                ))}


                                {files.length > 5 && (
                                  <div className="col-6 col-sm-4 col-md-3 col-lg-2 col-xl-2 d-flex align-items-center justify-content-center">
                                    <button
                                      className="show-all-button  d-flex align-items-center justify-content-center py-4"
                                      style={{ fontSize: "18px" }}
                                      onClick={() => toggleShowAll(id)}
                                    >
                                      {showAll ? (
                                        <>
                                          <i className="fa-solid fa-chevron-left me-1"></i> Show Less
                                        </>
                                      ) : (
                                        <>
                                          Show More <i className="fa-solid fa-chevron-right ms-1"></i>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}


                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {(pathname === "/dashboard" || pathname === "/dashboard/tax-tracker") && (
          <div
            className="new_tax_return"
            style={{ backgroundImage: "url('/images/cta-bg.png')" }}
          >
            <h2>
              New Tax Return Year {getUKTaxYear()}{" "}
              <span>
                <Link href="/tax-return-form">Ready to start</Link>
              </span>
            </h2>
            <p>{`6 Apr ${parseInt(getUKTaxYear().split('-')[0])} - 5 Apr ${parseInt(getUKTaxYear().split('-')[1])}`}</p>
            <p>Due on 31 Jan {parseInt(getUKTaxYear().split('-')[1]) + 1}</p>
            <Link className="border_btn" href="/tax-return-form">Start Now </Link>
          </div>
        )}
      </div>
      {/* Chat Box */}
      <ChatBox show={showChat} handleClose={() => setShowChat(false)} ids={emailIds} token={serverSession?.accessToken} id={sessionData?.user?.id} />
    </>
  );
};

export default TaxTracker;
