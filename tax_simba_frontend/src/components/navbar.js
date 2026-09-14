"use client";

import LanguageDropdown from "@/components/default/LanguageDropdown";
import { useTranslation } from "@/context/TranslationContext";
import { useFetchProfileData } from "@/hooks/fetchData";
import { useAxiosInstance } from "@/hooks/useAxiosInstance";
import { formatSlugToHref, useResourceCategories } from "@/hooks/useResourceCategories";
import { useTranslate } from "@/hooks/useTranslate";
import fetchJSON from "@/lib/fetchJSON";
import emitter from "@/utils/eventBus";
import { getBackendBaseUrl } from "@/utils/commonHelper";
import { faAngleDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AiFillDashboard } from "react-icons/ai";
import { Logout } from "../app/lib/api";
import { TranslatedLink, TranslatedParagraph } from "./TranslatedContent";
import { GrDashboard } from "react-icons/gr";
import { FiLogOut } from "react-icons/fi";
import { TbTax } from "react-icons/tb";
import { RiArrowLeftRightLine, RiCloseLargeFill, RiDashboard3Line } from "react-icons/ri";
import { IoNewspaperOutline } from "react-icons/io5";
import { FaFileInvoiceDollar, FaRegTrashAlt, FaRegUserCircle, FaBell, FaHistory } from "react-icons/fa";
import { PiKeyBold } from "react-icons/pi";
import { Col, Container, Offcanvas, Row } from "react-bootstrap";
import { GoArrowUpRight } from "react-icons/go";
import { MdLogout } from "react-icons/md";
import { FaArrowRightLong } from "react-icons/fa6";
import { FaCircleUser } from "react-icons/fa6";

const languages = [
  { code: "en", label: "En" },
  { code: "fr", label: "Fr" },
  { code: "es", label: "Es" },
];



