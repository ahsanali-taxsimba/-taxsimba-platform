"use client";
import OverlaySpinner from "@/components/common/OverlaySpinner";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "react-toastify";
import { IoMdMail } from "react-icons/io";
import { FaKey } from "react-icons/fa6";


export default function SignInPartial() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [code, setCode] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [formErrors, setFormErrors] = useState({
    email: null,
    password: null,
  });
  const router = useRouter()
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
    if (name === "email") {
      if (!value) {
        error = "Email is required";
      } else if (!/^\S+@\S+\.\S+$/.test(value)) {
        error = "Invalid email address";
      }

    }
    else if (name === "password") {
      if (!value) {
        error = "Password is required";
      }
    }
    setFormErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  }

  const handleResendCode = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/auth/login-with-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          action: "request",
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success("A new verification code has been sent.");
      } else {
        toast.error(data.message || "Failed to resend code.");
      }
    } catch (err) {
      toast.error("Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true)
    console.log("formData", formData);
    const result = await signIn("credentials", {
      email: formData.email,
      password: formData.password,
      code: requires2FA ? code : undefined,
      redirect: false, // This is key - prevents automatic redirect
    });
    console.log("result", result);
    if (result?.error) {
      console.log(result.error);
      if (result.error === "2FA_REQUIRED") {
        setRequires2FA(true);
        toast.info("A verification code has been sent to your email.");
      } else {
        toast.error(result.error);
      }
      setLoading(false)
    } else if (result?.ok) {
      setLoading(false)
      router.push("/overview");
    } else {
      console.log("Login failed. Please try again.");
      setLoading(false)
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
                      <Link href="/"> <span className="me-0">
                        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M217.9 256L345 129c9.4-9.4 9.4-24.6 0-33.9-9.4-9.4-24.6-9.3-34 0L167 239c-9.1 9.1-9.3 23.7-.7 33.1L310.9 417c4.7 4.7 10.9 7 17 7s12.3-2.3 17-7c9.4-9.4 9.4-24.6 0-33.9L217.9 256z"></path>
                        </svg>
                      </span> Back </Link>
                    </div>
                    <h3 className="mb-2 mt-lg-0 mt-5 fw-bold text-capitalize">Registration</h3>
                    <p className="text-center text-muted mb-4">
                      Complete your registration to create  a  secure account.
                    </p>
                    <form onSubmit={handleSubmit}>
                      <div className="space-y-6">
                        {requires2FA ? (
                          <div className="form_row position-relative">
                            <Label>
                              Verification Code <span className="text-error-500">*</span>{" "}
                            </Label>
                            <Input
                              placeholder="Enter 6-digit code"
                              type="text"
                              name="code"
                              value={code}
                              onChange={(e) => setCode(e.target.value)}
                              error={false}
                            />
                            <div className="d-flex justify-content-between mt-2">
                              <button
                                type="button"
                                onClick={handleResendCode}
                                className="text-sm text-primary bg-transparent border-0 p-0 hover:underline"
                              >
                                Resend Code
                              </button>
                              <button
                                type="button"
                                onClick={() => setRequires2FA(false)}
                                className="text-sm text-muted bg-transparent border-0 p-0 hover:underline"
                              >
                                Back to Password Login
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="form_row position-relative">
                              <Label>
                                Email <span className="text-error-500">*</span>{" "}
                              </Label>
                              <Input
                                placeholder="info@gmail.com"
                                type="email"
                                name="email"
                                defaultValue={formData.email}
                                onChange={handleInputChange}
                                error={formErrors.email ? true : false}
                                hint={formErrors.email ?? undefined}
                              />
                              <span className="mail-icon">
                                <IoMdMail />
                              </span>
                            </div>
                            <div className="form_row position-relative">
                              <Label>
                                Password  <span className="text-error-500">*</span>{" "}
                              </Label>
                              <div className="position-relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Enter your password"
                                  defaultValue={formData.password}
                                  name="password"
                                  onChange={handleInputChange}
                                  error={formErrors.password ? true : false}
                                  hint={formErrors.password ?? undefined}
                                />
                                <span className="pas-icon">
                                  <FaKey />
                                </span>
                                <span
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                                >
                                  {showPassword ? (
                                    <EyeIcon className="" />
                                  ) : (
                                    <EyeCloseIcon className={formErrors.password ? "mb-4 " : ""} />
                                  )}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-3">
                            <Checkbox checked={isChecked} onChange={setIsChecked} />
                            <span className="">
                              Keep me logged in
                            </span>
                          </div>
                          <Link
                            href="/auth/forgot-password"
                            className="forgot-btn"
                          >
                            Forgot password?
                          </Link>
                        </div>
                        <div>
                          <Button className="main-btn w-100">
                            {requires2FA ? "Verify & Sign in" : "Sign in"}
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
