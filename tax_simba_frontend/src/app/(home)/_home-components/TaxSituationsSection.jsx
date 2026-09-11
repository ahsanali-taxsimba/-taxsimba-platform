import Link from "next/link";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan,TranslatedText } from "@/components/TranslatedContent";
export default function TaxSituationsSection({page="default"}){
  const tailoredBox = [
    {imageSrc:"/images/tax1.png",para:"Self-Employed & Freelancers", slug: "self-employed-freelancers"},
    {imageSrc:"/images/tax2.png",para:"Landlords & Property Income", slug: "rental-property-tax"},
    {imageSrc:"/images/tax3.png",para:"Non-UK Residents with UK Income", slug: "non-uk-residents-uk-income"},
    {imageSrc:"/images/tax4.png",para:"Company Directors", slug: "company-directors"},
    {imageSrc:"/images/tax5.png",para:"Pensioners with Additional Income", slug: "pensioners-additional-income"}
  ]
    return (
        <section className="tax_situations">
    <div className="container">
      <div className="trailored_inner">
        <div className="trailored_box align-items-center d-flex">
          {
            page==="service" ?
            <TranslatedHeading>Tailored for All Tax Situations</TranslatedHeading>
            :
            <TranslatedHeadingTwo>Tailored for All Tax Situations</TranslatedHeadingTwo>
          }
        </div>
        {tailoredBox.map((item,index)=>{return (
        <div className="trailored_box" key={item.slug || index}>
          <figure>
            <img src={item.imageSrc} alt="tax_image" />
          </figure>
          <TranslatedParagraph>{item.para}</TranslatedParagraph>
        </div>
        )})
        
        }
        
      </div>
    </div>
  </section>
    )
}
