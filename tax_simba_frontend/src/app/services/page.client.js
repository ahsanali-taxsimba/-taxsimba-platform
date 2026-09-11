'use client';
import React, { use } from 'react'
import TaxSituationsSection from '../(home)/_home-components/TaxSituationsSection'
import BannerSection from './_sections/BannerSection';
import WhyChooseSection from './_sections/WhyChooseSection';
import WhatYouGetSection from './_sections/WhatYouGetSection';
import OurPricingSection from './_sections/OurPricingSection';
import ServicesWeOffer from './_sections/ServicesWeOffer';
import CtaSection from './_sections/CtaSection';
import FaqSection from './_sections/FaqSection';
const ServicesClient = ({ services }) => {
  return (
    <>
      {/* <TaxSituationsSection page={"service"} /> */}
      <BannerSection />
      <WhyChooseSection />
      <ServicesWeOffer services={services} />
      <WhatYouGetSection />
      {/* <OurPricingSection /> */}
      <CtaSection />
      <FaqSection />
    </>
  )
}

export default ServicesClient