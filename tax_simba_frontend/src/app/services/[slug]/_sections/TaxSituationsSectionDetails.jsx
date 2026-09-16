import Link from "next/link";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan,TranslatedText } from "@/components/TranslatedContent";
export default function TaxSituationsSectionDetails({page="default",whoWeHelpSection}){
  const tailoredBox = [
    {imageSrc:"/images/tax1.png",para:"Self-Employed & Freelancers", slug: "self-employed-freelancers"},
    {imageSrc:"/images/tax2.png",para:"Landlords & Property Income", slug: "rental-property-tax"},
    {imageSrc:"/images/tax3.png",para:"Non-UK Residents with UK Income", slug: "non-uk-residents-uk-income"},
    {imageSrc:"/images/tax4.png",para:"Company Directors", slug: "company-directors"},
    {imageSrc:"/images/tax5.png",para:"Pensioners with Additional Income", slug: "pensioners-additional-income"}
  ]
  console.log("whoWeHelpSection",whoWeHelpSection)
    return (
        <section className="tax_situations who_we_help">
    <div className="container">
      <div className="trailored_inner">
        <div className="trailored_box align-items-center d-flex">
          {
            page==="service" ?
            <TranslatedHeading><TranslatedSpan className="blue_txt">Who We Help</TranslatedSpan>{whoWeHelpSection.title2}</TranslatedHeading>
            :
            <TranslatedHeadingTwo><TranslatedSpan className="blue_txt">Who We Help</TranslatedSpan>{whoWeHelpSection.title2}</TranslatedHeadingTwo>
          }
        </div>
        {page == 'hoome' ? 
        whoWeHelpSection?.items.map((item,index)=>{return (
        <div className="trailored_box" key={item.slug || index}>
          <figure>
            <img src={tailoredBox[index]?.imageSrc} alt="Tax_image" />
          </figure>
          <TranslatedParagraph>{item.title}</TranslatedParagraph>
        </div>
        )})
        
         :
        whoWeHelpSection?.items.map((item,index)=>{return (
        <div className="trailored_box" key={item.slug || index}>
          <figure>
            <img src={tailoredBox[index]?.imageSrc} alt="" />
          </figure>
          <TranslatedParagraph>{item.title}</TranslatedParagraph>
        </div>
        )})
        
        
        }
        
      </div>
    </div>
  </section>
    )
}
