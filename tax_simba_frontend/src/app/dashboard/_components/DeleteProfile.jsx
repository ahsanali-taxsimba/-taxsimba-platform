import React from "react";
import DeleteModal from "./DeleteModal";
import axios from "axios";
import toast from "react-hot-toast";
import { nativeApiUrl } from "@/lib/nativeApiUrl";

/**
 * Account closure request — does not invent hard-delete or soft-deactivate APIs.
 * Both modal actions submit the approved ACCOUNT_CLOSURE data-request.
 */
const DeleteProfile = ({ sessionData }) => {
  const submitClosureRequest = async (data, asDelete) => {
    try {
      const reason = String(
        data?.reason ||
          (asDelete ? "Client requested account closure" : "Client requested account deactivation"),
      ).trim();
      const response = await axios.post(
        nativeApiUrl("/api/my-data-requests"),
        { kind: "ACCOUNT_CLOSURE", reason },
        {
          headers: {
            Authorization: `Bearer ${sessionData.accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      const duplicate = Boolean(response?.data?.duplicate_prevented);
      toast.success(
        duplicate
          ? "A closure request is already pending review."
          : "Your account-closure request has been recorded. Our team will process it under TaxSimba retention rules.",
      );
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Could not submit the account-closure request. Please try again or contact support.",
      );
    }
  };

  return (
    <>
      <div className="edt_profile_box">
        <div className="edt_prof_head mb-4">
          <h3 className="mb-2">Account Management</h3>
          <p>
            You can request account closure. Requests are reviewed under TaxSimba retention and
            compliance rules. This screen does not instantly erase regulated tax records.
          </p>
        </div>
        <div className="row mt-4 d-flex align-items-stretch">
          <div className="col-lg-6 mb-3">
            <div
              className="p-4 d-flex flex-column h-100"
              style={{
                background: "rgba(55, 162, 103, 0.05)",
                borderRadius: "24px",
                border: "1px solid rgba(55, 162, 103, 0.2)",
              }}
            >
              <h5 className="mb-2">Request deactivation / closure</h5>
              <p className="flex-grow-1" style={{ fontSize: 14, color: "#5a6b62" }}>
                Submit a request for review. Open cases and retention requirements are checked
                before any further action.
              </p>
              <button
                type="button"
                className="basic_btn cean_btn"
                data-bs-toggle="modal"
                data-bs-target="#deactivateacc"
              >
                Request closure
              </button>
            </div>
          </div>
          <div className="col-lg-6 mb-3">
            <div
              className="p-4 d-flex flex-column h-100"
              style={{
                background: "rgba(214, 69, 69, 0.05)",
                borderRadius: "24px",
                border: "1px solid rgba(214, 69, 69, 0.2)",
              }}
            >
              <h5 className="mb-2">Immediate permanent delete</h5>
              <p className="flex-grow-1" style={{ fontSize: 14, color: "#5a6b62" }}>
                Instant permanent deletion is not available from this screen. Use the closure
                request, or contact support.
              </p>
              <button type="button" className="btn btn-outline-secondary" disabled>
                Permanent delete unavailable
              </button>
            </div>
          </div>
        </div>
        <DeleteModal
          sessionData={sessionData}
          DeactivateAccount={(data) => submitClosureRequest(data, false)}
          DeleteAccount={() =>
            submitClosureRequest({ reason: "Client requested account closure" }, true)
          }
        />
      </div>
    </>
  );
};

export default DeleteProfile;
