"use client"
import { useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedText, TranslatedNextLink, TranslatedInput } from "@/components/TranslatedContent";

const firstInitialForm = {
  name: "",
  email: "",
  phone: "",
  error: {
    name: "",
    email: "",
    phone: "",
  },
};
const secondInitialForm = {
  password: "",
  confirmPassword: "",
  error: {
    password: "",
    confirmPassword: "",
  },
};

const SelfAssesmentFormSection = () => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isSubmitInitialData, setIsSubmitInitialData] = useState(false);
  const [firstFormData, setFirstFormData] = useState(firstInitialForm);
  const [secondFormData, setSecondFormData] = useState(secondInitialForm);

  //  Handle changes in the second form
  const handleFirstFormChange = (e) => {
    const { name, value } = e.target;

    let errorMessage = "";

    // Regex validation
    if (name === "name") {
      if (!/^[a-zA-Z\s]{2,}$/.test(value)) {
        errorMessage = "Name must contain at least 2 letters";
      }
    }

    if (name === "email") {
      if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value)) {
        errorMessage = "Invalid email format";
      }
    }

    if (name === "phone") {
      // err.mobile = /^\d{1,15}$/.test(value) ? "" : "*Must be maximum 15 digits";
      if (!(/^\d{1,15}$/.test(value))) {
        errorMessage = "*Must be maximum 15 digits";
      }
    }

    // Update state
    setFirstFormData((prev) => ({
      ...prev,
      [name]: value,
      error: {
        ...prev.error,
        [name]: errorMessage,
      },
    }));
  };

  //   Handle changes in the second form
  const handleSecondFormChange = (e) => {
    const { name, value } = e.target;

    let errorMessage = "";

    // Password validation
    if (name === "password") {
      const trimmed = value.trim();
      const strongPasswordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$!%*?&])[A-Za-z\d@#$!%*?&]{8,}$/;

      if (!strongPasswordRegex.test(trimmed)) {
        errorMessage =
          "Password must be 8+ chars, include uppercase, lowercase, number & special character";
      }
    }

    // Confirm password validation
    if (name === "confirmPassword") {
      if (value !== secondFormData.password) {
        errorMessage = "Passwords do not match";
      }
    }

    // Update form state
    setSecondFormData((prev) => ({
      ...prev,
      [name]: value,
      error: {
        ...prev.error,
        // Only update the error for current field
        [name]: errorMessage,
      },
    }));
  };

  //   Validate First Form
  const validateFirstForm = (e) => {
    e?.preventDefault();
    const { name, email, phone, error } = firstFormData;
    console.log("firstFormData", firstFormData);
    if (!name || !email || !phone) {
      e?.preventDefault();
      toast.error("All fields are required");
      return;
    }

    if (error.name || error.email || error.phone) {
      e?.preventDefault();
      toast.error("Please provide valid inputs");
      return;
    }

    setIsSubmitInitialData(true);
  };

  //   Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    validateFirstForm();
    if (
      secondFormData.error.password ||
      secondFormData.error.confirmPassword ||
      !secondFormData.password ||
      !secondFormData.confirmPassword ||
      secondFormData.password !== secondFormData.confirmPassword
    ) {
      toast.error("Please provide valid inputs");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}auth/register`,
        {
          name: firstFormData.name,
          email: firstFormData.email,
          mobile: firstFormData.phone,
          password: secondFormData.password,
          confirmPassword: secondFormData.confirmPassword,
          surname: "NA",
        }
      );
      toast.success(res?.data?.message || "Registration successful");
      setSuccess(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Registration failed");
      setSuccess(false);
    } finally {
      setLoading(false);
      setIsSubmitInitialData(false);
      setFirstFormData(firstInitialForm);
      setSecondFormData(secondInitialForm);
    }
  };

  if (success) {
    return (
      <>
        <div className="SelfAssesmentFormDiv">
          <TranslatedHeadingFour className="text-success my-2 justfyCenter">Verification link send to your email</TranslatedHeadingFour>
          <TranslatedNextLink className="greenBtn" href={"/login"}>
            Login
          </TranslatedNextLink>
        </div>
      </>
    );
  }

  if (isSubmitInitialData) {
    return (
      <>
        <div className="SelfAssesmentFormDiv">
          <TranslatedHeadingFour>Register Now</TranslatedHeadingFour>
          <form >
            <div className="SelfAssesmentFormBox SelfAssesmentFormBoxInput">
              <TranslatedInput
                type="password"
                name="password"
                value={secondFormData.password}
                placeholder="Enter your password"
                className="user_password"
                onChange={handleSecondFormChange}
              />
              {secondFormData.error.password && (
                <TranslatedSpan className="error_msg error_msg_color">
                  {secondFormData.error.password}
                </TranslatedSpan>
              )}
            </div>
            <div className="SelfAssesmentFormBox SelfAssesmentFormBoxInput">

              <TranslatedInput
                type="password"
                name="confirmPassword"
                value={secondFormData.confirmPassword}
                placeholder="Confirm your password"
                className="user_password"
                onChange={handleSecondFormChange}
              />
              {secondFormData.error.confirmPassword && (
                <TranslatedSpan className="error_msg error_msg_color">
                  {secondFormData.error.confirmPassword}
                </TranslatedSpan>
              )}
            </div>
            <div className="SelfAssesmentFormBox">

              <TranslatedButton className="greenBtn" type="button" onClick={handleSubmit}>
                Register
              </TranslatedButton>
            </div>
          </form>
          <p className='noSpam'>No spam. Your details are secure <img src="/images/goldenLock.png" alt="" /></p>
        </div>
      </>
    )
  }
  return (
    <>
      <div className="SelfAssesmentFormDiv">
        <TranslatedHeadingTwo>Start Your Self Assessment</TranslatedHeadingTwo>
        <form >
          {!session?.accessToken ? <>
            <div className="SelfAssesmentFormBox SelfAssesmentFormBoxInput">
              <TranslatedInput
                type="text"
                name="name"
                value={firstFormData.name}
                placeholder="Your Full Name"
                className="user_name"
                onChange={handleFirstFormChange}
              />
              {firstFormData.error.name && (
                <TranslatedSpan className="error_msg error_msg_color">
                  {firstFormData.error.name}
                </TranslatedSpan>
              )}
            </div>
            <div className="SelfAssesmentFormBox SelfAssesmentFormBoxInput">
              <TranslatedInput
                type="email"
                name="email"
                value={firstFormData.email}
                placeholder="Your Email Address"
                className="user_email"
                onChange={handleFirstFormChange}
              />
              {firstFormData.error.email && (
                <TranslatedSpan className="error_msg error_msg_color">
                  {firstFormData.error.email}
                </TranslatedSpan>
              )}
            </div>
            <div className="SelfAssesmentFormBox SelfAssesmentFormBoxInput">
              <TranslatedInput
                type="number"
                name="phone"
                value={firstFormData.phone}
                placeholder="Your Phone Number"
                className="user_phone"
                onChange={handleFirstFormChange}
              />
              {firstFormData.error.phone && (
                <TranslatedSpan className="error_msg error_msg_color">
                  {firstFormData.error.phone}
                </TranslatedSpan>
              )}
            </div>
            <div className="SelfAssesmentFormBox">

              <TranslatedButton className="greenBtn" type="button" onClick={validateFirstForm}>
                Start Now
              </TranslatedButton>
            </div>
          </> :
            <TranslatedNextLink className="greenBtn" href={"tax-return-form"}>
              Start Now
            </TranslatedNextLink>
          }
        </form>
        <div className='noSpam'><TranslatedParagraph> No spam. Your details are secure </TranslatedParagraph><img src="/images/goldenLock.png" alt="" /></div>
      </div>
    </>
  )
}

export default SelfAssesmentFormSection
