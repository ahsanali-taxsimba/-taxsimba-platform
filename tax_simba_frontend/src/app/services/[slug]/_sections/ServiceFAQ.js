"use client"
import { TranslatedHeadingTwo, TranslatedParagraph, TranslatedText } from '@/components/TranslatedContent'
import React from 'react'
import { Accordion } from 'react-bootstrap'

const ServiceFAQ = ({ data }) => {
    return (
        <>
            <section className="faq">
                <div className="container">
                    <div className="row">
                        <div className="col-lg-12 col-md-12">
                            <div className="faq_details">
                                <div className="global_heading">
                                    <TranslatedHeadingTwo>FAQs</TranslatedHeadingTwo>
                                    <TranslatedParagraph><TranslatedText>What clients ask us</TranslatedText></TranslatedParagraph>
                                </div>
                                <Accordion defaultActiveKey="0">
                                    {data?.map((item, idx) => (
                                        <Accordion.Item eventKey={idx.toString()} key={idx}>
                                            <Accordion.Header> <TranslatedText>{item?.q}</TranslatedText></Accordion.Header>
                                            <Accordion.Body>
                                                <TranslatedText>{item?.a}</TranslatedText>
                                            </Accordion.Body>
                                        </Accordion.Item>
                                    ))}
                                </Accordion>

                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}

export default ServiceFAQ