const Navbar = () => {
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const [showOne, setShowOne] = useState(false);

  const handleCloseOne = () => setShowOne(false);
  const handleShowOne = () => setShowOne(true);

  const [showSubmenu, setShowSubmenu] = useState(false);
  const [showTopBar, setShowTopBar] = useState(true);

  const handleFeatureClick = (e) => {
    e.preventDefault();
    setShowSubmenu(!showSubmenu);
  };

  const handleCloseTopBar = () => {
    setShowTopBar(false);
  };


  const router = useRouter();
  const { get: apiGet } = useAxiosInstance();
  const [langOpen, setLangOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // default will be overwritten by localStorage in useEffect
  const [selectedLang, setSelectedLang] = useState(languages[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userData, setUserData] = useState({
    profilePhoto: "",
    firstName: "",
  });
  const langRef = useRef(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || "";
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken || null;
  const isMTD = session?.user?.userRole === 'MTD' || session?.user?.role === 'MTD';
  // Translation hook
  const { changeLanguage } = useTranslation();

  // Translate menu items
  const homeText = useTranslate("Home");
  const aboutText = useTranslate("About Us");
  const testimonialsText = useTranslate("Testimonials");
  const taxFilingText = useTranslate("Tax Filing");
  const contactUsText = useTranslate("Contact Us");
  const registrationText = useTranslate("Registration or Login");
  const dashboardText = useTranslate("Dashboard");
  const logoutText = useTranslate("Log Out");
  const taxFilling = useTranslate("Tax Filling");
  const taxAdvice = useTranslate("Tax Advice");
  const companyTaxes = useTranslate("Company Taxes");
  const resources = useTranslate("Resources");
  const servicesMenu = useTranslate("Services");
  const { data: resourceCategories, loading: resourcesLoading } = useResourceCategories();
  const [blogArticles, setBlogArticles] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [services, setServices] = useState([]);

  // get User Data
  const fetchUserDetails = async () => {
    if (status !== "authenticated" || !session?.accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { profilePhoto, firstName, provider } = await useFetchProfileData(session.accessToken);
      setUserData({
        profilePhoto: profilePhoto,
        firstName: firstName,
        provider: provider,
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
    } finally {
      setLoading(false);
    }
  };
  const fetchServices = async () => {
    setServicesLoading(true);
    try {
      const response = await apiGet("services");
      const serviceData = Array.isArray(response?.data?.data)
        ? response.data.data
        : [];

      const sorted = serviceData
        .slice()
        .sort(
          (a, b) =>
            (a?.displayOrder ?? Number.MAX_SAFE_INTEGER) -
            (b?.displayOrder ?? Number.MAX_SAFE_INTEGER)
        );

      setServices(sorted);
    } catch (error) {
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchUserDetails();
    const refresh = () => {
      fetchUserDetails();
      fetchServices();
    };
    emitter.on('user-updated', refresh);
    return () => {
      emitter.off('user-updated', refresh);
    };
  }, [session?.accessToken, status]);

  // initialize language from localStorage (fallback to 'en')
  useEffect(() => {
    try {
      const savedCode = localStorage.getItem("language") || "en";
      const lang = languages.find((l) => l.code === savedCode) || languages[0];
      setSelectedLang(lang);
      // inform translation context of the initial language
      changeLanguage(savedCode);
    } catch (e) {
      // ignore localStorage errors
      setSelectedLang(languages[0]);
      changeLanguage(languages[0].code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      const target = e.target;
      if (
        !document.getElementById("dropdownMenuButton")?.contains(target) &&
        !document.querySelector(".dropdown-menu")?.contains(target)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    const loadBlogArticles = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/";
        const url = new URL("resources/blogs", apiBase).toString();
        const res = await fetchJSON(url, { next: { revalidate: 0 } });
        setBlogArticles(Array.isArray(res?.data?.articles) ? res.data.articles : []);
      } catch (err) {
        console.error("Failed to load blog articles", err);
        setBlogArticles([]);
      }
    };

    loadBlogArticles();
  }, []);

  function toggleLangDropdown(e) {
    e.stopPropagation();
    setLangOpen((prev) => !prev);
  }

  function selectLanguage(lang) {
    setSelectedLang(lang);
    try {
      localStorage.setItem("language", lang.code);
    } catch (e) {
      console.error("Could not save language to localStorage", e);
    }
    changeLanguage(lang.code);
    setLangOpen(false);
  }

  const handleLoginLogout = () => {
    if (pathname === '/login') {
      router.push('/register')
    } else if (pathname === '/register') {
      router.push('/login')
    } else {
      router.push('/login');
    }
  }

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const toggleClass = () => {
    setIsMenuOpen(!isMenuOpen);
  }

  const [activeMenu, setActiveMenu] = useState(pathname);

  const [isMobile, setIsMobile] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  // Highlight "Resources" in the nav when on any Resources sub-page
  const isResourcesActive =
    pathname === "/blogs" ||
    pathname.startsWith("/blogs/") ||
    pathname === "/mtd-information";

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 991);
    checkScreen();

    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);




  useEffect(() => {
    setActiveMenu(pathname);
  }, [pathname]);

  const menuItems = [
    { href: "/", label: "Home" },
    { href: "/calculators", label: "Calculators" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact-us", label: "Support" },
  ];

  return (
    <>
      {status !== "authenticated" && (
        <div className={`top-hdr-bar ${!showTopBar ? 'closed' : ''}`}>
          <Container fluid>
            <div className="top_bar_inner">
              <Row className="align-items-center">
                <Col lg={10} md={10} sm={12} xs={12}>
                  <p className="mb-0"> <span className="text-light-green"> Income over £50,000? </span> Stay MTD-ready with TaxSimba. Check your registration status now. <Link href="/check-mtd" className="d-inline-block mt-2 mt-md-0 ms-md-2" style={{ whiteSpace: "nowrap" }}>Quick Check <FaArrowRightLong /></Link> </p>
                </Col>
                <Col lg={2} md={2} sm={12} xs={12}>
                  <p className="close-hdr-btn text-end d-none" onClick={handleCloseTopBar}>
                    <RiCloseLargeFill />
                  </p>
                </Col>
              </Row>
            </div>
          </Container>
        </div>
      )}

      <header className={isMenuOpen ? "site-header menu_active" : "site-header"} >
        <div className="header-outer">
          <div className="container-fluid">
            <div className="inner_top_header">
              <Link className="logo" href="/">
                <img src="/images/logo.svg" alt="Logo" />
              </Link>
              {status !== "authenticated" && (
                <nav className="navbar top-header-nav mx-auto">
                  <div className="menu-xxx-container">
                    <ul className="menu nav-menu">
                      {menuItems.map((item, index) => (

                        <li
                          key={index}
                          className={`menu-item${activeMenu === item.href ? " active" : ""}`}
                          onClick={() => { setActiveMenu(item.href), toggleClass() }}
                        >
                          <Link href={item.href} target={item.target}>{item.label}</Link>
                        </li>
                      ))}
                      <li className={`resources-item ${resourcesOpen ? "open" : ""} ${isResourcesActive ? "active" : ""}`}>

                        <Link
                          href={'/'}
                          className="resources-mobile-toggle"
                          onClick={(e) => {
                            if (isMobile) {
                              e.preventDefault();
                              setResourcesOpen(!resourcesOpen);
                            }
                          }}
                        >
                          {resources}
                          <span><FontAwesomeIcon icon={faAngleDown} /></span>
                        </Link>

                        {/* Desktop normal link */}
                        <Link href="/" className="resources-desktop-link">
                          {resources}
                          <span><FontAwesomeIcon icon={faAngleDown} /></span>
                        </Link>


                        <ul className={`nav_dropdown ${resourcesOpen ? "show" : ""}`}>
                          <li>

                            <ul>
                              <li>
                                <Link href="/blogs">
                                  Blog
                                </Link>
                              </li>
                              <li>
                                <Link href="/mtd-information">MTD Information</Link>
                              </li>
                            </ul>
                          </li>
                        </ul>
                      </li>


                    </ul>
                  </div>
                </nav>
              )}
              <div className="navigation-right" ref={langRef}>
                {loading ?
                  (
                    <div
                      className="placeholder-glow d-flex align-items-center"
                      style={{ maxWidth: '150px', maxHeight: '55px' }}
                    >
                      <div
                        className="placeholder bg-secondary rounded-circle me-2"
                        style={{ width: '50px', height: '50px' }}
                      ></div>
                      <div
                        className="placeholder bg-secondary rounded"
                        style={{ width: '75px', height: '14px' }}
                      ></div>
                    </div>
                  )
                  :
                  (status !== "authenticated") ? (
                    <>
                      <TranslatedLink href="/login" className="common-light-outline-btn d-lg-block d-none">Login</TranslatedLink>
                      <Link href="/register" className="common-btn d-lg-block d-none">Get Started</Link>
                    </>
                  ) : <>
                    <div className={`dropdown prof_drop d-lg-block d-none ${dropdownOpen ? "show" : ""}`}>
                      <button
                        className={`btn dropdown-toggle ${dropdownOpen ? "show" : ""}`}
                        type="button"
                        id="dropdownMenuButton"
                        aria-expanded={dropdownOpen ? "true" : "false"}
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                      >
                        <span className="prof_thumb_image">
                          <Image
                            src={
                              userData?.profilePhoto
                                ? userData.profilePhoto.startsWith('https')
                                  ? userData.profilePhoto
                                  : `${getBackendBaseUrl()}${userData.profilePhoto}`
                                : "/images/user.png"
                            }
                            onError={() => console.error("Image failed to load")}
                            alt="profile image"
                            width={200}
                            height={200}
                          />
                        </span>
                        <span className="prof_name">
                          <em>{userData?.firstName || ""}</em>
                        </span>
                      </button>
                      <ul
                        className={`dropdown-menu ${dropdownOpen ? "show" : ""}`}
                        aria-labelledby="dropdownMenuButton"
                      >
                        {isMTD ? (
                          <>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/mtd-dashboard?tab=overview");
                                  setDropdownOpen(false);
                                }}>
                                <GrDashboard />
                                {dashboardText}
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/mtd-dashboard?tab=taxHistory");
                                  setDropdownOpen(false);
                                }}>
                                <TbTax />
                                Tax History
                              </button>
                            </li>

                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/mtd-dashboard?tab=subscriptions");
                                  setDropdownOpen(false);
                                }}>
                                <FaFileInvoiceDollar />
                                Current Subscription
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/mtd-dashboard?tab=billingHistory");
                                  setDropdownOpen(false);
                                }}>
                                <FaHistory />
                                Billing History
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/mtd-dashboard?tab=profile");
                                  setDropdownOpen(false);
                                }}>
                                <FaRegUserCircle />
                                Profile Settings
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/mtd-dashboard?tab=notifications");
                                  setDropdownOpen(false);
                                }}>
                                <FaBell />
                                Notifications
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/mtd-dashboard?tab=changePassword");
                                  setDropdownOpen(false);
                                }}>
                                <PiKeyBold />
                                Change Password
                              </button>
                            </li>
                          </>
                        ) : (
                          <>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/dashboard");
                                  setDropdownOpen(false);
                                }}>
                                <GrDashboard />
                                {dashboardText}
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/dashboard/tax-tracker");
                                  setDropdownOpen(false);
                                }}>
                                <TbTax />
                                Tax Tracker
                              </button>
                            </li>


                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/dashboard/my-tax-return");
                                  setDropdownOpen(false);
                                }}>
                                <RiArrowLeftRightLine />
                                My Tax Return
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/dashboard/my-documents");
                                  setDropdownOpen(false);
                                }}>
                                <IoNewspaperOutline />
                                My Documents
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/dashboard/notifications");
                                  setDropdownOpen(false);
                                }}>
                                <FaBell />
                                Notifications
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/dashboard/my-subscriptions");
                                  setDropdownOpen(false);
                                }}>
                                <FaFileInvoiceDollar />
                                Current Subscription
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/dashboard/billing-history");
                                  setDropdownOpen(false);
                                }}>
                                <FaHistory />
                                Billing History
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/dashboard/edit-profile");
                                  setDropdownOpen(false);
                                }}>
                                <FaRegUserCircle />
                                My Profile
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item"
                                onClick={() => {
                                  router.push("/dashboard/change-password");
                                  setDropdownOpen(false);
                                }}>
                                <PiKeyBold />
                                Change Password
                              </button>
                            </li>
                          </>
                        )}

                        <li>
                          <button className="dropdown-item text-danger"
                            onClick={() => {
                              Logout(session);
                              setDropdownOpen(false);
                            }}>
                            <FiLogOut />
                            {logoutText}
                          </button>
                        </li>
                      </ul>
                    </div>
                  </>}
                <div className="mobile-display d-lg-none d-flex align-items-center gap-4">
                  {status !== "authenticated" ? (
                    <>
                      <div className="user-icon">
                        <Link href="/login" className="p-0 text-dark me-2">Log in</Link>
                      </div>
                      <div className="mobile-mtd-btn">
                        <Link href="/register" className="common-btn d-inline-block">Get Started</Link>
                      </div>
                      <div className="trigger_mobile_menu" onClick={handleShow}>
                        <span></span> <span></span> <span></span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="user-profile-mobile" onClick={handleShowOne} style={{ cursor: 'pointer' }}>
                        <div className="d-flex align-items-center gap-2">
                          <span className="prof_thumb_image" style={{ width: '35px', height: '35px', borderRadius: '50%', overflow: 'hidden' }}>
                            <Image
                              src={
                                userData?.profilePhoto
                                  ? userData.profilePhoto.startsWith('https')
                                    ? userData.profilePhoto
                                    : `${getBackendBaseUrl()}${userData.profilePhoto}`
                                  : "/images/user.png"
                              }
                              alt="profile image"
                              width={35}
                              height={35}
                            />
                          </span>
                          <span className="prof_name" style={{ fontSize: '14px', fontWeight: '500' }}>
                            <em>{userData?.firstName || "User"}</em>
                          </span>
                        </div>
                      </div>
                      <div className="trigger_mobile_menu" onClick={handleShowOne}>
                        <span></span> <span></span> <span></span>
                      </div>
                    </>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </header>
      {/* without login mobile header */}
      <Offcanvas show={show} onHide={handleClose} placement="end" className="mobile-menu-wrapper">
        <Offcanvas.Header closeButton >
          <Offcanvas.Title> <Link className="logo" href="/">
            <img src="/images/logo.svg" alt="Logo" />
          </Link>
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="px-0">
          <ul className="list-unstyled mobile-menu">
            <li>
              <Link href="/" className={pathname === "/" ? "active" : ""} onClick={handleClose}>Home</Link>
            </li>
            <li>
              <Link href="/calculators" className={pathname === "/calculators" ? "active" : ""} onClick={handleClose}>Calculator</Link>
            </li>
            <li>
              <Link href="/pricing" className={pathname === "/pricing" ? "active" : ""} onClick={handleClose}>Tax Return Pricing</Link>
            </li>
            <li>
              <Link href="/contact-us" className={pathname === "/contact-us" ? "active" : ""} onClick={handleClose}>Support</Link>
            </li>
            <li>
              <Link href="/blogs" className={pathname === "/blogs" ? "active" : ""} onClick={handleClose}>Blog</Link>
            </li>
            <li>
              <Link href="/mtd-information" className={pathname === "/mtd-information" ? "active" : ""} onClick={handleClose}>MTD information and Pricing</Link>
            </li>
          </ul>

        </Offcanvas.Body>
      </Offcanvas>
      {/* after login mobile header */}
      <Offcanvas show={showOne} onHide={handleCloseOne} placement="end" className="mobile-login-menu-wrapper">
        <Offcanvas.Header closeButton >
          <Offcanvas.Title> <Link className="logo" href="/">
            <img src="/images/logo.svg" alt="Logo" />
          </Link>
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="px-0">
          <ul className="mobile-login-menu">
            {isMTD ? (
              <>
                <li>
                  <Link href="/mtd-dashboard?tab=overview" className={pathname === "/mtd-dashboard" && activeTab === "overview" ? "active" : ""} onClick={handleCloseOne}>
                    <GrDashboard />
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/mtd-dashboard?tab=taxHistory" className={pathname === "/mtd-dashboard" && activeTab === "taxHistory" ? "active" : ""} onClick={handleCloseOne}>
                    <TbTax />
                    Tax History
                  </Link>
                </li>

                <li>
                  <Link href="/mtd-dashboard?tab=subscriptions" className={pathname === "/mtd-dashboard" && activeTab === "subscriptions" ? "active" : ""} onClick={handleCloseOne}>
                    <FaFileInvoiceDollar />
                    Current Subscription
                  </Link>
                </li>
                <li>
                  <Link href="/mtd-dashboard?tab=billingHistory" className={pathname === "/mtd-dashboard" && activeTab === "billingHistory" ? "active" : ""} onClick={handleCloseOne}>
                    <FaHistory />
                    Billing History
                  </Link>
                </li>
                <li>
                  <Link href="/mtd-dashboard?tab=profile" className={pathname === "/mtd-dashboard" && activeTab === "profile" ? "active" : ""} onClick={handleCloseOne}>
                    <FaRegUserCircle />
                    Profile Settings
                  </Link>
                </li>
                <li>
                  <Link href="/mtd-dashboard?tab=notifications" className={pathname === "/mtd-dashboard" && activeTab === "notifications" ? "active" : ""} onClick={handleCloseOne}>
                    <FaBell />
                    Notifications
                  </Link>
                </li>
                <li>
                  <Link href="/mtd-dashboard?tab=changePassword" className={pathname === "/mtd-dashboard" && activeTab === "changePassword" ? "active" : ""} onClick={handleCloseOne}>
                    <PiKeyBold />
                    Change Password
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/dashboard" className={pathname === "/dashboard" ? "active" : ""} onClick={handleCloseOne}>
                    <GrDashboard />
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/tax-tracker" className={pathname === "/dashboard/tax-tracker" ? "active" : ""} onClick={handleCloseOne}>
                    <TbTax />
                    Tax Tracker
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/my-tax-return" className={pathname === "/dashboard/my-tax-return" ? "active" : ""} onClick={handleCloseOne}>
                    <RiArrowLeftRightLine />
                    My Tax Return
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/my-documents" className={pathname === "/dashboard/my-documents" ? "active" : ""} onClick={handleCloseOne}>
                    <IoNewspaperOutline />
                    My Documents
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/notifications" className={pathname === "/dashboard/notifications" ? "active" : ""} onClick={handleCloseOne}>
                    <FaBell />
                    Notifications
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/my-subscriptions" className={pathname === "/dashboard/my-subscriptions" ? "active" : ""} onClick={handleCloseOne}>
                    <FaFileInvoiceDollar />
                    Current Subscription
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/billing-history" className={pathname === "/dashboard/billing-history" ? "active" : ""} onClick={handleCloseOne}>
                    <FaHistory />
                    Billing History
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/edit-profile" className={pathname === "/dashboard/edit-profile" ? "active" : ""} onClick={handleCloseOne}>
                    <FaRegUserCircle />
                    Profile Details
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/change-password" className={pathname === "/dashboard/change-password" ? "active" : ""} onClick={handleCloseOne}>
                    <PiKeyBold />
                    Change Password
                  </Link>
                </li>
              </>
            )}

            <li className="px-3 mt-4">
              <button
                className="dropdown-item text-danger border-0 bg-transparent w-100 text-start d-flex align-items-center gap-2 px-0"
                onClick={() => {
                  Logout(session);
                  handleCloseOne();
                }}
              >
                <MdLogout />
                Log Out
              </button>
            </li>
          </ul>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
};

export default Navbar;
