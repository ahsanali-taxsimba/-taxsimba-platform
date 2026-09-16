"use client";
import { passwordRegex } from "@/utils/commonHelper";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Form } from "react-bootstrap";
import toast from "react-hot-toast";
import { FaEye } from "react-icons/fa";
import { IoEyeOffSharp } from "react-icons/io5";
import { signOut } from "next-auth/react";

const ChangeProfilePassword = ({ sessionData, setTrackUpdate }) => {
  const router = useRouter();
  const initialState = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    error: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  };
  const [changePasswordData, setChangePasswordData] = useState(initialState);
  const [togglePassword, setTogglePassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const handleChange = (e) => {
    const { name, value } = e.target;

    let err = { ...changePasswordData.error };

    switch (name) {
      case "currentPassword":
        err.currentPassword = value ? "" : "Current password is required";
        break;
      case "newPassword":
        err.newPassword = !value
          ? "New password is required"
          : !passwordRegex.test(value)
            ? "Password must be 8+ chars, include uppercase, lowercase, number & special character"
            : "";
        break;
      case "confirmPassword":
        err.confirmPassword = value ? "" : "Confirm password is required";
        if (value !== changePasswordData.newPassword) {
          err.confirmPassword = "Passwords do not match";
        }
        break;
      default:
        break;
    }

    setChangePasswordData((prevData) => ({
      ...prevData,
      [name]: value,
      error: err,
    }));
  };





  const changePasswordHandler = async (payload) => {
    if (payload.currentPassword === "" || payload.newPassword === "" || payload.confirmNewPassword === "") {
      return;
    }
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}auth/change-password`, payload, {
        headers: {
          Authorization: `Bearer ${sessionData.accessToken}`
        }
      });
      if (response.status === 200) {
        toast.success("Password changed successfully! Redirecting to login...");
        if (setTrackUpdate) {
          setTrackUpdate(true);
        }
        setTimeout(() => {
          signOut({ callbackUrl: "/" });
        }, 1500);
      }
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to change password. Please try again.");
      return false;
    }
  }


  const ValidateInputs = async (e) => {
    e.preventDefault();
    const err = { ...changePasswordData.error };
    if (
      err.currentPassword ||
      err.newPassword ||
      err.confirmPassword ||
      changePasswordData.currentPassword === "" ||
      changePasswordData.newPassword === "" ||
      changePasswordData.confirmPassword === ""
    ) {
      toast.error("kindly validate inputs before submitting");
      return;
    }

    const payload = {
      currentPassword: changePasswordData.currentPassword,
      newPassword: changePasswordData.newPassword,
      confirmNewPassword: changePasswordData.confirmPassword,
    };

    const isUpadted = await changePasswordHandler(payload);
    if (!isUpadted) {
      return;
    }
    setChangePasswordData(initialState);
  };

  return (
    <>
      <div className="edt_profile_box">
        <div className="edt_prof_head">
          <h3>Change Password</h3>
          <p>You can change your password by conforming your email ID </p>
        </div>
        <Form className="common-form" onSubmit={ValidateInputs}>
          <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
            <Form.Label>Enter Current Password</Form.Label>
            <div className="position-relative">
              <Form.Control type={
                togglePassword.currentPassword ? "text" : "password"
              }
                name="currentPassword"
                value={changePasswordData.currentPassword}
                onChange={handleChange}
                placeholder="Enter Current Password"
              />
              <span className="eye-icon position-absolute" onClick={() => {
                setTogglePassword({
                  ...togglePassword,
                  currentPassword: !togglePassword.currentPassword,
                });
              }}>
                {togglePassword.currentPassword ? (
                  <FaEye />
                ) : (
                  <IoEyeOffSharp />
                )}
              </span>

            </div>
            <span className="error_msg error_msg_color">
              {changePasswordData.error.currentPassword}
            </span>
          </Form.Group>
          <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
            <Form.Label>Enter New Password</Form.Label>
            <div className="position-relative">
              <Form.Control type={togglePassword.newPassword ? "text" : "password"}
                name="newPassword"
                value={changePasswordData.newPassword}
                onChange={handleChange}
                placeholder="Enter New Password"
              />
              <span className="eye-icon position-absolute" onClick={() => {
                setTogglePassword({
                  ...togglePassword,
                  newPassword: !togglePassword.newPassword,
                });
              }}>
                {togglePassword.newPassword ? (
                  <FaEye />
                ) : (
                  <IoEyeOffSharp />
                )}

              </span>

            </div>
            <span className="error_msg error_msg_color">
              {changePasswordData.error.newPassword}
            </span>
          </Form.Group>
          <Form.Group className="mb-4" controlId="exampleForm.ControlInput1">
            <Form.Label>Confirm New Password</Form.Label>
            <div className="position-relative">
              <Form.Control type={togglePassword.confirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={changePasswordData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm New Password"
              />
              <span className="eye-icon position-absolute" onClick={() => {
                setTogglePassword({
                  ...togglePassword,
                  confirmPassword: !togglePassword.confirmPassword,
                });
              }}>
                {togglePassword.confirmPassword ? (
                  <FaEye />
                ) : (
                  <IoEyeOffSharp />
                )}

              </span>

            </div>
            <span className="error_msg error_msg_color">
              {changePasswordData.error.confirmPassword}
            </span>
          </Form.Group>
          <div className="d-flex justify-content-end gap-2">
            <button className="red-bd-btn">
              Cancel
            </button>
            <button className="common-btn">
              Submit
            </button>
          </div>
        </Form>
      </div>

    </>
  );
};

export default ChangeProfilePassword;
