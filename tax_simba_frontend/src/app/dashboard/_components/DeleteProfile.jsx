import React from "react";
import DeleteModal from "./DeleteModal";
import axios from "axios";
import toast from "react-hot-toast";
import { Logout } from "@/app/lib/api";

const DeleteProfile = ({ sessionData, setTrackUpdate }) => {
  // Delete account
  const DeleteAccount = async () => {
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}client/delete-account`,
        {},
        {
          headers: {
            Authorization: `Bearer ${sessionData.accessToken}`,
          },
        }
      );
      toast.success(response?.data?.message || "Account deleted successfully");
      Logout(sessionData);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete account. Please try again.");
    }
  };

  const DeactivateAccount = async (data) => {
    try {
      const payload = sessionData?.user?.provider === 'google'
        ? { reason: data.reason }
        : { password: data.password, reason: data.reason };

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}client/deactivate`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${sessionData.accessToken}`,
          },
        }
      );
      toast.success(response?.data?.message || "Account deactivated successfully");
      Logout(sessionData);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to deactivate account. Please try again.");
    }
  };
  return (
    <>
      <div className="edt_profile_box">
        <div className="edt_prof_head mb-4">
          <h3 className="mb-2">Account Management</h3>
          <p>
            Choose to temporarily deactivate your account or permanently delete it.
            Deletion is irreversible and will remove all associated data and reviews.
          </p>
        </div>
        <div className="row mt-4 d-flex align-items-stretch">
          <div className="col-lg-6 mb-3">
            <div className="p-4 d-flex flex-column h-100" style={{ background: 'rgba(55, 162, 103, 0.05)', borderRadius: '24px', border: '1px solid rgba(55, 162, 103, 0.2)' }}>
              <h4 style={{ color: '#37a267', fontWeight: '800' }}>Deactivate Account</h4>
              <p style={{ color: '#000', fontSize: '0.9rem', flexGrow: 1 }}>Temporarily disable your profile. You can reactivate your account anytime by logging back in.</p>
              <button
                className="common-btn mt-3"
                style={{ background: '#37a267', color: '#06130f', border: 'none', padding: '15px 25px', borderRadius: '15px', fontWeight: '800', width: '100%', transition: '0.3s' }}
                data-bs-toggle="modal"
                data-bs-target="#deactivateacc"
              >
                Deactivate Now
              </button>
            </div>
          </div>
          <div className="col-lg-6 mb-3">
            <div className="p-4 d-flex flex-column h-100" style={{ background: 'rgba(255, 77, 77, 0.05)', borderRadius: '24px', border: '1px solid rgba(255, 77, 77, 0.2)' }}>
              <h4 style={{ color: '#ff4d4d', fontWeight: '800' }}>Delete Account</h4>
              <p style={{ color: '#000', fontSize: '0.9rem', flexGrow: 1 }}>Permanently remove your account and all data. This action is final and cannot be reversed.</p>
              <button
                className="common-btn mt-3"
                style={{ background: '#ff4d4d', color: '#fff', border: 'none', padding: '15px 25px', borderRadius: '15px', fontWeight: '800', width: '100%', transition: '0.3s' }}
                data-bs-toggle="modal"
                data-bs-target="#deleteacc"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      </div>
      <DeleteModal
        DeleteAccount={DeleteAccount}
        DeactivateAccount={DeactivateAccount}
        sessionData={sessionData}
      />
    </>
  );
};

export default DeleteProfile;
