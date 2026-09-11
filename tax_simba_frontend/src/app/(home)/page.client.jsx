"use client";
import { getCurrencySymbol } from '@/utils/commonHelper';
import toast from 'react-hot-toast';

import axios from 'axios';
import { useSession } from 'next-auth/react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from 'react';
import { Accordion, Button, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { FaCheck, FaCheckCircle, FaChevronLeft, FaChevronRight, FaMinus, FaStar } from "react-icons/fa";
import { FiMail, FiPhone, FiUser } from "react-icons/fi";
import { GoArrowUpRight } from "react-icons/go";
import { IoLockClosedOutline, IoStar } from "react-icons/io5";
import { MdDoubleArrow, MdKeyboardDoubleArrowRight, MdOutlineCheckCircle } from "react-icons/md";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import RegisterApi from '@/app/lib/api';
import Modal from 'react-bootstrap/Modal';
const PageClient = () => {
  const [showOne, setShowOne] = useState(false);
  const handleCloseOne = () => setShowOne(false);
  const handleShowOne = () => setShowOne(true);
  const router = useRouter();
  const { data: session, status } = useSession();
  const [showAlert, setShowAlert] = useState(false);
  const [open, setOpen] = useState(false);
  const [blogs, setBlogs] = useState([]);
  const [totalBlogs, setTotalBlogs] = useState(0);
  const [loadingBlogs, setLoadingBlogs] = useState(true);

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/';
        const response = await axios.get(`${apiUrl}resources/blogs?limit=3&type=TaxSimba`);
        if (response.data && Array.isArray(response.data.data?.articles)) {
          setBlogs(response.data.data.articles.slice(0, 3));
          setTotalBlogs(response.data.data.pagination?.total || response.data.data.articles.length);
        } else if (response.data && Array.isArray(response.data.data)) {
          setBlogs(response.data.data.slice(0, 3));
          setTotalBlogs(response.data.data.length);
        }
      } catch (error) {
        console.error("Error fetching blogs:", error);
      } finally {
        setLoadingBlogs(false);
      }
    };
    fetchBlogs();
  }, []);

  const [customerReviews, setCustomerReviews] = useState([]);
  const [loadingCustomerReviews, setLoadingCustomerReviews] = useState(true);

  const fallbackCustomerReviews = [
    {
      id: 1,
      name: "James R.",
      role: "Freelance Photographer",
      rating: 5,
      text: "TaxSimba made my tax return very easy. I finished it quickly."
    },
    {
      id: 2,
      name: "Sarah L.",
      role: "Self-Employed Designer",
      rating: 5,
      text: "The steps were clear and simple. I was done in no time at all!"
    },
    {
      id: 3,
      name: "Amit P.",
      role: "Sole Trader",
      rating: 5,
      text: "A very easy way to complete my tax return. Highly recommended."
    },
    {
      id: 4,
      name: "Rachel M.",
      role: "Online Retailer",
      rating: 5,
      text: "I run a small Etsy shop and wasn't sure where to start. These guys made self-assessment simple!"
    },
    {
      id: 5,
      name: "Oliver H.",
      role: "E-commerce Seller",
      rating: 5,
      text: "Super efficient and professional. Spotted deductions I missed and saved me money."
    },
    {
      id: 6,
      name: "Emma S.",
      role: "Content Writer",
      rating: 5,
      text: "Very professional service. Handled my rental income tax return without any hassle."
    }
  ];

  useEffect(() => {
    const fetchCustomerReviews = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/';
        const response = await axios.post(`${apiUrl}reviews/approved`, {
          filter: 'approved',
          page: 1,
          limit: 10,
        });
        const reviewsData = response.data?.data?.reviews || [];
        if (Array.isArray(reviewsData) && reviewsData.length > 0) {
          setCustomerReviews(reviewsData);
        }
      } catch (error) {
        console.error("Error fetching customer reviews:", error);
      } finally {
        setLoadingCustomerReviews(false);
      }
    };
    fetchCustomerReviews();
  }, []);

  const [aboutContent, setAboutContent] = useState([]);
  const [isMonthly, setIsMonthly] = useState(true);

  const [step, setStep] = useState("assessment");



  // MTD Eligibility Checker Logic start


  const [income, setIncome] = useState("");
  const [resultType, setResultType] = useState("");

  const [registerFormData, setRegisterFormData] = useState({
    name: "",
    surname: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    userRole: "TAXSIMBA",
  });
  const [apiErrorMsg, setApiErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleContinueToRegister = (e) => {
    if (e) e.preventDefault();
    if (!registerFormData.name) {
      toast.error("Please enter your first name");
      return;
    }
    if (!registerFormData.surname) {
      toast.error("Please enter your surname");
      return;
    }
    if (!registerFormData.email) {
      toast.error("Please enter your email address");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(registerFormData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!registerFormData.mobile) {
      toast.error("Please enter your phone number");
      return;
    }
    setStep("register");
  };

  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!registerFormData.password) {
      toast.error("Please enter your password");
      return;
    }
    if (registerFormData.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    if (!registerFormData.confirmPassword) {
      toast.error("Please confirm your password");
      return;
    }
    if (registerFormData.password !== registerFormData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const { response, error } = await RegisterApi(registerFormData);
      if (response && (response.status === 200 || response.status === 201)) {
        toast.success(response.data.message || "Registration successful");
        setStep("login");
      } else if (error) {
        toast.error(error?.response?.data?.message || "Registration failed");
        setApiErrorMsg(error?.response?.data?.message);
      }
    } catch (err) {
      toast.error("An error occurred during registration");
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = () => {
    const value = Number(income);


    if (!value || value <= 0) {
      toast.error("Please enter valid income");
      return;
    }


    if (value >= 1 && value <= 49000) {
      setResultType("green");
    } else if (value >= 50000) {
      setResultType("warning");
    }
  };

  const handleReset = (e) => {
    e.preventDefault();
    setIncome("");
    setResultType("");
  };
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [currentPlanStatus, setCurrentPlanStatus] = useState(null);
  const [currentPlanEndDate, setCurrentPlanEndDate] = useState(null);

  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await axios.get(`${apiUrl}faqs`);
        if (response.data?.data?.Faqs) {
          setFaqs(response.data.data.Faqs);
        } else if (Array.isArray(response.data?.data)) {
          setFaqs(response.data.data);
        } else if (Array.isArray(response.data)) {
          setFaqs(response.data);
        }
      } catch (error) {
        console.error("Error fetching FAQs:", error);
      } finally {
        setLoadingFaqs(false);
      }
    };
    fetchFaqs();
  }, []);
  const currentFaqs = faqs.slice(0, 5);

  useEffect(() => {
    const fetchCurrentPlan = async () => {
      if (status === "authenticated" && session?.accessToken) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          const response = await axios.post(`${apiUrl}auth/get-account-details`, {}, {
            headers: { Authorization: `Bearer ${session.accessToken}` }
          });
          if (response.data?.data?.subscription) {
            setCurrentPlanId(response.data.data.subscription.planId);
            setCurrentPlanStatus(response.data.data.subscription.status);
            setCurrentPlanEndDate(response.data.data.subscription.endDate);
          }
        } catch (error) {
          console.error("Error fetching account details:", error);
        }
      }
    };
    const fetchPlans = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await axios.get(`${apiUrl}subscription-plans?category=taxSimba`);
        if (response.data && Array.isArray(response.data.data)) {
          setSubscriptionPlans(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching subscription plans:", error);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
    fetchCurrentPlan();
  }, [status, session]);

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const handleToggle = (monthly) => (e) => {
    e.preventDefault();
    setIsMonthly(monthly);
  };

  return (

    <>
      {/* Banner Section Start */}
      <section className="banner-area mx-lg-3 mx-0 position-relative px-3 px-lg-0">
        <Container>
          <Row>
            <Col lg={6}>
              <div className="banner-cont">
                <h6 className="banner_span">Join Today – <span> Upto 50% Off</span></h6>
                <h1>
                  <span>Tax return? Done.</span> <br />
                </h1>
                <h2>Expert filing for <span>£119.</span></h2>
                <p className="mb-0">Managed by an expert accountant. Simple, fast, and accurate.</p>
                <div className="banner-btn d-flex align-items-center gap-2 flex-wrap mt-4">
                  <Link href="/register" className="glowing-button">
                    Get Started <MdKeyboardDoubleArrowRight />
                  </Link>
                </div>

                <ul className='banner-bottom-list  list-unstyled d-flex align-item-center flex-wrap gap-3 w-100 mt-4 pt-3 justify-content-lg-start justify-content-center'>
                  <li className='text-white '><img src="/images/check-icon.png" alt="img" className='me-2' />HMRC Recognised</li>
                  <li className='text-white '><img src="/images/locks.png" alt="img" className='me-2' />GDPR Compliant</li>
                  <li className='text-white '><img src="/images/phone.png" alt="img" className='me-2' />UK-Based Support</li>

                </ul>
              </div>
            </Col>
            <Col lg={6} className="position-relative">
              <div className='banner-right-box'>
                <div className="banner-top-img">
                  <img
                    src={"/images/banner-top-img.png"}
                    className="shape"
                    alt="Shape"
                  />
                </div>

                <div className="banner-bottom-left-img">
                  <img src="/images/banner-left-img.png" alt="" className="slide-left-to-right" />
                  <img src="/images/banner-right-img.png" alt="" className="slide-right-to-left" />
                </div>

                <div className="banner-bottom-img">
                  <img
                    src={"/images/banner-bottom-img.png"}
                    className="shape"
                    alt="Shape"
                  />
                </div>

                <div className="banner-image p-0">
                  <img
                    src={"/images/banner-img.png"}
                    alt="Banner Image"
                    className="img-fluid slide-bottom-to-top"
                  />
                </div>

              </div>
            </Col>
          </Row>
        </Container>
      </section>
      {/* Banner Section End */}

      {/* Trusted Section Start  */}
      <section className="trusted-sec ptb-80 bg-transparent">
        <Container>
          <div className="common-title text-center mb-lg-5 mb-4">
            <h2>The trusted choice for <span>1,000+ UK</span> taxpayers.</h2>
          </div>

          <div className="trusted-logo-list d-lg-flex d-none align-items-center justify-content-center gap-lg-5 gap-3 flex-wrap">
            <div className="trusted-logo-card">
              <img src="/images/trust-1.png" alt="Trusted Logo" />
            </div>
            <div className="trusted-logo-card">
              <img src="/images/trust-2.png" alt="Trusted Logo" />
            </div>
            <div className="trusted-logo-card">
              <img src="/images/trust-3.png" alt="Trusted Logo" />
            </div>
            <div className="trusted-logo-card">
              <img src="/images/trust-4.png" alt="Trusted Logo" />
            </div>
          </div>

          <Swiper
            className="mySwiper d-lg-none d-block"
            spaceBetween={30}
            slidesPerView={3}
            modules={[Autoplay]}
            autoplay={{
              delay: 2500,
              disableOnInteraction: false,
            }}
            loop={true}
            breakpoints={{
              320: {
                slidesPerView: 1,
                spaceBetween: 20,
              },
              767: {
                slidesPerView: 2,
                spaceBetween: 40,
              },
              991: {
                slidesPerView: 4,
                spaceBetween: 50,
              },
            }}
          >
            <SwiperSlide>
              <div className="trusted-logo-card text-center">
                <img src="/images/trust-1.png" alt="Trusted Logo" />
              </div>
            </SwiperSlide>
            <SwiperSlide>
              <div className="trusted-logo-card text-center">
                <img src="/images/trust-2.png" alt="Trusted Logo" />
              </div>
            </SwiperSlide>
            <SwiperSlide>
              <div className="trusted-logo-card text-center">
                <img src="/images/trust-3.png" alt="Trusted Logo" />
              </div>
            </SwiperSlide>
            <SwiperSlide>
              <div className="trusted-logo-card text-center">
                <img src="/images/trust-4.png" alt="Trusted Logo" />
              </div>
            </SwiperSlide>
            <SwiperSlide>
              <div className="trusted-logo-card text-center">
                <img src="/images/trust-1.png" alt="Trusted Logo" />
              </div>
            </SwiperSlide>
            <SwiperSlide>
              <div className="trusted-logo-card text-center">
                <img src="/images/trust-2.png" alt="Trusted Logo" />
              </div>
            </SwiperSlide>
          </Swiper>

          <div className="trustred-bottom-txt text-center mt-5">
            <h6> Everything you need to manage complex tax returns with confidence.
              <br />
              <span>fast, expert-backed Self Assessments</span></h6>
          </div>
        </Container>
      </section>
      {/* Trusted Section End  */}

      <section className="comparison-section">
        <Container>
          <div className="common-title text-center mb-lg-5 mb-4">
            <h2>  Better value. <span>Expert results.</span> </h2>
            <p className="mb-0">See how we compare to the competition on price, speed, and service.</p>
          </div>
          <Row>
            <Col lg={10} className="mx-auto">
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th className="feature-col">Feature</th>
                      <th className="brand-col text-center">Taxsimba</th>
                      {/* <th className="text-center">Taxfix (TaxScouts)</th> */}
                      <th className="text-center">Other Platforms</th>

                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td data-label="Feature">All-Inclusive Fixed Fee</td>
                      <td data-label="Taxsimba" className="brand-col text-center price">
                        £119
                      </td>
                      <td data-label="Taxfix" className="text-center price">£169</td>
                    </tr>

                    <tr>
                      <td data-label="Feature">Expert Accountant Review</td>
                      <td className="brand-col text-center icon-yes">
                        <FaCheck />
                      </td>
                      <td className="text-center icon-yes">
                        <FaCheck />
                      </td>
                    </tr>

                    <tr>
                      <td data-label="Feature">48-hours Turnaround</td>
                      <td className="brand-col text-center icon-yes">
                        <FaCheck />
                      </td>
                      <td className="text-center icon-no">
                        <FaMinus />
                      </td>
                    </tr>

                    <tr>
                      <td data-label="Feature">Unlimited Expert Support</td>
                      <td className="brand-col text-center icon-yes">
                        <FaCheck />
                      </td>
                      <td className="text-center icon-no">
                        <FaMinus />
                      </td>
                    </tr>

                    <tr>
                      <td data-label="Feature">No Hidden Extra Costs</td>
                      <td className="brand-col text-center icon-yes">
                        <FaCheck />
                      </td>
                      <td className="text-center icon-no">
                        <FaMinus />
                      </td>
                    </tr>
                    <tr>
                      <td data-label="Feature">Simple, Stress-Free Filing</td>
                      <td className="brand-col text-center icon-yes">
                        <FaCheck />
                      </td>
                      <td className="text-center icon-no">
                        <FaMinus />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Col>
          </Row>

        </Container>
      </section>



      {/* CTA Section Start */}
      <section className="cta-main bottom-cta mobile-cta ptb-80">
        <Container>
          <div className="cta-inner">
            <Row>
              <Col lg={12}>
                <div className="cta-cont text-center">
                  <div className="stop-stressing-content text-center">
                    <h2 className="text-lt-theme">
                      <span>  Share your details. </span> Choose your plan. <br className="d-lg-block d-none" /> Connect with your dedicated accountant.
                    </h2>
                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mt-4">
                      <Link href="/register" className="common-btn">
                        Get Started <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                      </Link>
                      {/* <Link href="https://simbax.toxsl.in/" className="common-btn-outline" target="_blank">
                        Start using TaxSimba <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                      </Link> */}
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </section>

      <section className="home-plan-sec ptb-80 mx-lg-3 mx-0">
        <Container>
          <div className="common-title text-center mb-lg-5 mb-4">

            <h2 className="plan-heading">  <span> Find the right Package  </span> for  your Tax Return </h2>
            <p className="mb-0 text-white">Built for landlords, sole traders, and those with multiple income streams.</p>

          </div>
          <div className="card-price-plan">
            <Row className="justify-content-center">
              {loadingPlans ? (
                <Col xs={12} className="text-center py-5">
                  <div className="spinner-border text-light" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </Col>
              ) : subscriptionPlans.length > 0 ? (
                subscriptionPlans.map((plan) => {
                  const isCurrent = currentPlanId === plan.id;
                  const isCanceled = isCurrent && currentPlanStatus?.toLowerCase() === 'canceled';
                  const getRemainingDays = (dateStr) => {
                    if (!dateStr) return 0;
                    const diff = new Date(dateStr) - new Date();
                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    return days > 0 ? days : 0;
                  };
                  const remainingDays = getRemainingDays(currentPlanEndDate);

                  return (
                    <Col key={plan.id} lg={4} md={6} sm={12} xs={12} className="mb-lg-0 mb-4">
                      <div
                        className={`${plan.isPopular
                          ? "popular-card home-plan-card plan-card-white"
                          : "home-plan-card plan-card-white"
                          } ${isCurrent ? "active-plan-border" : ""} position-relative`}
                      >
                        {isCurrent && (
                          <div className="current-plan-ribbon-wrapper">
                            <div className={`current-plan-ribbon ${isCanceled ? 'bg-danger text-white border-danger' : ''}`}>
                              {isCanceled ? 'Canceled Plan' : 'Current Plan'}
                            </div>
                          </div>
                        )}
                        <h4 className="d-flex align-items-center gap-2 flex-wrap">
                          {plan.name}
                        </h4>
                        {plan.isPopular && (
                          <div className="popular-badge-simple">
                            <FaStar size={11} /> Most Popular
                          </div>
                        )}
                        <h3>
                          {plan.originalPrice && (
                            <del className="me-2">
                              {getCurrencySymbol(plan.currency)}{plan.originalPrice}
                            </del>
                          )}
                          <span className="price-main">
                            {getCurrencySymbol(plan.currency)}{plan.price}
                          </span>
                          {plan.savePercentage > 0 && <span className="off-tag ms-2">Save {plan.savePercentage}%</span>}
                        </h3>
                        <p>{plan.description || "Perfect for individuals and businesses."}</p>
                        <ul className="home-plan-list">
                          {Array.isArray(plan.features) && plan.features.map((feature, idx) => (
                            <li key={idx}><MdOutlineCheckCircle />{feature}</li>
                          ))}
                        </ul>
                        <div className="mt-auto pt-3">
                          <Button
                            className={`w-100 ${isCanceled ? 'common-btn' : isCurrent ? 'btn-outline-success bg-white text-success border-success' : 'common-btn'}`}
                            style={{
                              height: '48px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700',
                              borderRadius: '8px'
                            }}
                            onClick={() => {
                              if (isCanceled) {
                                router.push(`/planlist/${plan.id}`);
                              } else if (isCurrent) {
                                router.push("/dashboard/my-subscriptions");
                              } else if (status === "authenticated") {
                                router.push(`/planlist/${plan.id}`);
                              } else {
                                router.push(`/register`);
                              }
                            }}
                          >
                            {isCanceled ? <>Buy Again {remainingDays > 0 ? `(${remainingDays} Days Left)` : ''} <FaChevronRight className="ms-1" /></> : isCurrent ? <>Cancel Subscription</> : <>Select Plan <FaChevronRight className="ms-1" /></>}
                          </Button>
                        </div>
                      </div>
                    </Col>
                  )
                })
              ) : (
                <Col xs={12} className="text-center py-5">
                  <p className="text-white">No active subscription plans found.</p>
                </Col>
              )}
            </Row>
          </div>
        </Container>
      </section>


      <section className="start-simbox-sec step-sec-home step-sec-home-main ptb-80 position-relative">
        <Container>
          <div className="common-title text-md-start text-center mb-lg-5 mb-4">
            <h2>How <span> TaxSimba Works</span></h2>
            <p>Your tax return, managed by a UK professional.</p>
          </div>
          <Row>
            <Col lg={3} className="mb-lg-0 mb-4">
              <div className="start-simbox-card">
                <div className="start-simbax-img">
                  <img src="/images/work-1.png" alt="img" />
                </div>
                <div className="start-simbax-dis">
                  <span className="start-count">
                    1
                  </span>
                  <h4>Sign up</h4>
                  <p>Sign up and get started in minutes.</p>

                </div>

              </div>
            </Col>
            <Col lg={3} className="mb-lg-0 mb-4">
              <div className="start-simbox-card">
                <div className="start-simbax-img">
                  <img src="/images/work-2.png" alt="img" />
                </div>
                <div className="start-simbax-dis">
                  <span className="start-count">
                    2
                  </span>
                  <h4>Add Details</h4>
                  <p>Enter your income and expenses.</p>

                </div>

              </div>
            </Col>
            <Col lg={3} className="mb-lg-0 mb-4">
              <div className="start-simbox-card">
                <div className="start-simbax-img">
                  <img src="/images/work-3.png" alt="img" />
                </div>
                <div className="start-simbax-dis">
                  <span className="start-count">
                    3
                  </span>
                  <h4>Expert Review</h4>
                  <p>We assign an accountant to prepare your return.</p>
                </div>
              </div>
            </Col>
            <Col lg={3} className="mb-lg-0 mb-4">
              <div className="start-simbox-card">
                <div className="start-simbax-img">
                  <img src="/images/work-4.png" alt="img" />
                </div>
                <div className="start-simbax-dis">
                  <span className="start-count">
                    4
                  </span>
                  <h4>Submit to HMRC</h4>
                  <p>Send your return securely and receive confirmation.</p>
                </div>
              </div>
            </Col>
          </Row>
          <div className="text-center mt-5 work-bottom-text">
            <p className="mb-0">Join <b>1,000+ people in the UK</b> who trust TaxSimba.</p>
          </div>
        </Container>
      </section>
      {/* How Work Section End */}

      {/* Assessment Section Start  */}
      <section className="assessment-sec assessment-sec-home ptb-80 mx-lg-3 mx-0">
        <Container>
          <Row className="align-items-center">
            <Col lg={7}>
              <div className="assessment-left-box pe-lg-5 pe-0">
                <div className="main-title mb-4 p-0">
                  <h2 className='text-start'><span>Tax returns in minutes.</span><br className="d-lg-block d-none" /> No expert knowledge <br className="d-lg-block d-none" /> required.</h2>
                  <p className="text-white mt-lg-4 mt-2">TaxSimba replaces complex forms with simple, guided questions. We build
                    your return, you just hit submit.</p>
                </div>
                <ul className="assessment-list list-unstyled">
                  <li><span className="me-2"><FaCheckCircle /></span><b>Zero Jargon</b> No confusing tax language. Ever.</li>
                  <li><span className="me-2"><FaCheckCircle /></span><b>Guided Support</b> Simple, step-by-step onboarding.</li>
                  <li><span className="me-2"><FaCheckCircle /></span><b>Direct Filing</b> Secure submission straight to HMRC.</li>
                </ul>
              </div>
            </Col>
            <Col lg={5}>
              <div className="form-wrapper">
                <div className="custom-card-frame">

                  {/* ================= STEP 1 ================= */}
                  {step === "assessment" && (
                    <div className="self-form text-center">
                      <h2 className="form-header-title">
                        Start Your <span className="text-highlight"><br /> Self Assessment</span>
                      </h2>

                      <p className="form-header-subtitle">
                        Begin your secure, HMRC-compliant filing process in minutes.
                      </p>

                      <Form className="custom-form" onSubmit={handleContinueToRegister}>

                        <div className="input-icon-group">
                          <FiUser className="input-icon" />
                          <Form.Control
                            type="text"
                            placeholder="Your First name"
                            className="custom-input"
                            name="name"
                            value={registerFormData.name}
                            onChange={handleRegisterChange}
                          />
                        </div>

                        <div className="input-icon-group">
                          <FiUser className="input-icon" />
                          <Form.Control
                            type="text"
                            placeholder="Your Surname"
                            className="custom-input"
                            name="surname"
                            value={registerFormData.surname}
                            onChange={handleRegisterChange}
                          />
                        </div>

                        <div className="input-icon-group">
                          <FiMail className="input-icon" />
                          <Form.Control
                            type="email"
                            placeholder="Your Email Address"
                            className="custom-input"
                            name="email"
                            value={registerFormData.email}
                            onChange={handleRegisterChange}
                          />
                        </div>

                        <div className="input-icon-group">
                          <FiPhone className="input-icon" />
                          <Form.Control
                            type="tel"
                            placeholder="Your Phone Number"
                            className="custom-input"
                            name="mobile"
                            value={registerFormData.mobile}
                            onChange={handleRegisterChange}
                          />
                        </div>

                        <div className="mt-3 assement-btn">
                          <button
                            type="submit"
                            className="common-btn w-100"
                          >
                            Start Now – Takes 2 Minutes
                            <MdDoubleArrow className="btn-icon-right" />
                          </button>
                        </div>

                      </Form>
                    </div>
                  )}

                  {/* ================= STEP 2 ================= */}
                  {step === "register" && (
                    <div className="register-form text-center">
                      <div className="relative mb-3">
                        <button onClick={() => setStep("assessment")} className='position-absolute start-0 mt-1 mb-0 h4 bg-transparent p-0 cursor-pointer'>
                          <FaChevronLeft />
                        </button>
                        <h2 className="form-header-title mb-0">
                          Register <span className="text-highlight"> Now</span>
                        </h2>
                      </div>

                      <Form className="custom-form" onSubmit={handleRegisterSubmit}>

                        <div className="input-icon-group">
                          <IoLockClosedOutline className="input-icon" />
                          <Form.Control
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter Your Password"
                            className="custom-input"
                            name="password"
                            value={registerFormData.password}
                            onChange={handleRegisterChange}
                          />
                          <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(prev => !prev)} style={{ background: "transparent", border: "none", position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)" }}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>

                        <div className="input-icon-group">
                          <IoLockClosedOutline className="input-icon" />
                          <Form.Control
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm Your Password"
                            className="custom-input"
                            name="confirmPassword"
                            value={registerFormData.confirmPassword}
                            onChange={handleRegisterChange}
                          />
                          <button type="button" className="password-toggle-btn" onClick={() => setShowConfirmPassword(prev => !prev)} style={{ background: "transparent", border: "none", position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)" }}>
                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>

                        <div className="mt-3 assement-btn">
                          <button
                            type="submit"
                            className="common-btn w-100"
                            disabled={loading}
                          >
                            {loading ? "Registering..." : "Register"}
                            <MdDoubleArrow className="btn-icon-right" />
                          </button>
                        </div>

                        <p className="register-form-footer-text text-capitalize text-green mt-3">
                          no spam, your details are secure
                        </p>

                      </Form>
                    </div>
                  )}

                  {/* ================= STEP 3 ================= */}
                  {step === "login" && (
                    <div className="login-form text-center">
                      <div className="relative mb-3">
                        <button onClick={() => setStep("register")} className='position-absolute start-0 mt-1 h4 mb-0 bg-transparent p-0 cursor-pointer'>
                          <FaChevronLeft />
                        </button>
                        <h2 className="form-header-title mb-0">
                          Verification link <span className="text-green"> send to your email.</span>
                        </h2>
                      </div>

                      <div className="assement-btn">
                        <Link href="/login" className="common-btn d-inline-block w-100">
                          Login
                          <MdDoubleArrow className="btn-icon-right" />
                        </Link>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section >

      <section className="cta-main bottom-cta mobile-cta ptb-80">
        <Container>
          <div className="cta-inner">
            <Row>
              <Col lg={12}>
                <div className="cta-cont text-center">
                  <div className="stop-stressing-content text-center">
                    <div className="mb-3 cta-img-box">
                      <img src="/images/cta-logo.png" alt="" />
                    </div>
                    <h2 className="text-lt-theme">
                      See how to complete your tax return <span> step by step </span>
                    </h2>
                    <p className="mt-1">
                      Watch a quick walkthrough of how it works
                    </p>
                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mt-4">
                      <button className="common-btn" onClick={handleShowOne}>
                        Watch now <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                      </button>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </section>
      {/* watch video section end */}


      {/*  */}


      <section className="role-sec ptb-80 mx-lg-3 mx-0">
        <Container>
          <div className="common-title text-center mb-lg-5 mb-4">
            <h2>Who  <span> we help.</span> </h2>
            <p>From landlords to high earners, we take the stress out of your tax return.</p>
          </div>
          <div className="role-inr-box">
            <Row>
              <Col xl={4} lg={6} className="mb-xl-0 mb-4">
                <div className="role-box">
                  <div className="role-img">
                    <img src="/images/hand.png" alt="img" />
                  </div>
                  <div className="role-dis mt-4">
                    <h4>Individual Professionals</h4>
                    <ul className="role-disc-list mt-3">
                      <li> <span className="me-2"><FaCheckCircle /></span> Self-Employed & Sole Traders </li>
                      <li> <span className="me-2"><FaCheckCircle /></span> Freelancers & Side Hustlers </li>
                      <li> <span className="me-2"><FaCheckCircle /></span> Couriers, Riders & Drivers </li>
                      <li> <span className="me-2"><FaCheckCircle /></span> Construction Workers (CIS) </li>
                      <li> <span className="me-2"><FaCheckCircle /></span> High Earners (£100k+) </li>
                    </ul>
                  </div>
                </div>
              </Col>
              <Col xl={4} lg={6} className="mb-xl-0 mb-4 d-lg-block d-none">
                <div className="role-box role-box-user">
                  {/* <div className="role-dis-first-box">
                    <div className="role-dis-first mt-4">
                      <h4>Freelancers</h4>
                    </div>
                  </div> */}
                </div>
              </Col>
              <Col xl={4} lg={6} className="mb-xl-0 mb-0">
                <div className="role-box">
                  <div className="role-img">
                    <img src="/images/store.png" alt="img" />
                  </div>
                  <div className="role-dis mt-4">
                    <h4>Specialized Income & Filers</h4>
                    <ul className="role-disc-list mt-3">
                      <li> <span className="me-2"><FaCheckCircle /></span> Landlords & Airbnb Hosts </li>
                      <li> <span className="me-2"><FaCheckCircle /></span> Crypto & Stock Investors </li>
                      <li> <span className="me-2"><FaCheckCircle /></span> First-Time Filers </li>
                      <li> <span className="me-2"><FaCheckCircle /></span> Living Abroad with UK Income </li>
                      <li> <span className="me-2"><FaCheckCircle /></span> Tax Refund Claimants </li>
                    </ul>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </section>

      <section className="features-sec ptb-80">
        <Container>
          <div className="features-inr-box">
            <Row className="align-items-center">
              <Col lg={6} className="mt-lg-0 mt-4">
                <div className="features-right-box ps-lg-4 ps-0">
                  <div className="features-title-box text-left mb-4">
                    <span className="features-subtitle">#GetItDone</span>
                    <h2>Meet Your <span className="text-green">Tax Experts</span> </h2>
                    <p><b>Accountant-standard precision. 10+ years of UK expertise.</b><br />We handle the complexity, so you can focus on what matters.</p>
                    <ul className="features-inr-box-list mt-4">
                      <li> <span className="me-2"><FaCheckCircle /></span> <strong> 100% UK Experts | </strong> 100% UK-based tax experts.</li>
                      <li> <span className="me-2"><FaCheckCircle /></span> <strong> The Vetted Few | </strong> Only the top 1% of practitioners.</li>
                      <li> <span className="me-2"><FaCheckCircle /></span> <strong> Highly Rated | </strong> Trusted by a massive community of happy clients.</li>
                      <li> <span className="me-2"><FaCheckCircle /></span> <strong> Fully Certified | </strong> Certified by UK accounting bodies.</li>
                      <li> <span className="me-2"><FaCheckCircle /></span> <strong> Expert Audits | </strong> We verify every detail for total filing confidence.</li>
                    </ul>
                  </div>
                </div>
              </Col>
              <Col lg={6}>
                <div className="features-left-img text-lg-end text-start">
                  <img src="/images/expert-img.png" alt="img" className="img-fluid" />
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </section >
      {/* Feature Section End */}

      {/* What Customers Say Start */}
      <section className="customer-sec ptb-80 mx-lg-3 mx-0">
        <Container>
          <div className="common-title text-center mb-0">
            <h2>Loved by  <span> our customers </span> </h2>
            <p>Real feedback from people across the UK using TaxSimba.</p>
          </div>

          <div className="customer-slide">
            {(() => {
              const displayReviews = customerReviews.length > 0 ? customerReviews : fallbackCustomerReviews;
              return (
                <Swiper
                  slidesPerView={4}
                  spaceBetween={20}
                  modules={[Navigation]}
                  navigation={true}
                  loop={displayReviews.length >= 4}
                  breakpoints={{
                    320: { slidesPerView: 1 },
                    640: { slidesPerView: 1 },
                    768: { slidesPerView: 2 },
                    1024: { slidesPerView: 3 },
                    1200: { slidesPerView: 4 },
                  }}
                  className="custSwiper"
                >
                  {displayReviews.map((review, idx) => {
                    const name = review?.client?.name || review?.name || "Verified Client";
                    const text = review?.message || review?.text || "";
                    const rating = Number(review?.rating) || 5;

                    return (
                      <SwiperSlide key={review.id || review._id || idx}>
                        <div className="cust-card">
                          <p>"{text}"</p>
                          <div className="cust-name">
                            <h4>{name}</h4>
                            <ul className="cust-stars">
                              {[...Array(5)].map((_, starIdx) => (
                                <li key={starIdx}>
                                  <IoStar className={starIdx < rating ? "star-yellow" : "text-muted"} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </SwiperSlide>
                    );
                  })}
                </Swiper>
              );
            })()}
          </div>

        </Container>
      </section>
      {/* What Customers Say End */}


      {/* FAQ Section Start */}
      <section className="faq-section mobile-faq ptb-80">
        <Container>
          <Row>
            <Col lg={5} md={12} sm={12} xs={12}>
              <div className="common-title mb-lg-0 mb-4 px-0">
                <h2 className="text-start">UK Tax <span>FAQs.</span></h2>
              </div>

              <div className="faq-img">
                <img src="/images/faq-img.png" className="img-fluid" alt="faq-img" />
              </div>




            </Col>

            <Col lg={7} md={12} sm={12} xs={12}>
              <div className="faq-outer">
                {loadingFaqs ? (
                  <div className="text-center p-4">
                    <Spinner animation="border" variant="success" />
                  </div>
                ) : faqs.length > 0 ? (
                  <>
                    <Accordion defaultActiveKey="0">
                      {currentFaqs.map((faq, index) => (
                        <Accordion.Item eventKey={index.toString()} key={faq.id || index}>
                          <Accordion.Header>{faq.question || faq.q || faq.title || "FAQ"}</Accordion.Header>
                          <Accordion.Body>
                            <div dangerouslySetInnerHTML={{ __html: faq.answer || faq.a || faq.description || "Content not available." }} />
                          </Accordion.Body>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                    {faqs.length > 5 && (
                      <div className='see-more-btn mt-4 text-end'>
                        <Link href="/faq" className="common-btn">
                          See More <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center text-muted">No FAQs available at the moment.</p>
                )}
              </div>
            </Col>
          </Row>
        </Container>
      </section>
      {/* FAQ Section End */}

      {/* CTA Section Start */}
      <section className="cta-main bottom-cta-main mobile-cta ptb-80 pt-0">
        <Container>
          <div className="cta-inner">
            <Row>
              <Col lg={12}>
                <div className="cta-cont text-center">
                  <div className="stop-stressing-content text-center">
                    <h2 className="text-dark">
                      Expert help, when you need it.
                    </h2>
                    <p className="text-dark">
                      One question or a quick check, we’ve got you.
                    </p>
                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mt-4">
                      <Link href="/register" className="common-btn">
                        Ask Now <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                      </Link>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </section>
      {/* CTA Section End */}


      {/* Blog Section Start */}
      <section className="blog-sec ptb-80 pt-0">
        <Container>
          <div className="d-flex justify-content-between align-items-center flex-wrap mb-5">
            <div className="common-title mb-2">
              <h2><span>Guides</span> to help you with your tax return</h2>
              <p>Simple articles to help you understand tax, deadlines, and MTD.</p>
            </div>
            {totalBlogs > 3 && (
              <Link href="/blogs" className="view-all-btn">View All</Link>
            )}
          </div>
          <Row>
            {loadingBlogs ? (
              <Col className="text-center py-5">
                <Spinner animation="border" variant="success" />
              </Col>
            ) : blogs.length > 0 ? (
              blogs.map((blog, idx) => (
                <Col lg={4} className="mb-4" key={blog.id || idx}>
                  <div className="blog-card">
                    <Link href={blog.slug ? `/blogs/${blog.slug}` : "/blog-details"}>
                      <div className="blog-img">
                        <img src={blog.featuredImage || `/images/blog_${(idx % 3) + 1}.png`} alt={blog.title || "img"} />
                      </div>
                      <div className="blog-card-content mt-3">
                        <h4>{blog.title}</h4>
                        <p>{(() => {
                          const wordCount = (blog.excerpt || "").split(/\s+/).filter(Boolean).length;
                          return Math.max(1, Math.ceil(wordCount / 200));
                        })()} min read</p>
                      </div>
                    </Link>
                  </div>
                </Col>
              ))
            ) : (
              <Col className="text-center py-5">
                <p>No articles available yet.</p>
              </Col>
            )}
          </Row>
        </Container>
      </section>
      {/* Blog Section End */}

      {/* Process Section Start */}
      <section className="process-sec process-sec-home">
        <Container>
          <Row className="align-items-center">
            <Col lg={10} className="mx-auto">
              <div className="process-box d-flex align-items-center justify-content-center gap-xl-5 gap-3 flex-wrap">
                <div className="process-img">
                  <img className="img-fluid" src="/images/penality-img.png" alt="process-img" />
                </div>
                <div className="d-flex align-items-center gap-lg-5 gap-3 flex-wrap justify-content-md-start justify-content-center">
                  <div className="process-txt">
                    <h6 className="text-white">Submit Your Tax Return Before Penalties</h6>
                  </div>
                  <div className="process-btn">
                    <Link href='/register' className="common-btn text-capitalize ">Start Your Return <GoArrowUpRight className="ms-1" /></Link>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>
      {/* Process Section end */}

      <section className="easy-sec easy-sec-home easy-sec-home-new ptb-80">
        <Container>
          <div className="easy-content-main">
            <Row className="g-0">
              <Col className="p-0" lg={6} md={12} sm={12} xs={12}>
                <div className="easy-content-inner">
                  <h2>Are you ready for <span>Making Tax Digital?</span></h2>
                  <ul className="easy-list">
                    <li><MdOutlineCheckCircle />Keep digital records of your income and expenses.</li>
                    <li><MdOutlineCheckCircle />Submit quarterly updates to HMRC.</li>
                    <li><MdOutlineCheckCircle />Stay compliant and avoid unexpected penalties.</li>
                  </ul>
                  <Link href="/mtd-information" className="common-btn mt-4 d-inline-block">
                    Learn More About MTD  <MdKeyboardDoubleArrowRight className="ms-1" />
                  </Link>
                </div>
              </Col>
              <Col className="p-0" lg={6} md={12} sm={12} xs={12}>
                <div className="easy-img">
                  <img src="/images/mtd.jpg" alt="img" />
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </section>


      <Modal show={show} onHide={handleClose} className="video-modal-box" centered>
        <Modal.Header closeButton>
        </Modal.Header>
        <Modal.Body>
          <div className="video-box">
            <video controls autoPlay>
              <source src="/images/taxsimba.mp4" type="video/mp4" />
            </video>

          </div>
        </Modal.Body>
      </Modal>

      <Modal show={showOne} onHide={handleCloseOne} className="video-modal-box" centered>
        <Modal.Header closeButton>
          <Modal.Title>Modal heading</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="video-box">
            <video controls autoPlay>
              <source src="/images/taxsimba.mp4" type="video/mp4" />
            </video>

          </div>
        </Modal.Body>
      </Modal>

    </>

  )
}
export default PageClient
















