import { useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";
import { FaPhone, FaEnvelope } from "react-icons/fa";
import { Col, Row } from "react-bootstrap";
import { FaPencil } from "react-icons/fa6";
import Form from 'react-bootstrap/Form';
import { getCurrencySymbol } from "@/utils/commonHelper";
import Link from "next/link";

const EditProfile = ({ userData, sessionData, setTrackUpdate }) => {
  const initialFormState = {
    name: "",
    surname: "",
    location: "",
    error: {
      name: "",
      surname: "",
      location: "",
    },
    dob: "",
    nino: "",
    utr: "",
    hasGovGateway: null,
    bankUsageForSelfEmployment: null,
    businessBankCount: "1",
    address: "",
    businessType: "",
    businessName: "",
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
  };
  const [isEditProfile, setIsEditProfile] = useState(false);
  const [formData, setFormData] = useState(initialFormState);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    let err = { ...formData.error };

    switch (name) {
      case "name":
        if (!value.trim()) {
          err.name = "Name is required field";
        } else if (!/^[A-Za-z\s]{3,}$/.test(value)) {
          err.name = "plz enter valid name";
        } else {
          err.name = "";
        }
        break;
      case "surname":
        if (!/^[A-Za-z\s]{1,}$/.test(value) || value.trim().length < 1) {
          err.surname = "Required valid surname";
        } else {
          err.surname = "";
        }
        break;
      case "location":
        if (value.trim().length < 5) {
          err.location = "Location is required field";
        } else {
          err.location = "";
        }
        break;
      default:
        break;
    }

    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
      error: err,
    }));
  };

  const updateDataHandler = async (e) => {
    e.preventDefault();
    let payload = {};
    const error = { ...formData.error };
    if (error.name || error.location) {
      toast.error("Please fill all the fields correctly");
      return;
    }
    if (formData.name || formData.surname || formData.location || formData.address) {
      payload = {
        name: formData.name?.trim() || userData.name,
        surname: formData.surname?.trim() || userData.surname,
        location: formData.location?.trim() || userData.location,
        address: formData.address || userData.address,
      };
    }

    if (userData.userRole === "MTD") {
      payload = {
        ...payload,
        dob: formData.dob || userData.dob,
        nino: formData.nino || userData.nino,
        utr: formData.utr || userData.utr,
        hasGovGateway: formData.govGatewayStatus === "Yes" ? true : (formData.govGatewayStatus === "No" ? false : null),
        bankUsageForSelfEmployment: formData.bankUsageForSelfEmployment !== null ? formData.bankUsageForSelfEmployment : userData.bankUsageForSelfEmployment,
        businessBankCount: formData.businessBankCount || userData.businessBankCount,
        address: formData.address || userData.address,
        businessType: formData.businessType || userData.businessType,
        businessName: formData.businessName || userData.businessName,
        govGatewayStatus: formData.govGatewayStatus || userData.govGatewayStatus,
        isRegisteredForMTD: formData.isRegisteredForMTD || userData.isRegisteredForMTD,
        currentAccountant: formData.currentAccountant || userData.currentAccountant,
        incomeSources: formData.incomeSources && formData.incomeSources.length > 0 ? formData.incomeSources : userData.incomeSources,
        annualTurnover: formData.annualTurnover || userData.annualTurnover,
        recordKeepingMethod: formData.recordKeepingMethod || userData.recordKeepingMethod,
        accountantNotes: formData.accountantNotes !== undefined ? formData.accountantNotes : userData.accountantNotes,
        prevSubmittedMTDThisYear: formData.prevSubmittedMTDThisYear || userData.prevSubmittedMTDThisYear,
        submittedQuarters: formData.submittedQuarters && formData.submittedQuarters.length > 0 ? formData.submittedQuarters : userData.submittedQuarters,
        whoSubmittedQuarters: formData.whoSubmittedQuarters || userData.whoSubmittedQuarters,
        hasOutstandingMTDSubmissions: formData.hasOutstandingMTDSubmissions || userData.hasOutstandingMTDSubmissions,
        reviewPreviousMTDSubmissions: formData.reviewPreviousMTDSubmissions || userData.reviewPreviousMTDSubmissions,
        firstQuarterToManage: formData.firstQuarterToManage || userData.firstQuarterToManage,
        hasGatewayCredentials: formData.hasGatewayCredentials || userData.hasGatewayCredentials,
        previousMTDSoftware: formData.previousMTDSoftware || userData.previousMTDSoftware,
        otherActiveIncomeSources: formData.otherActiveIncomeSources || userData.otherActiveIncomeSources,
      };
    }
    try {
      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}auth/update-account-settings`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${sessionData.accessToken}`,
          },
        }
      );
      if (response.status === 200) {
        toast.success("Profile updated successfully");
        setIsEditProfile(false);
        setFormData(initialFormState);
        setTrackUpdate((prev) => !prev);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error(
        err?.response?.data?.message ||
        "Failed to update profile. Please try again."
      );
      return;
    }
  };

  return (
    <>
      <div className="edt_profile_box">
        <div className="edt_prof_head d-flex align-items-center justify-content-between">
          <h3>{isEditProfile ? "Edit Profile" : "Profile Details"}</h3>
          {!isEditProfile && <button className="edit-btn" title="Edit Profile" onClick={() => {
            setFormData({
              name: userData.name || "",
              surname: userData.surname || "",
              location: userData.location || "",
              error: { name: "", surname: "", location: "" },
              dob: userData.dob ? userData.dob.substring(0, 10) : "",
              nino: userData.nino ? userData.nino.trim() : "",
              utr: userData.utr || "",
              hasGovGateway: userData.hasGovGateway !== undefined && userData.hasGovGateway !== null ? userData.hasGovGateway : null,
              bankUsageForSelfEmployment: userData.bankUsageForSelfEmployment !== undefined && userData.bankUsageForSelfEmployment !== null ? userData.bankUsageForSelfEmployment : null,
              businessBankCount: userData.businessBankCount || "1",
              address: userData.address || "",
              businessType: userData.businessType || "",
              businessName: userData.businessName || "",
              govGatewayStatus: userData.govGatewayStatus || (userData.hasGovGateway !== undefined ? (userData.hasGovGateway ? "Yes" : "No") : ""),
              isRegisteredForMTD: userData.isRegisteredForMTD || "",
              currentAccountant: userData.currentAccountant || "",
              incomeSources: (function() {
                try {
                  let src = userData.incomeSources;
                  if (typeof src === 'string') {
                    if (src.trim().startsWith('[')) src = JSON.parse(src);
                    if (typeof src === 'string' && src.trim().startsWith('[')) src = JSON.parse(src);
                  }
                  if (Array.isArray(src)) return src;
                  if (src) return [src];
                } catch(e) {}
                return [];
              })(),
              annualTurnover: userData.annualTurnover || "",
              recordKeepingMethod: userData.recordKeepingMethod || "",
              accountantNotes: userData.accountantNotes || "",
              prevSubmittedMTDThisYear: userData.prevSubmittedMTDThisYear || "",
              submittedQuarters: (function() {
                try {
                  let src = userData.submittedQuarters;
                  if (typeof src === 'string') {
                    if (src.trim().startsWith('[')) src = JSON.parse(src);
                    if (typeof src === 'string' && src.trim().startsWith('[')) src = JSON.parse(src);
                  }
                  if (Array.isArray(src)) return src;
                  if (src) return [src];
                } catch(e) {}
                return [];
              })(),
              whoSubmittedQuarters: userData.whoSubmittedQuarters || "",
              hasOutstandingMTDSubmissions: userData.hasOutstandingMTDSubmissions || "",
              reviewPreviousMTDSubmissions: userData.reviewPreviousMTDSubmissions || "",
              firstQuarterToManage: userData.firstQuarterToManage || "",
              hasGatewayCredentials: userData.hasGatewayCredentials || "",
              previousMTDSoftware: userData.previousMTDSoftware || "",
              otherActiveIncomeSources: userData.otherActiveIncomeSources || "",
            });
            setIsEditProfile(true);
          }}>
            <FaPencil />
          </button>}

        </div>

        <div className="profile_details">
          {!isEditProfile && <Row>
            <Col lg={12}>
              <div className="mb-4">
                <h6 className="mb-1">User Name</h6>
                <p className="text-muted">
                  {userData?.name || userData?.surname
                    ? `${userData.name || ""} ${userData.surname || ""}`.trim()
                    : sessionData?.user?.name || sessionData?.user?.surname
                      ? `${sessionData?.user?.name || ""} ${sessionData?.user?.surname || ""}`.trim()
                      : "Name"}
                </p>
                <hr />
              </div>
            </Col>
            <Col lg={12}>
              <div className="mb-4">
                <h6 className="mb-1">Location</h6>
                <p className="text-muted">{userData.location ||
                  sessionData?.user?.location ||
                  "Location"}</p>
                <hr />
              </div>
            </Col>
            <Col lg={6}>
              <div className="mb-4">
                <h6 className="mb-1">Phone Number <span className="verified">verified</span></h6>
                <p className="text-muted">{userData.mobile
                  ? userData.mobile
                  : sessionData?.user?.mobile}</p>
                <hr />
              </div>
            </Col>
            <Col lg={6}>
              <div className="mb-4">
                <h6 className="mb-1">Email address <span className="verified">verified</span></h6>
                <p className="text-muted">{userData.email ? userData.email : sessionData?.user?.email}</p>
                <hr />
              </div>
            </Col>
            <Col lg={12}>
              <div className="mb-4">
                <h6 className="mb-1">Address</h6>
                <p className="text-muted">{userData.address || "N/A"}</p>
                <hr />
              </div>
            </Col>

            {userData.userRole === "MTD" && (
              <>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1">Date of Birth</h6>
                    <p className="text-muted">{userData.dob || "N/A"}</p>
                    <hr />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1">NINO</h6>
                    <p className="text-muted">{userData.nino || "N/A"}</p>
                    <hr />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1">UTR</h6>
                    <p className="text-muted">{userData.utr || "N/A"}</p>
                    <hr />
                  </div>
                </Col>
              </>
            )}
          </Row>}

          {/* ── Onboarding Questionnaire ── */}
          {!isEditProfile && userData.userRole === "MTD" && (
            <div
              style={{
                marginTop: 32,
                borderRadius: 16,
                border: '2px solid #e8f5ef',
                background: 'linear-gradient(135deg, #f6fdf9 0%, #edf8f2 100%)',
                padding: '28px 28px 8px',
                position: 'relative',
              }}
            >
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: '#37a267', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18, flexShrink: 0,
                }}>📋</div>
                <div>
                  <h5 style={{ margin: 0, fontWeight: 700, color: '#1a3d2b', fontSize: 16 }}>
                    Onboarding Questionnaire
                  </h5>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b8f7e' }}>
                    Your answers from the initial MTD setup wizard
                  </p>
                </div>
                <span style={{
                  marginLeft: 'auto', background: '#37a267', color: '#fff',
                  fontSize: 11, fontWeight: 700, padding: '3px 10px',
                  borderRadius: 20, letterSpacing: 0.5, textTransform: 'uppercase',
                }}>Setup Answers</span>
              </div>

              <Row>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Business Type</h6>
                    <p className="text-muted">{userData.businessType || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Business Name</h6>
                    <p className="text-muted">{userData.businessName || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Gov Gateway Account</h6>
                    <p className="text-muted">{userData.govGatewayStatus || (userData.hasGovGateway !== undefined ? (userData.hasGovGateway ? "Yes" : "No") : "N/A")}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Registered for MTD</h6>
                    <p className="text-muted">{userData.isRegisteredForMTD || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Who Handles Your Accounting</h6>
                    <p className="text-muted">{userData.currentAccountant || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Annual Turnover</h6>
                    <p className="text-muted">{userData.annualTurnover || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={12}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Income Sources</h6>
                    <p className="text-muted">
                      {(() => {
                        let src = userData.incomeSources;
                        try {
                          if (typeof src === 'string') {
                            if (src.trim().startsWith('[')) src = JSON.parse(src);
                            if (typeof src === 'string' && src.trim().startsWith('[')) src = JSON.parse(src);
                          }
                        } catch(e) {}
                        if (Array.isArray(src) && src.length > 0) {
                          return (
                            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {src.map(s => (
                                <span key={s} style={{
                                  background: '#e8f5ef', color: '#1a5c37', fontSize: 12,
                                  fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                                }}>{s}</span>
                              ))}
                            </span>
                          );
                        }
                        return src || "N/A";
                      })()}
                    </p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Record Keeping Method</h6>
                    <p className="text-muted">{userData.recordKeepingMethod || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Accountant Notes</h6>
                    <p className="text-muted">{userData.accountantNotes || "None"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>MTD Submitted</h6>
                    <p className="text-muted">{userData.prevSubmittedMTDThisYear || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Who Submitted</h6>
                    <p className="text-muted">{userData.whoSubmittedQuarters || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Outstanding Subs</h6>
                    <p className="text-muted">{userData.hasOutstandingMTDSubmissions || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Review Previous</h6>
                    <p className="text-muted">{userData.reviewPreviousMTDSubmissions || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>1st Qtr Manage</h6>
                    <p className="text-muted">{userData.firstQuarterToManage || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Gateway Credentials</h6>
                    <p className="text-muted">{userData.hasGatewayCredentials || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Previous Software</h6>
                    <p className="text-muted">{userData.previousMTDSoftware || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={6}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Other Income Sources</h6>
                    <p className="text-muted">{userData.otherActiveIncomeSources || "N/A"}</p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
                <Col lg={12}>
                  <div className="mb-4">
                    <h6 className="mb-1" style={{ color: '#1a3d2b' }}>Submitted Quarters</h6>
                    <p className="text-muted">
                      {(() => {
                        let src = userData.submittedQuarters;
                        try {
                          if (typeof src === 'string') {
                            if (src.trim().startsWith('[')) src = JSON.parse(src);
                            if (typeof src === 'string' && src.trim().startsWith('[')) src = JSON.parse(src);
                          }
                        } catch(e) {}
                        if (Array.isArray(src) && src.length > 0) {
                          return (
                            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {src.map(s => (
                                <span key={s} style={{
                                  background: '#e8f5ef', color: '#1a5c37', fontSize: 12,
                                  fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                                }}>{s}</span>
                              ))}
                            </span>
                          );
                        }
                        return src || "N/A";
                      })()}
                    </p>
                    <hr style={{ borderColor: '#d4ede0' }} />
                  </div>
                </Col>
              </Row>
            </div>
          )}
        </div>
        {isEditProfile && <div className="edit-profile-form">
          <Form className="common-form" onSubmit={updateDataHandler}>
            <Row>
              <Col lg={12}>
                <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
                  <Form.Label>Name</Form.Label>
                  <Form.Control type="text"
                    name="name"
                    placeholder={userData.name || sessionData?.user?.name || "Name"}
                    value={formData.name}
                    onChange={handleInputChange} />
                  <span className="error_msg error_msg_color">
                    {isEditProfile && formData?.error?.name}
                  </span>
                </Form.Group>

              </Col>
              <Col lg={12}>
                <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
                  <Form.Label>Surname</Form.Label>
                  <Form.Control type="text"
                    name="surname"
                    placeholder={userData.surname || sessionData?.user?.surname || "Surname"}
                    value={formData.surname}
                    onChange={handleInputChange} />
                    <span className="error_msg error_msg_color">
                  {isEditProfile && formData?.error?.surname}
                </span>
                </Form.Group>
                
              </Col>
              <Col lg={12}>
                <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
                  <Form.Label>Location</Form.Label>
                  <Form.Control name="location" type="text"
                    placeholder={
                      userData.location ||
                      sessionData?.user?.location ||
                      "Location"
                    }
                    value={formData.location}
                    onChange={handleInputChange} />
                     <span className="error_msg error_msg_color">
                  {isEditProfile && formData?.error?.location}
                </span>
                </Form.Group>
               
              </Col>
              <Col lg={6}>
                <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
                  <Form.Label>Phone Number <span className="verified">verified</span></Form.Label>
                  <Form.Control type="text"
                    value={userData.mobile
                      ? userData.mobile
                      : sessionData?.user?.mobile}

                    disabled />
                </Form.Group>
              </Col>
              <Col lg={6}>
                <Form.Group className="mb-4" controlId="exampleForm.ControlInput2">
                  <Form.Label>Email Address <span className="verified">verified</span></Form.Label>
                  <Form.Control type="text"
                    value={userData.email ? userData.email : sessionData?.user?.email}
                    disabled />
                </Form.Group>
              </Col>
              <Col lg={12}>
                <Form.Group className="mb-4">
                  <Form.Label>Address</Form.Label>
                  <Form.Control
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder={userData.address || "Full Address"}
                  />
                </Form.Group>
              </Col>

              {userData.userRole === "MTD" && (
                <>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Date of Birth</Form.Label>
                      <Form.Control
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleInputChange}
                        placeholder={userData.dob || "YYYY-MM-DD"}
                      />
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>NINO</Form.Label>
                      <Form.Control
                        type="text"
                        name="nino"
                        value={formData.nino}
                        onChange={handleInputChange}
                        placeholder={userData.nino || "National Insurance Number"}
                      />
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>UTR</Form.Label>
                      <Form.Control
                        type="text"
                        name="utr"
                        value={formData.utr}
                        onChange={handleInputChange}
                        placeholder={userData.utr || "Unique Taxpayer Reference"}
                      />
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Business Bank Usage</Form.Label>
                      <Form.Select
                        name="bankUsageForSelfEmployment"
                        value={formData.bankUsageForSelfEmployment === null || formData.bankUsageForSelfEmployment === undefined ? "" : String(formData.bankUsageForSelfEmployment)}
                        onChange={(e) => setFormData({ ...formData, bankUsageForSelfEmployment: e.target.value === "true" })}
                      >
                        <option value="">Select Option</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Bank Account Count</Form.Label>
                      <Form.Select
                        name="businessBankCount"
                        value={formData.businessBankCount}
                        onChange={handleInputChange}
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3+">3+</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  
                  {/* New MTD Fields */}
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Business Type</Form.Label>
                      <Form.Select
                        name="businessType"
                        value={formData.businessType}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Sole Trader">Sole Trader</option>
                        <option value="Landlord / Property Business">Landlord / Property Business</option>
                        <option value="Partnership">Partnership</option>
                        <option value="Limited Company">Limited Company</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Business Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="businessName"
                        value={formData.businessName}
                        onChange={handleInputChange}
                        placeholder="Business Name"
                      />
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Gov Gateway Status</Form.Label>
                      <Form.Select
                        name="govGatewayStatus"
                        value={formData.govGatewayStatus}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="Not Sure">Not Sure</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Registered for MTD</Form.Label>
                      <Form.Select
                        name="isRegisteredForMTD"
                        value={formData.isRegisteredForMTD}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="Not Sure">Not Sure</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Who Handles Your Accounting</Form.Label>
                      <Form.Select
                        name="currentAccountant"
                        value={formData.currentAccountant}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="I manage it myself">I manage it myself</option>
                        <option value="Another accountant">Another accountant</option>
                        <option value="No accountant currently">No accountant currently</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col lg={12}>
                    <Form.Group className="mb-4">
                      <Form.Label>Income Sources</Form.Label>
                      <div className="d-flex flex-wrap gap-2 mt-2">
                        {['Self-Employment', 'Rental Income', 'Employment (PAYE)', 'Dividends', 'Other'].map((source) => {
                          const current = Array.isArray(formData.incomeSources) ? formData.incomeSources : [];
                          const isSelected = current.includes(source);
                          return (
                            <button
                              key={source}
                              type="button"
                              className={`btn btn-sm ${isSelected ? 'btn-success' : 'btn-outline-secondary'}`}
                              onClick={() => {
                                const newSources = isSelected 
                                  ? current.filter(s => s !== source)
                                  : [...current, source];
                                setFormData({ ...formData, incomeSources: newSources });
                              }}
                              style={{ borderRadius: '20px', padding: '5px 15px' }}
                            >
                              {isSelected && <span className="me-1">✓</span>}
                              {source}
                            </button>
                          );
                        })}
                      </div>
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Annual Turnover</Form.Label>
                      <Form.Select
                        name="annualTurnover"
                        value={formData.annualTurnover}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Under £10,000">Under £10,000</option>
                        <option value="£10,000 – £50,000">£10,000 – £50,000</option>
                        <option value="£50,000 – £100,000">£50,000 – £100,000</option>
                        <option value="Over £100,000">Over £100,000</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Record Keeping Method</Form.Label>
                      <Form.Select
                        name="recordKeepingMethod"
                        value={formData.recordKeepingMethod}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Accounting Software">Accounting Software</option>
                        <option value="Spreadsheet">Spreadsheet</option>
                        <option value="Paper Records">Paper Records</option>
                        <option value="Bank Statements Only">Bank Statements Only</option>
                        <option value="Not Sure">Not Sure</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col lg={12}>
                    <Form.Group className="mb-4">
                      <Form.Label>Accountant Notes</Form.Label>
                      <Form.Control
                        as="textarea"
                        name="accountantNotes"
                        value={formData.accountantNotes}
                        onChange={handleInputChange}
                        placeholder="Any additional notes..."
                        rows={3}
                      />
                    </Form.Group>
                  </Col>
                  
                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>MTD Submitted This Year?</Form.Label>
                      <Form.Select
                        name="prevSubmittedMTDThisYear"
                        value={formData.prevSubmittedMTDThisYear}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Yes, all required quarters have been submitted">Yes, all required quarters</option>
                        <option value="Yes, some quarters have been submitted">Yes, some quarters</option>
                        <option value="No, I have not submitted any quarterly updates">No, not submitted</option>
                        <option value="I’m not sure">Not Sure</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Who Submitted Updates?</Form.Label>
                      <Form.Select
                        name="whoSubmittedQuarters"
                        value={formData.whoSubmittedQuarters}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="I submitted them myself">Myself</option>
                        <option value="My previous accountant submitted them">Previous Accountant</option>
                        <option value="Another software provider submitted them">Software Provider</option>
                        <option value="I’m not sure">Not Sure</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Outstanding MTD Submissions?</Form.Label>
                      <Form.Select
                        name="hasOutstandingMTDSubmissions"
                        value={formData.hasOutstandingMTDSubmissions}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="I’m not sure">Not Sure</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Review Previous Submissions?</Form.Label>
                      <Form.Select
                        name="reviewPreviousMTDSubmissions"
                        value={formData.reviewPreviousMTDSubmissions}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>First Quarter to Manage?</Form.Label>
                      <Form.Select
                        name="firstQuarterToManage"
                        value={formData.firstQuarterToManage}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Q1 (6 April – 5 July)">Q1</option>
                        <option value="Q2 (6 July – 5 October)">Q2</option>
                        <option value="Q3 (6 October – 5 January)">Q3</option>
                        <option value="Q4 (6 January – 5 April)">Q4</option>
                        <option value="I’m not sure / Need advice">Not Sure / Need advice</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Has Gateway Credentials?</Form.Label>
                      <Form.Select
                        name="hasGatewayCredentials"
                        value={formData.hasGatewayCredentials}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="I’m not sure">Not Sure</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Previous MTD Software?</Form.Label>
                      <Form.Select
                        name="previousMTDSoftware"
                        value={formData.previousMTDSoftware}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Xero">Xero</option>
                        <option value="QuickBooks">QuickBooks</option>
                        <option value="FreeAgent">FreeAgent</option>
                        <option value="Spreadsheets / Bridging software">Spreadsheets / Bridging software</option>
                        <option value="Other">Other</option>
                        <option value="Not sure">Not sure</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col lg={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>Other Active Income Sources?</Form.Label>
                      <Form.Select
                        name="otherActiveIncomeSources"
                        value={formData.otherActiveIncomeSources}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="I’m not sure">Not Sure</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col lg={12}>
                    <Form.Group className="mb-4">
                      <Form.Label>Submitted Quarters</Form.Label>
                      <div className="d-flex flex-wrap gap-2 mt-2">
                        {['Q1 (6 April – 5 July)', 'Q2 (6 July – 5 October)', 'Q3 (6 October – 5 January)', 'Q4 (6 January – 5 April)'].map((source) => {
                          const current = Array.isArray(formData.submittedQuarters) ? formData.submittedQuarters : [];
                          const isSelected = current.includes(source);
                          return (
                            <button
                              key={source}
                              type="button"
                              className={`btn btn-sm ${isSelected ? 'btn-success' : 'btn-outline-secondary'}`}
                              onClick={() => {
                                const newSources = isSelected 
                                  ? current.filter(s => s !== source)
                                  : [...current, source];
                                setFormData({ ...formData, submittedQuarters: newSources });
                              }}
                              style={{ borderRadius: '20px', padding: '5px 15px' }}
                            >
                              {isSelected && <span className="me-1">✓</span>}
                              {source}
                            </button>
                          );
                        })}
                      </div>
                    </Form.Group>
                  </Col>
                </>
              )}
            </Row>


            <div className="profile-btn-main d-flex align-items-center justify-content-lg-end justify-content-center gap-2">
              <button
                className="red-bd-btn"
                type="button"
                onClick={() => {
                  setIsEditProfile(false);
                  setFormData(initialFormState);
                }}
              >
                Cancel
              </button>
              <button className="common-btn" type="submit">Save Info</button>
            </div>





          </Form>

        </div>}

        {!isEditProfile && userData?.isSubscriptionBuy && userData?.subscription && (
          <div className="profile_details mt-5 pt-3 border-top">
            <h4 className="mb-4">Subscription Details</h4>
            <Row>
              <Col lg={6}>
                <div className="mb-4">
                  <h6 className="mb-1">Plan Configuration</h6>
                  <p className="text-muted text-capitalize">{userData.subscription.plan?.name || "N/A"} Package</p>
                  <hr />
                </div>
              </Col>
              <Col lg={6}>
                <div className="mb-4">
                  <h6 className="mb-1">Status</h6>
                  <span className={`badge px-3 py-2 text-capitalize ${userData.subscription.status?.toLowerCase() === 'active' ? 'bg-success' : 'bg-danger'}`}>{userData.subscription.status}</span>
                  <hr />
                </div>
              </Col>
              <Col lg={6}>
                <div className="mb-4">
                  <h6 className="mb-1">Billing Amount</h6>
                  <p className="text-muted fw-bold mb-0">
                    {getCurrencySymbol(userData.subscription.currency)}{userData.subscription.amount}
                  </p>
                  <hr />
                </div>
              </Col>
              <Col lg={6}>
                <div className="mb-4">
                  <h6 className="mb-1">Activation Date</h6>
                  <p className="text-muted mb-0">
                    {new Date(userData.subscription.startDate).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                  <hr />
                </div>
              </Col>
            </Row>
          </div>
        )}
        
        {!isEditProfile && (
          <div className="mt-4 text-end">
            <Link 
              href={
                (userData?.userRole === "MTD" || sessionData?.user?.userRole === "MTD" || sessionData?.user?.role === "MTD") 
                  ? "/mtd-dashboard?tab=deleteProfile" 
                  : "/dashboard/delete-profile"
              }
              className="text-decoration-underline" 
              style={{ fontSize: '15px', color: '#4c4c4c' }}
            >
              Deactivate Account
            </Link>
          </div>
        )}
      </div >
    </>
  );
};

export default EditProfile;
