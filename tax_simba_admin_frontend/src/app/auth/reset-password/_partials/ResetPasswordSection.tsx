"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
// import { signIn } from "next-auth/react";
import Link from "next/link";
import React, { useState } from "react";
import { FaKey } from "react-icons/fa";

import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/axiosInstance";
import { toast } from "react-toastify";

export default function ResetPasswordSection() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [formData, setFormData] = useState({
    // email: "",
    password: "",
    confirmPassword: ""
  });
  const [formErrors, setFormErrors] = useState({
    // email: null,
    password: null,
    confirmPassword: null
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    validateField(name, value);
  };

  const validateField = (name: any, value: any) => {
    let error = ""
    // if (name === "email") {
    //   if (!value) {
    //     error = "Email is required";
    //   } else if (!/^\S+@\S+\.\S+$/.test(value)) {
    //     error = "Invalid email address";
    //   }

    // }
    if (name === "password") {
      if (!value) {
        error = "Password is required";
      } else if (!/[A-Z]/.test(value)) {
        error = "Password must contain a Uppercase";
      } else if (!/[a-z]/.test(value)) {
        error = "Password must contain a Lowercase";
      } else if (!/[!@#$%^&*]/.test(value)) {
        error = "Password must contain a special character";
      } else if (!/[0-9]/.test(value)) {
        error = "Password must contain a digit";
      }

    } else if (name === 'confirmPassword') {
      if (!value) {
        error = "Please confirm your password";
      } else if (value !== formData.password) {
        error = "Passwords do not match";
      }
    }
    setFormErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
    return error;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!token) {
      toast.error("Invalid or missing reset token. Please request a new reset link.");
      return;
    }

    const passwordError = validateField("password", formData.password);
    const confirmError = validateField("confirmPassword", formData.confirmPassword);

    if (passwordError || confirmError) return;

    setLoading(true);
    try {
      const response = await api.post("auth/reset-password", {
        token,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      toast.success(response.data.message || "Password has been reset successfully!");
      router.push("/auth/signin");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>


      <div className="registration_login_full">
        <div className="container">
          <div className="row">
            <div className="col-lg-6 col-md-5 pe-0 d-none d-lg-block">
              <div className="register_img text-center">
                <img src="../images/login-img.png" alt="" className="img-fluid" />
              </div>
            </div>
            <div className="col-lg-6 col-md-12 ps-md-0 ps-3">
              <div className="registration_part_inner">
                <div className="global_login_holdr registration h-100">
                  <div className="sign_in_form_part mb-2">
                    <div className="back-btn">
                      <Link href="/auth/signin"> <span className="me-0">
                        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M217.9 256L345 129c9.4-9.4 9.4-24.6 0-33.9-9.4-9.4-24.6-9.3-34 0L167 239c-9.1 9.1-9.3 23.7-.7 33.1L310.9 417c4.7 4.7 10.9 7 17 7s12.3-2.3 17-7c9.4-9.4 9.4-24.6 0-33.9L217.9 256z"></path>
                        </svg>
                      </span> Back </Link>
                    </div>
                    <h3 className="mb-2 mt-lg-0 mt-5 fw-bold text-capitalize">Reset your password</h3>
                    <p className="text-center text-muted mb-4">
                      Add and confirm your new password!
                    </p>
                    <form onSubmit={handleSubmit}>
                      <div className="space-y-6">
                        <div className="form_row position-relative">
                          <Label>
                            Password <span className="text-error-500">*</span>{" "}
                          </Label>
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            defaultValue={formData.password}
                            name="password"
                            onChange={handleInputChange}
                            error={formErrors.password ? true : false}
                            hint={formErrors.password ?? undefined}
                            disabled={loading}
                          />
                          <span className="mail-icon">
                            <FaKey />
                          </span>
                          <span
                            onClick={() => setShowPassword(!showPassword)}
                            className="eye-icon"
                          >
                            {showPassword ? (
                              <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                            ) : (
                              <EyeCloseIcon className={formErrors.password ? "mb-4 fill-gray-500 dark:fill-gray-400" : "fill-gray-500 dark:fill-gray-400"} />
                            )}
                          </span>
                        </div>
                        <div className="form_row position-relative">
                          <Label>
                            Confirm Password <span className="text-error-500">*</span>{" "}
                          </Label>
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your password"
                            defaultValue={formData.confirmPassword}
                            name="confirmPassword"
                            onChange={handleInputChange}
                            error={formErrors.confirmPassword ? true : false}
                            hint={formErrors.confirmPassword ?? undefined}
                            className="mb-2"
                            disabled={loading}
                          />
                          <span className="mail-icon">
                            <FaKey />
                          </span>
                          <span
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="eye-icon"
                          >
                            {showConfirmPassword ? (
                              <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                            ) : (
                              <EyeCloseIcon className={formErrors.confirmPassword ? "mb-4 fill-gray-500 dark:fill-gray-400" : "fill-gray-500 dark:fill-gray-400"} />
                            )}
                          </span>
                        </div>
                        <div>
                          <Button className="main-btn w-100" disabled={loading}>
                            {loading ? "Resetting..." : "Reset Password"}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
