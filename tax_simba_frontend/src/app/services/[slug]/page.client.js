import ServiceDetailsBannerSection from "./_sections/ServiceDetailsBannerSection";
import TaxReturnMadeSimpleSection from "./_sections/TaxReturnMadeSimpleSection";
import WhatWeDoSection from "./_sections/WhatWeDoSection";
import Faq from "@/components/re-used/Faq";
import ReviewSection from "./_sections/ReviewSection";
import HomeTestimonials from "@/app/(home)/_home-components/Hometestimonials";
import TaxSituationsSectionDetails from "./_sections/TaxSituationsSectionDetails";
import WhatYouGetSectionDetails from "./_sections/WhatYouGetSectionDetails";
import HowItWorksSectionDetails from "@/app/(home)/_home-components/HowItWorksSection";
import ServiceDetailsWhyChooseSection from "./_sections/ServiceDetailsWhyChooseSection";
import ServiceFaq from "./_sections/ServiceFaq";

export default function ServiceDetailsClientPage({ service }) {
    // console.log("test service",service)
    // Extract banner data from service sections
    const bannerData = service?.sections?.find(section => section.bannerSection)?.bannerSection;
    const whoWeAreSection = service?.sections?.find(section => section.whoWeAreSection)?.whoWeAreSection;
    const whatWeDoSection = service?.sections?.find(section => section.whatWeDoSection)?.whatWeDoSection;
    const whoWeHelpSection = service?.sections?.find(section => section.whoWeHelpSection)?.whoWeHelpSection;
    const howItWorksSection = service?.sections?.find(section => section.howItWorksSection)?.howItWorksSection;
    const benefitsSection = service?.sections?.find(section => section.benefitsSection)?.benefitsSection;
    const whatIsCISSection = service?.sections?.find(section => section.whatIsCISSection)?.whatIsCISSection;
    const whyChooseUsSection = service?.sections?.find(section => section.whyChooseUsSection)?.whyChooseUsSection;
    const whyChoseUsSection = service?.sections?.find(section => section.whyChoseUsSection)?.whyChoseUsSection;
    console.log("test service", whoWeHelpSection)

    return (
        <>
            {bannerData && <ServiceDetailsBannerSection service={service} bannerData={bannerData} />}
            {whoWeAreSection && <TaxReturnMadeSimpleSection service={service} whoWeAreSection={whoWeAreSection} />}
            {whatWeDoSection && <WhatWeDoSection service={service} whatWeDoSection={whatWeDoSection} />}
            {whoWeHelpSection && <TaxSituationsSectionDetails service={service} whoWeHelpSection={whoWeHelpSection} />}
            {whyChoseUsSection && <ServiceDetailsWhyChooseSection service={service} whyChoseUsSection={whyChoseUsSection} />}
            {howItWorksSection && <HowItWorksSectionDetails service={service} howItWorksSection={howItWorksSection} />}
            {benefitsSection && <WhatYouGetSectionDetails service={service} benefitsSection={benefitsSection} />}
            <HomeTestimonials service={service} />
            {service?.faq && <ServiceFaq service={service} faqs={service?.faq} />}
        </>
    );
}