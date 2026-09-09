"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TranslatedHeadingTwo, TranslatedParagraph, TranslatedButton, TranslatedInput } from "@/components/TranslatedContent";
import toast from "react-hot-toast";
const DeleteModal = ({ DeleteAccount, DeactivateAccount, sessionData }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isGoogleProvider = sessionData?.user?.provider === 'google';

  const [deactivateData, setDeactivateData] = useState({
    password: "",
    reason: "",
  });

  const [deleteData, setDeleteData] = useState({
    password: "",
    reason: "",
  });

  const [showDeactivateForm, setShowDeactivateForm] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);

  const handleDeactivateChange = (e) => {
    const { name, value } = e.target;
    setDeactivateData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDeleteChange = (e) => {
    const { name, value } = e.target;
    setDeleteData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDeactivateConfirm = () => {
    if (isGoogleProvider) {
      if (!deactivateData.reason) {
        toast.error("Please fill the reason field");
        return;
      }
    } else {
      if (!deactivateData.password || !deactivateData.reason) {
        toast.error("Please fill all fields");
        return;
      }
    }
    DeactivateAccount(deactivateData);
    setShowDeactivateForm(false);
    setDeactivateData({ password: "", reason: "" });
  };

  const handleDeleteConfirm = () => {
    DeleteAccount();
    setShowDeleteForm(false);
    setDeleteData({ password: "", reason: "" });
  };

  return (
    <>
      <style>{`
        .global_modal { z-index: 1060 !important; }
        .modal-backdrop { z-index: 1050 !important; background-color: #000 !important; opacity: 0.8 !important; }
        .modal-content {
          border: 1px solid rgba(55, 162, 103, 0.2) !important;
          border-radius: 24px !important;
         
          overflow: hidden;
        }
     
        textarea.user_reason, input.user_password { 
          width: 100%; 
          background: #ffffff !important; 
          color: #000000 !important; 
          border: 1px solid rgba(0,0,0,0.2) !important; 
          border-radius: 14px !important; 
          padding: 14px 18px !important; 
          margin-bottom: 20px;
          transition: 0.3s;
          outline: none;
          font-weight: 500 !important;
        }
        textarea.user_reason::placeholder, input.user_password::placeholder {
          color: rgba(0,0,0,0.4) !important;
        }
        textarea.user_reason:focus, input.user_password:focus {
          border-color: #37a267 !important;
          background: #f0fff9 !important;
        }
        .user_reason:focus, .user_password:focus {
          border-color: #37a267 !important;
          background: rgba(55, 162, 103, 0.05) !important;
        }
     
        .darkgrey_btn { 
          background: rgba(255,255,255,0.05) !important; 
          color: #fff !important; 
          font-weight: 700 !important; 
          border-radius: 12px !important; 
          border: none !important;
          padding: 14px 30px !important;
          transition: 0.3s;
        }
        .darkgrey_btn:hover {
          background: rgba(255,255,255,0.1) !important;
        }
    
        .btn-close { 
          filter: invert(1) brightness(2);
          margin-top: 10px;
          margin-right: 10px;
        }
        .del_acc_link {
          color: #ff4d4d;
          text-decoration: none;
          font-size: 0.95rem;
          transition: 0.2s;
        }
        .del_acc_link:hover {
          color: #ff3333;
          text-decoration: underline;
        }
      `}</style>

      {/* Deactivate Modal */}
      <div
        className="modal fade global_modal"
        id="deactivateacc"
        data-bs-backdrop="static"
        data-bs-keyboard="false"
        tabIndex="-1"
        aria-labelledby="deactivateaccLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header d-flex justify-content-end border-bottom p-4">
              <TranslatedHeadingTwo className="mb-0 h3">Deactivate Account</TranslatedHeadingTwo>
              <button
                type="button"
                className="btn-close close-btn-main"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body p-3">
              <div className="profile_modal_body p-0 text-center">
                <div className="form_row">
                  {!isGoogleProvider && (
                    <input
                      type="password"
                      name="password"
                      value={deactivateData.password}
                      placeholder="Enter your password"
                      className="user_password"
                      onChange={handleDeactivateChange}
                    />
                  )}
                  <textarea
                    name="reason"
                    value={deactivateData.reason}
                    placeholder="Tell us why you're deactivating"
                    className="user_reason"
                    onChange={handleDeactivateChange}
                    rows="4"
                  />
                </div>
              </div>

            </div>
            <div className="mt-0 p-3 flex-column border-top d-flex justify-content-center gap-2">
              <button
                type="button"
                className="basic_btn cean_btn"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeactivateConfirm();
                }}
              >
                Confirm Deactivation
              </button>
              <button
                className="del_acc_link mt-2"
                onClick={() => {
                  setShowDeactivateForm(false);
                  setDeactivateData({ password: "", reason: "" });
                }}
                data-bs-toggle="modal"
                data-bs-target="#deleteacc"
                data-bs-dismiss="modal"
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                Delete your account?
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <div
        className="modal fade global_modal"
        id="deleteacc"
        data-bs-backdrop="static"
        data-bs-keyboard="false"
        tabIndex="-1"
        aria-labelledby="deleteaccLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header d-flex justify-content-end border-bottom p-4">
              <TranslatedHeadingTwo className="mb-0 h3">Delete Account</TranslatedHeadingTwo>
              <button
                type="button"
                className="btn-close close-btn-main"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <div className="profile_modal_body p-0 text-center">
                <div className="form_row">
                  <p style={{ color: '#000', fontSize: '1rem', lineHeight: '1.6' }}>
                    Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be cleared.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-0 p-3 flex-column border-top d-flex justify-content-center gap-2">
              <button
                type="button"
                className="basic_btn"
                style={{ background: '#ff4d4d', color: '#fff', padding: '12px 40px', borderRadius: '14px', border: 'none', width: '100%', transition: '0.3s' }}
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteConfirm();
                }}
              >
                Confirm Permanent Deletion
              </button>
              <button
                className="del_acc_link mt-2"
                onClick={() => {
                  setShowDeleteForm(false);
                  setDeleteData({ password: "", reason: "" });
                }}
                data-bs-toggle="modal"
                data-bs-target="#deactivateacc"
                data-bs-dismiss="modal"
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                Deactivate account?
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DeleteModal;