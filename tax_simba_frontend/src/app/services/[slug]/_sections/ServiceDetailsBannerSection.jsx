"use client"
import { TranslatedHeading, TranslatedParagraph, TranslatedText } from '@/components/TranslatedContent'
import React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
const ServiceDetailsBannerSection = ({ service, bannerData }) => {
  // console.log("service in Banner",service)
  // console.log("bannerData in Banner",bannerData)
  const { data: session } = useSession(); //{data: session}
  const router = useRouter();
  // console.log("session in Banner",session)
  const handleTaxReviewClick = (e) => {
    e.preventDefault();
    if (!session) {
      router.push('/login')
    } else {
      router.push('/tax-return-form')
    }
  }
  return (
    <section className="banner_main about_banner">
      <div className="back_round">
        {" "}
        <img src="/images/bg_round.png" alt="" />{" "}
      </div>
      <div className="container">
        <div className="banner_inner">
          <div className="row">
            <div className="col-lg-8">
              <div className="banner_details_part">
                <TranslatedHeading>{bannerData?.title1}</TranslatedHeading>
                <TranslatedParagraph>
                  {bannerData?.description}&nbsp;
                </TranslatedParagraph>
              </div>
            </div>
          </div>
        </div>

        <div className='service_dtls_btn_holder'>
          <Link href="/tax-filing" className='basic_btn' onClick={(e) => handleTaxReviewClick(e)}><TranslatedText>{bannerData?.buttonText || "Start My Tax Return"}</TranslatedText></Link>
        </div>
      </div>
    </section>
  )
}

export default ServiceDetailsBannerSection
