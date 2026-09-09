"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { BsCheckCircle } from "react-icons/bs";
import { CiCircleCheck } from "react-icons/ci";

import {
  faFacebookF,
  faLinkedinIn,
  faTwitter,
  faYoutube
} from "@fortawesome/free-brands-svg-icons";
import { FaAngleRight } from "react-icons/fa6";

import { TranslatedHeadingTwo, TranslatedNextLink, TranslatedParagraph, TranslatedSpan } from "@/components/TranslatedContent";
import { useAxiosInstance } from "@/hooks/useAxiosInstance";
import { useResourceCategories } from "@/hooks/useResourceCategories";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ChatBot from "./ChatBot";
const Footer = () => {
  const pathname = usePathname();
  const { data: resourceCategories, loading: resourcesLoading } = useResourceCategories();
  const { get: apiGet } = useAxiosInstance();
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

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

        if (isMounted) {
          setServices(sorted);
        }
      } catch (error) {
        if (isMounted) {
          setServices([]);
        }
      } finally {
        if (isMounted) {
          setServicesLoading(false);
        }
      }
    };

    fetchServices();

    return () => {
      isMounted = false;
    };
  }, [apiGet]);

  if (pathname === "/login"
    || pathname === "/forgot-password"
    || pathname === "/register"
    || pathname === "/reset-password"
    || pathname === "/verify-email"
  ) {
    return (
      <footer className="footer">
        <div className="footer_bottom text-center">
          <div className="container">
            <TranslatedParagraph>© {new Date().getFullYear()} <Link href='/' className="fw-bold"> TaxSimba  </Link>  your partner for stress free taxes. </TranslatedParagraph>
          </div>
        </div>
        <ChatBot />
      </footer>
    )
  }

  return (
    <footer className="footer">
      <div className="footer_top">
        <div className="container">
          <div className="row">
            <div className="col-lg-3 col-md-12">
              <div className="ftr_left">
                <Link className="ftr_logo" href="/">
                  <img src="/images/logo.svg" alt="Logo" />
                </Link>
                <TranslatedParagraph>
                  Cloud-native income tax & bookkeeping compliance for UK professionals. Securely bridging the gap between digital records and HMRC.
                </TranslatedParagraph>

                <ul className="social mt-4">
                  <li>
                    <Link href="https://www.facebook.com/profile.php?id=61583470161019" target="__blank">
                      <FontAwesomeIcon icon={faFacebookF} />
                    </Link>
                  </li>
                  <li>
                    <Link href="https://www.youtube.com/@TaxSimba" target="__blank">
                      <FontAwesomeIcon icon={faYoutube} />
                    </Link>
                  </li>
                  <li>
                    <Link href="https://www.linkedin.com/company/taxsimba/" target="__blank">
                      <FontAwesomeIcon icon={faLinkedinIn} />
                    </Link>
                  </li>
                  <li>
                    <Link href="https://x.com/TaxSimba" target="__blank">
                      <FontAwesomeIcon icon={faTwitter} />
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-lg-3  col-md-6">
              <div className="footer_block">
                <TranslatedHeadingTwo>Product</TranslatedHeadingTwo>
                <ul>
                  <li>
                    <TranslatedNextLink href="/pricing"><span><FaAngleRight /></span>Tax Returns information and Pricing</TranslatedNextLink>
                  </li>
                  <li>
                    <TranslatedNextLink href="/check-mtd"><span><FaAngleRight /></span>Check if I need MTD</TranslatedNextLink>
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-lg-3  col-md-6">
              <div className="footer_block">
                <TranslatedHeadingTwo>Tools</TranslatedHeadingTwo>
                <ul>
                  <li>
                    <TranslatedNextLink href="/calculators/income-tax"><span><FaAngleRight /></span>UK Income Tax</TranslatedNextLink>
                  </li>
                  <li>
                    <TranslatedNextLink href="/calculators/combined-tax"><span><FaAngleRight /></span>Employed & Self-Employed</TranslatedNextLink>
                  </li>
                  <li>
                    <TranslatedNextLink href="/calculators/salary-after-tax"><span><FaAngleRight /></span>Salary After Tax</TranslatedNextLink>
                  </li>
                  <li>
                    <TranslatedNextLink href="/check-mtd"><span><FaAngleRight /></span>MTD Checker</TranslatedNextLink>
                  </li>
                  <li>
                    <TranslatedNextLink href="/calculators"><span><FaAngleRight /></span>All Calculators</TranslatedNextLink>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-3  col-md-6">
              <div className="footer_block">
                <TranslatedHeadingTwo>Trust</TranslatedHeadingTwo>
                <ul>
                  <li>
                    <span className="footer-link-item">
                      <span><BsCheckCircle className="text-theme" /></span>
                      <TranslatedSpan>Secure Document Uploads</TranslatedSpan>
                    </span>
                  </li>
                  <li>
                    <span className="footer-link-item">
                      <span><BsCheckCircle className="text-theme" /></span>
                      <TranslatedSpan>Dedicated Accountant Support</TranslatedSpan>
                    </span>
                  </li>
                  <li>
                    <span className="footer-link-item">
                      <span><BsCheckCircle className="text-theme" /></span>
                      <TranslatedSpan>GDPR Compliant </TranslatedSpan>
                    </span>
                  </li>
                  <li>
                    <span className="footer-link-item">
                      <span><BsCheckCircle className="text-theme" /></span>
                      <TranslatedSpan>HMRC MTD Ready  </TranslatedSpan>
                    </span>
                  </li>
                  <li>
                    <span className="footer-link-item">
                      <span><BsCheckCircle className="text-theme" /></span>
                      <TranslatedSpan>Encrypted Data Transmission </TranslatedSpan>
                    </span>
                  </li>
                </ul>
              </div>
            </div>

          </div>

          <div className="ftr-bottom-hd mt-lg-5 mt-3 py-3">
            <div className="row flex-lg-row flex-column-reverse gap-lg-0 gap-3">
              <div className="col-lg-3">
                <div className="footer-bottom text-left">
                  <p className="text-white mb-0">© {new Date().getFullYear()}
                    <Link className="theme-color" href="/" target="_blank"> Taxsimba</Link> All Rights Reserved</p>
                </div>
              </div>
              <div className="col-lg-9">
                <div className="ftr-bottom-links">
                  <ul className="d-flex flex-lg-nowrap flex-wrap mb-0">
                    <li>
                      <Link href="/privacy-policy">Privacy Policy</Link>
                    </li>
                    <li>
                      <Link href="/terms-and-conditions">Terms and Conditions</Link>
                    </li>
                    <li>
                      <Link href="/cookie-policy">Cookie Policy</Link>
                    </li>
                    <li>
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); typeof window !== "undefined" && window.dispatchEvent(new Event("openCookieSettings")); }}
                      >
                        Cookie Settings
                      </a>
                    </li>
                    <li>
                      <Link href="/data-policy">Data Policy</Link>
                    </li>
                    <li>
                      <Link href="/faq">Help Centre </Link>
                    </li>
                    <li>
                      <Link href="/contact-us">Contact Us</Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ChatBot />

    </footer>
  );
};

export default Footer;