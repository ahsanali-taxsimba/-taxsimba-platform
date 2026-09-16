'use client';
import React from 'react'
import Accordion from 'react-bootstrap/Accordion';
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";
const ServiceFaq = ({ service, faqs }) => {
    console.log("service faqs", faqs)
    return (
        <>
            <section className="faq sevc_dtls_faq">
                <div className="container">
                    <div className="row">
                        <div className="col-lg-5 col-md-7">
                            <div className="faq_details">
                                <div className="global_heading">
                                    <TranslatedHeadingTwo>FAQ</TranslatedHeadingTwo>
                                    <TranslatedParagraph><TranslatedText>Here are some commonly asked queries in tax filing UK:</TranslatedText></TranslatedParagraph>
                                </div>
                                <Accordion >
                                    {faqs?.map((item, index) => {
                                        return (
                                            <Accordion.Item eventKey={index} key={index}>
                                                <Accordion.Header> <TranslatedText>{item?.q}</TranslatedText></Accordion.Header>
                                                <Accordion.Body>
                                                    <TranslatedText>{item?.a}</TranslatedText>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        )
                                    })}
                                </Accordion>

                            </div>
                        </div>
                        <div className="col-lg-7 col-md-5">
                            <div className="faq_image">
                                <img src="/images/faq_img.png" alt="faq_img" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}

export default ServiceFaq
