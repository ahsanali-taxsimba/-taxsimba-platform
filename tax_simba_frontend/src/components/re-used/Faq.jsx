'use client';
import React, { useState, useEffect } from 'react';
import Accordion from 'react-bootstrap/Accordion';
import Spinner from 'react-bootstrap/Spinner';
import axios from 'axios';
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";
import { usePathname } from 'next/navigation';
import { Container } from 'react-bootstrap';
import { Col, Row } from 'react-bootstrap';
import { MdKeyboardDoubleArrowRight } from 'react-icons/md';
import Link from 'next/link';
const Faq = () => {
  const pathname = usePathname();


  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10; // Number of FAQs per page

  const fetchFaqs = async (page) => {
    setLoadingFaqs(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await axios.get(`${apiUrl}faqs?page=${page}&limit=${itemsPerPage}`);
      if (response.data?.data?.Faqs || response.data?.data?.faqs) {
        setFaqs(response.data.data.Faqs || response.data.data.faqs);
        if (response.data.data.pagination) {
          setTotalPages(response.data.data.pagination.totalPages);
        }
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

  useEffect(() => {
    fetchFaqs(currentPage);
  }, [currentPage]);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    // Scroll to the top of the FAQ section for better UX
    const element = document.getElementById("faq-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>

      <section className="breadcrum-sec-top py-80">
        <Container>
          <Row className="align-items-center">
            <Col lg={6}>
              <div className="bread-crum-inr-box text-lg-start text-center">
                <h1 className="text-capitalize mb-3 fs-2">TaxSimba FAQ</h1>
                <p className="mb-0">Find answers to commonly asked questions about UK tax filing, Self Assessment, and how
                  TaxSimba can help you stay compliant.</p>
              </div>
            </Col>
            <Col lg={6} className="mt-lg-0 mt-5">
              <div className="breadcrum-img text-center">
                <img src="/images/faq-bread.png" alt="Breadcrumb Image" className="img-fluid" />
              </div>
            </Col>
          </Row>
        </Container>
      </section>
      {/* FAQ Section Start */}
      <section className="faq-section ptb-80" id="faq-section">
        <Container>
          <Row>
           

            <Col lg={12}>

              <div className="faq-outer">
                {loadingFaqs ? (
                  <div className="text-center p-4">
                    <Spinner animation="border" variant="success" />
                  </div>
                ) : faqs.length > 0 ? (
                  <>
                    <Accordion defaultActiveKey="0">
                      {faqs.map((faq, index) => (
                        <Accordion.Item eventKey={index.toString()} key={faq.id || index}>
                          <Accordion.Header>{faq.question || faq.q || faq.title || "FAQ"}</Accordion.Header>
                          <Accordion.Body>
                            <div dangerouslySetInnerHTML={{ __html: faq.answer || faq.a || faq.description || "Content not available." }} />
                          </Accordion.Body>
                        </Accordion.Item>
                      ))}
                    </Accordion>

                    {/* Pagination UI */}
                    {totalPages > 1 && (
                      <div className="pagination mt-4">
                        <button
                          className="prev"
                          onClick={() => paginate(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          « Prev
                        </button>

                        {[...Array(totalPages)].map((_, index) => (
                          <button
                            key={index}
                            className={`page-btn ${currentPage === index + 1 ? 'active' : ''}`}
                            onClick={() => paginate(index + 1)}
                          >
                            {index + 1}
                          </button>
                        ))}

                        <button
                          className="next"
                          onClick={() => paginate(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Next »
                        </button>
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
    


    </>
  )
}

export default Faq
