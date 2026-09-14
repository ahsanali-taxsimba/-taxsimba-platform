"use client";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import toast from "react-hot-toast";
import {
  faFacebookF,
  faInstagram,
  faLinkedinIn,
  faXTwitter,
  faYoutube,
} from "@fortawesome/free-brands-svg-icons";
import { useSubmitContactInfo } from "@/hooks/submitContacts";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingThree, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedHeadingSix, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedNextLink, TranslatedInput, TranslatedTextarea, TranslatedLink } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";
import GetStartedButton from "@/components/re-used/GetStartedButton";
import { Col, Container, Row } from "react-bootstrap";
import { FaFacebook, FaLinkedin, FaYoutube } from "react-icons/fa";
import { FaSquareXTwitter, FaXTwitter } from "react-icons/fa6";
const initialState = {
  fullName: "",
  mobile: "",
  email: "",
  message: "",
  error: {
    fullName: "",
    mobile: "",
    email: "",
    message: "",
  },
};
const cleanPhone = (val) => {
  return val.replace(/[^\d]/g, "");
};

const ContactUsClient = () => {
  const [ischecked, setIsChecked] = useState(false);
  const [formState, setFormState] = useState(initialState);
  const [isLoading, setIsLoading] = useState(false);

  const formHandler = (e) => {
    let { name, value } = e.target;

    let err = { ...(formState.error || {}) };

    switch (name) {
      case "fullName":
        err.fullName = !/^[A-Za-z\s]{3,}$/.test(value) || value.trim().length < 3 ? '*Full name must be at least 3 characters' : ''
        break;
      case "mobile":
        const cleanedMobile = cleanPhone(value);
        err.mobile = (cleanedMobile.length >= 10 && cleanedMobile.length <= 15) ? "" : "*Must be between 10 and 15 digits";
        break;
      case "email":
        err.email = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
          value
        )
          ? ""
          : "*Invalid email format";
        break;
      case "message":
        err.message =
          value.trim().length < 20 ? "*Must be at least 20 characters long" : "";
        break;
      default:
        console.warn("Invalid field name");
    }

    setFormState((prevState) => ({
      ...prevState,
      [name]: value,
      error: err,
    }));
  };

  const ContactSubmitHandler = async (e) => {
    e.preventDefault();

    // Trigger validation for all fields on submit
    const err = {
      fullName: "",
      mobile: "",
      email: "",
      message: "",
    };

    if (!formState.fullName || formState.fullName.trim().length < 3) {
      err.fullName = "*Full name must be at least 3 characters";
    } else if (!/^[A-Za-z\s]{3,}$/.test(formState.fullName)) {
      err.fullName = "*Only letters and spaces allowed";
    }

    const cleanedMobile = cleanPhone(formState.mobile);
    if (!formState.mobile) {
      err.mobile = "*Phone number is required";
    } else if (cleanedMobile.length < 10 || cleanedMobile.length > 15) {
      err.mobile = "*Must be between 10 and 15 digits";
    }

    if (!formState.email) {
      err.email = "*Email is required";
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formState.email)) {
      err.email = "*Invalid email format";
    }

    if (!formState.message || formState.message.trim().length < 20) {
      err.message = "*Message must be at least 20 characters long";
    }

    setFormState((prevState) => ({
      ...prevState,
      error: err,
    }));

    if (err.fullName || err.mobile || err.email || err.message) {
      toast.error("Please correct the errors in the form before submitting.");
      return;
    }

    if (!ischecked) {
      toast.error("Please accept Terms of Service and Privacy Policy");
      return;
    }

    setIsLoading(true);
    try {
      // submit form 
      const payload = {
        "name": formState.fullName.trim(),
        "email": formState.email.trim(),
        "phoneNumber": cleanedMobile,
        "message": formState.message.trim()
      };
      const { type, message } = await useSubmitContactInfo(payload);

      if (type) {
        setFormState(initialState);
        setIsChecked(false);
        toast.success(message);
      }
      else toast.error(message);
    } catch (error) {
      console.error("Error submitting contact form:", error);
      toast.error("An error occurred while submitting the form. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <section className="breadcrum-sec-top py-80">
        <Container>
          <Row className="align-items-center">
            <Col lg={6}>
              <div className="bread-crum-inr-box text-lg-start text-center">
                <h1 className="text-capitalize mb-3 fs-2">Contact Us</h1>
                <p className="mb-0">At Taxsimba, we are committed to protecting your personal and financial data. Learn how we handle your
                  information securely and transparently.</p>
              </div>
            </Col>
            <Col lg={6}>
              <div className="breadcrum-img text-center">
                <img src="/images/Contact-bread.png" alt="Breadcrumb Image" className="img-fluid" />
              </div>
            </Col>
          </Row>
        </Container>
      </section>
      <section className="contact_us">
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <div className="contact_dtls_part">
                <div className="global_heading">
                  <h2>
                    <em> <TranslatedText>
                      Contact Us
                    </TranslatedText>
                    </em>
                    <TranslatedText>
                      Let’s discuss your tax project
                    </TranslatedText>
                  </h2>
                </div>
                <div className="contact_bx">
                  <ul>

                    <li>
                      <span className="icn_ctct">
                        <img src="/images/icn_call.png" alt="" />
                      </span>
                      <span className="cntct_inner_dtls">
                        <TranslatedHeadingSix>Connect</TranslatedHeadingSix>
                        <a href="tel:+442038861234">+44 (0)20 3886 1234</a>
                      </span>
                    </li>
                    <li>
                      <span className="icn_ctct">
                        <img src="/images/icn_email.png" alt="" />
                      </span>
                      <span className="cntct_inner_dtls">
                        <TranslatedHeadingSix>Email Us</TranslatedHeadingSix>
                        <a href="mailto:Info@taxsimba.co.uk">
                          Info@taxsimba.co.uk
                        </a>
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="contact_follow_us">
                  <TranslatedHeadingFour>Follow Us on Social Media</TranslatedHeadingFour>
                  <ul className="social">
                    <li>
                      <a
                        href="https://www.facebook.com/profile.php?id=61583470161019"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaFacebook />
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.youtube.com/@TaxSimba"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaYoutube />
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.linkedin.com/company/taxsimba/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaLinkedin />
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://x.com/TaxSimba"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaXTwitter />
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="sign_in_form_part ">
                <h3 className="mb-3">Send Us A Message</h3>
                <form
                  noValidate
                  onSubmit={(e) => {
                    ContactSubmitHandler(e);
                  }}
                >
                  <div className="sign_in_form">
                    <div className="form_row">
                      <TranslatedInput
                        type="text"
                        name="fullName"
                        value={formState.fullName}
                        placeholder="Your Full Name"
                        onChange={formHandler}
                        autoComplete="name"
                        required
                      />
                      <span className="error_msg error_msg_color">
                        {formState?.error?.fullName}
                      </span>
                    </div>
                    <div className="form_row">
                      <TranslatedInput
                        type="tel"
                        name="mobile"
                        placeholder="Your Phone Number"
                        value={formState.mobile}
                        onChange={formHandler}
                        maxLength="15"
                        autoComplete="tel"
                        required
                      />
                      <span className="error_msg error_msg_color">
                        {formState?.error?.mobile}
                      </span>
                    </div>
                    <div className="form_row">
                      <TranslatedInput
                        type="email"
                        name="email"
                        placeholder="Your Email Id"
                        value={formState.email}
                        onChange={formHandler}
                        autoComplete="email"
                        required
                      />
                      <span className="error_msg error_msg_color">
                        {formState?.error?.email}
                      </span>
                    </div>
                    <div className="form_row">
                      <TranslatedTextarea
                        name="message"
                        placeholder="Enter your message..."
                        value={formState.message}
                        onChange={formHandler}
                        required
                      />
                      <span className="error_msg error_msg_color">
                        {formState?.error?.message}
                      </span>
                    </div>
                    <div className="remember_me">
                      <label className="cl-checkbox">
                        <input
                          type="checkbox"
                          checked={ischecked}
                          onChange={(e) => setIsChecked(e.target.checked)}
                          required
                        />
                        <span>
                          <TranslatedText>I accept</TranslatedText>&nbsp;
                          <TranslatedNextLink href="/terms-and-conditions" target="_blank">Terms Of Service</TranslatedNextLink>
                          &nbsp;<TranslatedText>and</TranslatedText>&nbsp;
                          <TranslatedNextLink href="/privacy-policy" target="_blank">Privacy Policy.</TranslatedNextLink>
                        </span>
                      </label>
                    </div>
                    <div className="form_btn_row">
                      <TranslatedButton className="common-btn w-100" disabled={isLoading}>
                        {isLoading ? "Submitting..." : "Submit Message"}
                      </TranslatedButton>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

    </>
  );
};

export default ContactUsClient;
